import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJevClientFromEnvironment, runJevAgent } from './jev-agent.js';

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
  return environment.JEV_MODE === 'live' && Boolean(environment.TYPESAFE_API_KEY) ? 'live' : 'mock';
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
    size += buffer.length;
    if (size > 16_384) throw new Error('Request body is too large');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, environment: NodeJS.ProcessEnv): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  if (request.method === 'POST' && requestUrl.pathname === '/api/use-cases/jev-agent/run') {
    let body: unknown;
    try {
      body = await readJson(request);
    } catch {
      sendJson(response, 400, { error: 'Provide a valid JSON task and action.' });
      return;
    }
    if (!isRecord(body) || typeof body.task !== 'string' || typeof body.action !== 'string' || !body.task.trim() || !body.action.trim() || body.task.length > 1000 || body.action.length > 1000) {
      sendJson(response, 400, { error: 'Task and proposed action must be between 1 and 1000 characters.' });
      return;
    }
    try {
      const result = await runJevAgent({
        task: body.task.trim(),
        action: body.action.trim(),
        jev: createJevClientFromEnvironment(environment),
        environment,
      });
      sendJson(response, 200, result);
    } catch {
      sendJson(response, 502, { error: 'The agent could not complete this run. Try again.' });
    }
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
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
  if (requestUrl.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }
  serveClient(request, response, requestUrl.pathname);
}

export function createServer(environment: NodeJS.ProcessEnv = process.env): Server {
  return createHttpServer((request, response) => {
    void handleRequest(request, response, environment).catch(() => {
      if (!response.headersSent) sendJson(response, 500, { error: 'Request could not be completed.' });
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
