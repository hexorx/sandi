import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { choice, createJevClient, JevError, request as buildJevRequest } from '@sandi/jev';
import { findToolCall } from './tool-calls.js';
import { decideToolCall } from './tool-safety.js';
import { triageTicket } from './triage.js';
import { runModeration, ModerationError } from './moderation.js';
import { runGuardrails, type GuardrailPolicy } from './pii-phi.js';
import type { EngineRun, EngineSelection } from '../decision-engine-contract.js';
import { createJevClientFromEnvironment, runJevAgent } from './jev-agent.js';
import { runDecisionPipeline } from './decision-pipeline.js';
import { requestedEngine, runDecider } from './decider.js';

export type RuntimeMode = 'mock' | 'live';

const clientDirectory = resolve(fileURLToPath(new URL('../client/', import.meta.url)));
const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

export function getRuntimeMode(environment: NodeJS.ProcessEnv): RuntimeMode {
  return environment.NODE_ENV !== 'test' && environment.CI !== 'true' && environment.JEV_MODE === 'live' && Boolean(environment.TYPESAFE_API_KEY) ? 'live' : 'mock';
}

function sendJson(response: ServerResponse, statusCode: number, payload: object): void {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function serveClient(request: IncomingMessage, response: ServerResponse, pathname: string): void {
  let filePath: string;
  try {
    const decodedPath = decodeURIComponent(pathname);
    filePath = resolve(clientDirectory, `.${decodedPath}`);
  } catch {
    sendJson(response, 400, { error: 'Invalid path' });
    return;
  }

  if (filePath !== clientDirectory && !filePath.startsWith(`${clientDirectory}${sep}`)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  const resolvedFilePath = existsSync(filePath) && statSync(filePath).isFile() ? filePath : resolve(clientDirectory, 'index.html');
  if (!existsSync(resolvedFilePath)) {
    sendJson(response, 503, { error: 'Showcase assets are unavailable' });
    return;
  }

  response.writeHead(200, {
    'content-type': contentTypes[extname(resolvedFilePath)] ?? 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(resolvedFilePath).pipe(response);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > 16_384) throw new TypeError('Request body is too large.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function createModerationClient(environment: NodeJS.ProcessEnv) {
  const forceMock = environment.NODE_ENV === 'test' || environment.CI === 'true';
  const live = !forceMock && environment.JEV_MODE === 'live' && Boolean(environment.TYPESAFE_API_KEY);
  return createJevClient({ mode: live ? 'live' : 'mock', apiKey: live ? environment.TYPESAFE_API_KEY : undefined });
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, environment: NodeJS.ProcessEnv): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  if (request.method === 'POST' && requestUrl.pathname === '/api/use-cases/jev-agent/run') {
    const disconnectController = new AbortController();
    response.once('close', () => {
      if (!response.writableEnded) disconnectController.abort();
    });
    const requestSignal = AbortSignal.any([disconnectController.signal, AbortSignal.timeout(30_000)]);
    let body: unknown;
    try {
      body = await readJson(request);
    } catch {
      sendJson(response, 400, { error: 'Provide a valid JSON task and action.' });
      return;
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(response, 400, { error: 'Task and proposed action must be between 1 and 1000 characters.' });
      return;
    }
    const input = body as { task?: unknown; action?: unknown; engine?: unknown; compare?: unknown };
    if (typeof input.task !== 'string' || typeof input.action !== 'string' || !input.task.trim() || !input.action.trim() || input.task.length > 1000 || input.action.length > 1000) {
      sendJson(response, 400, { error: 'Task and proposed action must be between 1 and 1000 characters.' });
      return;
    }
    try {
      const selection = requestedEngine(input.engine, input.compare);
      const jev = selection === 'decider' ? undefined : await runJevAgent({ task: input.task.trim(), action: input.action.trim(), jev: createJevClientFromEnvironment(environment), environment, signal: requestSignal });
      const decider = selection === 'jev' ? undefined : await runDecider('jev-agent', { task: input.task.trim(), action: input.action.trim() }, environment, requestSignal);
      const execution = selection === 'compare'
        ? { mode: 'compare' as const, results: { jev: { requestedEngine: 'jev', engine: 'jev', answer: jev }, decider } }
        : { mode: 'single' as const, result: selection === 'jev' ? { requestedEngine: 'jev', engine: 'jev', answer: jev } : decider };
      if (!requestSignal.aborted) sendJson(response, 200, { ...(selection === 'jev' ? jev : {}), execution });
    } catch {
      if (!requestSignal.aborted) sendJson(response, 502, { error: 'The agent could not complete this run. Try again.' });
    }
    return;
  }
  if (requestUrl.pathname === '/api/tool-safety/evaluate') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }
    try {
      const body = await readJson(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('Request must be a JSON object.');
      const input = body as { toolCallId?: unknown; engine?: unknown; compare?: unknown };
      const selection = requestedEngine(input.engine, input.compare);
      const toolCallId = input.toolCallId;
      const toolCall = typeof toolCallId === 'string' ? findToolCall(toolCallId) : undefined;
      if (!toolCall) {
        sendJson(response, 400, { error: 'Choose a valid sample tool call.' });
        return;
      }
      const mode = getRuntimeMode(environment);
      const client = createJevClient({ mode, apiKey: mode === 'live' ? environment.TYPESAFE_API_KEY : undefined, runtime: { nodeEnv: environment.NODE_ENV, ci: environment.CI === 'true' } });
      const jevRun = async () => {
        const result = await decideToolCall(toolCall, { client });
        return { ...result, requestedEngine: 'jev' as const, engine: 'jev' as const, latencyMs: 0 };
      };
      const jev = selection === 'decider' ? undefined : await jevRun();
      const execution = selection === 'compare'
        ? { mode: 'compare' as const, results: { jev, decider: await runDecider('tool-safety', toolCall, environment) } }
        : { mode: 'single' as const, result: selection === 'decider' ? await runDecider('tool-safety', toolCall, environment) : jev };
      sendJson(response, 200, { ...(selection === 'jev' ? jev : {}), execution });
    } catch (error) {
      sendJson(response, 502, { error: error instanceof JevError ? error.message : 'Safety decision is unavailable. Try again.' });
    }
    return;
  }
  if (request.method === 'POST' && requestUrl.pathname === '/api/use-cases/content-moderation/run') {
    const requestId = randomUUID();
    try {
      const body = await readJson(request);
      if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('Request must be a JSON object.');
      const input = body as { content?: unknown; policy?: unknown; engine?: unknown; compare?: unknown };
      if (typeof input.content !== 'string' || typeof input.policy !== 'string') throw new TypeError('Content and policy are required.');
      const selection = requestedEngine(input.engine, input.compare);
      const client = createModerationClient(environment);
      const jev = selection === 'decider' ? undefined : await runModeration({ content: input.content, policy: input.policy }, client);
      const decider = selection === 'jev' ? undefined : await runDecider('content-moderation', input, environment);
      const execution = selection === 'compare'
        ? { mode: 'compare' as const, results: { jev: { requestedEngine: 'jev', engine: 'jev', answer: jev }, decider } }
        : { mode: 'single' as const, result: selection === 'jev' ? { requestedEngine: 'jev', engine: 'jev', answer: jev } : decider };
      sendJson(response, 200, { requestId, mode: client.mode === 'live' ? 'live' : 'mock', ...(selection === 'jev' ? { result: jev } : {}), execution });
    } catch (error) {
      if (error instanceof ModerationError) {
        sendJson(response, 502, { requestId, error: { code: error.code, message: error.message } });
      } else {
        const message = error instanceof TypeError ? error.message : 'Request body must be valid JSON.';
        sendJson(response, 400, { requestId, error: { code: 'VALIDATION_ERROR', message } });
      }
    }
    return;
  }
  if (request.method === 'POST' && requestUrl.pathname === '/api/use-cases/pii-phi-guardrails/run') {
    const requestId = randomUUID();
    const disconnectController = new AbortController();
    response.once('close', () => {
      if (!response.writableEnded) disconnectController.abort();
    });
    const requestSignal = AbortSignal.any([disconnectController.signal, AbortSignal.timeout(30_000)]);
    try {
      const body = await readJson(request);
      if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('Request must be a JSON object.');
      const input = body as { text?: unknown; policy?: unknown; engine?: unknown; compare?: unknown };
      if (typeof input.text !== 'string' || input.text.trim().length === 0 || input.text.length > 5000) throw new TypeError('Text must be between 1 and 5000 characters.');
      if (input.policy !== 'strict' && input.policy !== 'redact-medium') throw new TypeError('Choose a supported guardrail policy.');
      const selection = requestedEngine(input.engine, input.compare);
      let result: ReturnType<typeof runGuardrails>;
      try {
        result = runGuardrails(input.text, input.policy as GuardrailPolicy);
      } catch {
        sendJson(response, 502, { requestId, error: { code: 'DETECTOR_ERROR', message: 'Detection unavailable. Nothing was sent to the mock agent.' } });
        return;
      }
      const agentInput = result.action === 'allow' ? input.text : result.action === 'redact' ? result.redactedText : undefined;
      const run = async (requestedEngine: EngineSelection): Promise<EngineRun> => {
        if (requestedEngine === 'decider') {
          if (agentInput === undefined) return { requestedEngine, engine: 'mock', answer: { guardrails: result, received: null }, confidence: {}, latencyMs: 0, fallback: { reason: 'unconfigured' } };
          const modelRun = await runDecider('pii-phi-guardrails', { text: agentInput }, environment, requestSignal);
          return { ...modelRun, requestedEngine, answer: { guardrails: result, received: { engine: 'decider', mode: modelRun.engine === 'decider' ? 'live' : 'mock', text: agentInput, response: modelRun.explanation ?? 'Decider completed the guarded sample.' } } };
        }
        const client = createJevClientFromEnvironment(environment);
        const agentResult = agentInput === undefined ? undefined : await runJevAgent({ task: 'Check the guardrail-approved sample before continuing.', action: agentInput, jev: client, environment, signal: requestSignal });
        return { requestedEngine, engine: client.mode === 'live' ? 'jev' : 'mock', answer: { guardrails: result, received: agentInput === undefined ? null : { engine: 'jev', mode: client.mode === 'live' ? 'live' : 'mock', text: agentInput, response: agentResult?.steps.at(-1)?.message ?? 'Jev checked the guarded sample.' } }, confidence: {}, latencyMs: 0, ...(client.mode === 'live' ? {} : { fallback: { reason: 'unconfigured' as const } }) };
      };
      const execution = selection === 'compare'
        ? { mode: 'compare' as const, results: Object.fromEntries(await Promise.all((['jev', 'decider'] as const).map(async (requestedEngine) => [requestedEngine, await run(requestedEngine)]))) }
        : { mode: 'single' as const, result: await run(selection) };
      if (!requestSignal.aborted) sendJson(response, 200, {
        requestId,
        mode: getRuntimeMode(environment),
        execution,
      });
    } catch (error) {
      if (!requestSignal.aborted) {
        const message = error instanceof TypeError ? error.message : 'Request body must be valid JSON.';
        sendJson(response, 400, { requestId, error: { code: 'VALIDATION_ERROR', message } });
      }
    }
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD' && !(request.method === 'POST' && (requestUrl.pathname === '/api/triage' || requestUrl.pathname === '/api/threshold/evaluate' || requestUrl.pathname === '/api/decision-pipeline/run' || requestUrl.pathname === '/api/use-cases/content-moderation/run' || requestUrl.pathname === '/api/use-cases/pii-phi-guardrails/run' || requestUrl.pathname === '/api/use-cases/jev-agent/run'))) {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }
  if (requestUrl.pathname === '/healthz') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }
  if (requestUrl.pathname === '/api/mode') {
    sendJson(response, 200, { mode: getRuntimeMode(environment) });
    return;
  }
  if (requestUrl.pathname === '/api/decision-pipeline/run') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }
    try {
      const body = await readJson(request);
      if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('Provide an item and threshold.');
      const input = body as { item?: unknown; threshold?: unknown; engine?: unknown; compare?: unknown };
      if (typeof input.item !== 'string' || typeof input.threshold !== 'number') throw new TypeError('Provide an item and threshold.');
      const selection = requestedEngine(input.engine, input.compare);
      const result = await runDecisionPipeline({ item: input.item, threshold: input.threshold });
      const jevRun = async (): Promise<EngineRun> => {
        const client = createJevClient({ mode: getRuntimeMode(environment), apiKey: environment.TYPESAFE_API_KEY, runtime: { nodeEnv: environment.NODE_ENV, ci: environment.CI === 'true' } });
        const evaluated = client.mode === 'live' ? await client.evaluate(buildJevRequest(`Evaluate the decision pipeline item: ${input.item}`, {
          safety: choice('Should the item pass the safety gate?', { allow: 'The item is safe.', block: 'The item is unsafe.' }),
          quality: choice('Does the item pass the quality gate?', { pass: 'The item is clear and supported.', review: 'The item needs human review.' }),
        })) : undefined;
        return { requestedEngine: 'jev', engine: client.mode === 'live' ? 'jev' : 'mock', answer: { ...result, ...(evaluated ? { jevDecision: evaluated } : {}) }, confidence: {}, latencyMs: 0, ...(client.mode === 'live' ? {} : { fallback: { reason: 'unconfigured' as const } }) };
      };
      const execution = selection === 'compare'
        ? { mode: 'compare' as const, results: { jev: await jevRun(), decider: await runDecider('decision-pipeline', input, environment) } }
        : selection === 'decider'
          ? { mode: 'single' as const, result: await runDecider('decision-pipeline', input, environment) }
          : { mode: 'single' as const, result: await jevRun() };
      const selectedJeV = selection === 'jev' ? execution.mode === 'single' ? execution.result : undefined : undefined;
      sendJson(response, 200, { ...(selection === 'jev' ? { ...result, mode: getRuntimeMode(environment), jevDecision: selectedJeV?.answer } : {}), execution });
    } catch (error) {
      const message = error instanceof TypeError || error instanceof Error ? error.message : 'Pipeline request is invalid.';
      sendJson(response, 400, { error: message });
    }
    return;
  }
  if (requestUrl.pathname === '/api/threshold/evaluate') {
    if (request.method !== 'POST') { sendJson(response, 405, { error: 'Method not allowed' }); return; }
    try {
      const body = await readJson(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('Provide confidence and thresholds.');
      const input = body as { confidence?: unknown; allowThreshold?: unknown; blockThreshold?: unknown; scenario?: unknown; engine?: unknown; compare?: unknown };
      if (![input.confidence, input.allowThreshold, input.blockThreshold].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)) throw new TypeError('Provide confidence and thresholds between 0 and 1.');
      const selection = requestedEngine(input.engine, input.compare);
      const payload = { scenario: typeof input.scenario === 'string' ? input.scenario : 'synthetic scenario', confidence: input.confidence, allowThreshold: input.allowThreshold, blockThreshold: input.blockThreshold };
      const decider = () => runDecider('threshold-playground', payload, environment);
      const jev = async (): Promise<EngineRun> => {
        const client = createJevClient({ mode: getRuntimeMode(environment), apiKey: environment.TYPESAFE_API_KEY, runtime: { nodeEnv: environment.NODE_ENV, ci: environment.CI === 'true' } });
        const result = await client.evaluate(buildJevRequest(`Synthetic confidence ${input.confidence}; allow cutoff ${input.allowThreshold}; block cutoff ${input.blockThreshold}.`, { decision: choice('How should the threshold playground route this synthetic case?', { allow: 'Confidence meets the allow cutoff.', block: 'Confidence is below the block cutoff.', review: 'Confidence falls between cutoffs and needs review.' }) }));
        return { requestedEngine: 'jev', engine: client.mode === 'live' ? 'jev' : 'mock', answer: result.decision, confidence: result.decision.probabilities, explanation: result.decision.value, latencyMs: 0, ...(client.mode === 'live' ? {} : { fallback: { reason: 'unconfigured' as const } }) };
      };
      const execution = selection === 'compare'
        ? { mode: 'compare' as const, results: { jev: await jev(), decider: await decider() } }
        : { mode: 'single' as const, result: selection === 'jev' ? await jev() : await decider() };
      sendJson(response, 200, { execution });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Threshold request is invalid.' });
    }
    return;
  }
  if (requestUrl.pathname === '/api/triage') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (Buffer.concat(chunks).byteLength > 16_384) {
        sendJson(response, 413, { error: 'Ticket description is too long.' });
        return;
      }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const input = typeof body === 'object' && body !== null && !Array.isArray(body) ? body as { ticket?: unknown; engine?: unknown; compare?: unknown } : {};
      const ticket = typeof input.ticket === 'string' ? input.ticket : '';
      const selection = requestedEngine(input.engine, input.compare);
      const mode = getRuntimeMode(environment);
      const client = createJevClient({ mode, apiKey: environment.TYPESAFE_API_KEY });
      const jev = selection === 'decider' ? undefined : await triageTicket(ticket, client);
      const decider = selection === 'jev' ? undefined : await runDecider('triage', { ticket }, environment);
      const execution = selection === 'compare'
        ? { mode: 'compare' as const, results: { jev: { requestedEngine: 'jev', engine: 'jev', answer: jev }, decider } }
        : { mode: 'single' as const, result: selection === 'jev' ? { requestedEngine: 'jev', engine: 'jev', answer: jev } : decider };
      sendJson(response, 200, { ...(selection === 'jev' ? jev : {}), execution });
    } catch (error) {
      const message = error instanceof JevError
        ? error.message
        : error instanceof Error && error.message.startsWith('Enter a ticket')
          ? error.message
        : 'Unable to triage ticket. Please retry or assign it manually.';
      sendJson(response, 400, { error: message });
    }
    return;
  }
  if (requestUrl.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }
  serveClient(request, response, requestUrl.pathname);
}

export function createServer(environment: NodeJS.ProcessEnv = process.env): Server {
  return createHttpServer((request, response) => {
    void handleRequest(request, response, environment).catch(() => {
      if (!response.headersSent) sendJson(response, 500, { error: { code: 'INTERNAL_ERROR', message: 'Request could not be completed.' } });
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const port = Number(process.env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  const server = createServer();
  server.listen(port, '0.0.0.0', () => {
    process.stdout.write(`Jev showcase listening on port ${port}\n`);
  });
}
