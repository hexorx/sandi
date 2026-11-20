import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from './server.js';

let activeServer: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  if (activeServer?.listening) {
    await new Promise<void>((resolve, reject) => {
      activeServer?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  activeServer = undefined;
});

async function listen(): Promise<string> {
  activeServer = createServer({});
  await new Promise<void>((resolve) => activeServer?.listen(0, '127.0.0.1', resolve));
  const address = activeServer.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
  return `http://127.0.0.1:${address.port}`;
}

describe('jev showcase server', () => {
  it('returns 200 from the health endpoint', async () => {
    const response = await fetch(`${await listen()}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('defaults to mock mode when no live configuration is present', async () => {
    const response = await fetch(`${await listen()}/api/mode`);
    expect(await response.json()).toEqual({ mode: 'mock' });
  });

  it('stays in mock mode when live mode has no runtime key', async () => {
    activeServer = createServer({ JEV_MODE: 'live' });
    await new Promise<void>((resolve) => activeServer?.listen(0, '127.0.0.1', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/mode`);
    expect(await response.json()).toEqual({ mode: 'mock' });
  });

  it('selects live mode only when explicitly enabled with a runtime key', async () => {
    activeServer = createServer({ JEV_MODE: 'live', TYPESAFE_API_KEY: 'x' });
    await new Promise<void>((resolve) => activeServer?.listen(0, '127.0.0.1', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/mode`);
    expect(await response.json()).toEqual({ mode: 'live' });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('returns an offline tool-safety decision with probabilities', async () => {
    const response = await fetch(`${await listen()}/api/tool-safety/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ toolCallId: 'read-status' }),
    });
    expect(response.status).toBe(200);
    const result = await response.json() as { mode: string; decision: string; probabilities: Record<string, number>; reason: string };
    expect(result.mode).toBe('mock');
    expect(['allow', 'block', 'review']).toContain(result.decision);
    expect(result.probabilities.allow + result.probabilities.block).toBeCloseTo(1);
    expect(result.reason).toBeTruthy();
  });

  it('rejects unknown tool calls with a safe validation error', async () => {
    const response = await fetch(`${await listen()}/api/tool-safety/evaluate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toolCallId: 'unknown' }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Choose a valid sample tool call.' });
  });

  it('forces mock mode for tests even when live settings are present', async () => {
    activeServer = createServer({ JEV_MODE: 'live', TYPESAFE_API_KEY: 'test-only', NODE_ENV: 'test' });
    await new Promise<void>((resolve) => activeServer?.listen(0, '127.0.0.1', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/mode`);
    expect(await response.json()).toEqual({ mode: 'mock' });
  });
});
