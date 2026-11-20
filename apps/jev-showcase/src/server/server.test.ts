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

  it('runs the pipeline offline and returns receipts for skipped stages without raw input', async () => {
    const response = await fetch(`${await listen()}/api/decision-pipeline/run`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item: 'A harmful synthetic request', threshold: 0.7 }),
    });
    const payload = await response.json() as { finalAction: string; mode: string; receipts: Array<{ action: string; reason: string; inputHash: string }> };
    expect(response.status).toBe(200);
    expect(payload.mode).toBe('mock');
    expect(payload.finalAction).toBe('block');
    expect(payload.receipts).toHaveLength(3);
    expect(payload.receipts[1]?.action).toBe('skipped');
    expect(payload.receipts[1]?.reason).toContain('safety gate blocked');
    expect(JSON.stringify(payload)).not.toContain('harmful synthetic request');
  });

  it('returns a clear live-mode error rather than pretending to run the pipeline', async () => {
    activeServer = createServer({ JEV_MODE: 'live', TYPESAFE_API_KEY: 'configured' });
    await new Promise<void>((resolve) => activeServer?.listen(0, '127.0.0.1', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/decision-pipeline/run`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item: 'example', threshold: 0.5 }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: expect.stringContaining('Live decision pipeline is not configured') });
  });
});
