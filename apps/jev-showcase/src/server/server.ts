import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJevClient } from '@sandi/jev';
import { findToolCall } from './tool-calls.js';
import { decideToolCall } from './tool-safety.js';

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

async function handleRequest(request: IncomingMessage, response: ServerResponse, environment: NodeJS.ProcessEnv): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  if (requestUrl.pathname === '/api/tool-safety/evaluate') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }
    try {
      const body = await readRequestBody(request);
      const toolCall = findToolCall(body.toolCallId);
      if (!toolCall) {
        sendJson(response, 400, { error: 'Choose a valid sample tool call.' });
        return;
      }
      const mode = getRuntimeMode(environment);
      const client = createJevClient({
        mode: mode === 'live' ? 'live' : 'mock',
        apiKey: mode === 'live' ? environment.TYPESAFE_API_KEY : undefined,
        runtime: { nodeEnv: environment.NODE_ENV, ci: environment.CI === 'true' },
      });
      sendJson(response, 200, await decideToolCall(toolCall, { client }));
    } catch {
      sendJson(response, 502, { error: 'Safety decision is unavailable. Try again.' });
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
  return createHttpServer((request, response) => { void handleRequest(request, response, environment); });
}

async function readRequestBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk.toString();
    if (raw.length > 16_384) throw new Error('Request body too large');
  }
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid request body');
  return parsed as Record<string, unknown>;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const port = Number(process.env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  const server = createServer();
  server.listen(port, '0.0.0.0', () => {
    process.stdout.write(`Jev showcase listening on port ${port}\n`);
  });
}
