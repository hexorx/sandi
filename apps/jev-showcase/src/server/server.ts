import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJevClient } from '@sandi/jev';
import { triageTicket } from './triage.js';

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

async function handleRequest(request: IncomingMessage, response: ServerResponse, environment: NodeJS.ProcessEnv): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  if (request.method !== 'GET' && request.method !== 'HEAD' && !(request.method === 'POST' && requestUrl.pathname === '/api/triage')) {
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
      const ticket = typeof body === 'object' && body !== null && 'ticket' in body && typeof body.ticket === 'string' ? body.ticket : '';
      const mode = getRuntimeMode(environment);
      const client = createJevClient({ mode, apiKey: environment.TYPESAFE_API_KEY });
      sendJson(response, 200, await triageTicket(ticket, client));
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith('Enter a ticket')
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
