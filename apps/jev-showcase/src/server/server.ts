import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDecisionReceiptLog, runDecisionPipeline } from './decision-pipeline.js';

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
  let body = '';
  for await (const chunk of request) {
    body += chunk.toString();
    if (body.length > 16_384) throw new Error('Request is too large.');
  }
  return JSON.parse(body) as unknown;
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, environment: NodeJS.ProcessEnv): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  if (requestUrl.pathname === '/healthz') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }
    sendJson(response, 200, { status: 'ok' });
    return;
  }
  if (requestUrl.pathname === '/api/mode') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }
    sendJson(response, 200, { mode: getRuntimeMode(environment) });
    return;
  }
  if (requestUrl.pathname === '/api/decision-pipeline/run') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }
    if (getRuntimeMode(environment) === 'live') {
      sendJson(response, 503, { error: 'Live decision pipeline is not configured. Switch to mock mode or configure the pipeline provider.' });
      return;
    }
    try {
      const body = await readJson(request);
      if (!body || typeof body !== 'object' || !('item' in body) || !('threshold' in body)) {
        sendJson(response, 400, { error: 'Provide an item and threshold.' });
        return;
      }
      const result = await runDecisionPipeline({ item: body.item as string, threshold: body.threshold as number });
      sendJson(response, 200, { ...result, receipts: getDecisionReceiptLog(), mode: 'mock' });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Pipeline request is invalid.' });
    }
    return;
  }
  if (requestUrl.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }
  serveClient(request, response, requestUrl.pathname);
}

export function createServer(environment: NodeJS.ProcessEnv = process.env): Server {
  return createHttpServer((request, response) => { void handleRequest(request, response, environment); });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const port = Number(process.env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  const server = createServer();
  server.listen(port, '0.0.0.0', () => {
    process.stdout.write(`Jev showcase listening on port ${port}\n`);
  });
}
