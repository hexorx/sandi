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

  it('runs the scripted agent offline and returns the Jev decision trace', async () => {
    const response = await fetch(`${await listen()}/api/use-cases/jev-agent/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'Prepare an export', action: 'Create an export link' }),
    });

    expect(response.status).toBe(200);
    const result = await response.json() as { agentMode: string; outcome: string; steps: Array<{ kind: string }> };
    expect(result.agentMode).toBe('scripted');
    expect(result.steps.map((step) => step.kind)).toContain('jev-check');
    expect(result.steps.map((step) => step.kind)).toContain('result');
    expect(result.steps.some((step) => step.kind === 'action')).toBe(result.outcome === 'acted');
  });

  it('rejects malformed agent input with a safe validation message', async () => {
    const response = await fetch(`${await listen()}/api/use-cases/jev-agent/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task: '', action: 'Create an export link' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Task and proposed action must be between 1 and 1000 characters.' });
  });
});
