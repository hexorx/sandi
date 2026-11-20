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

  it('triages a synthetic ticket offline and labels the response as mock', async () => {
    const response = await fetch(`${await listen()}/api/triage`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket: 'Package arrived damaged.' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: 'mock', category: { probabilities: expect.any(Object) }, urgency: { probabilities: expect.any(Object) }, queue: { probabilities: expect.any(Object) } });
  });

  it('returns a clear validation error for an empty ticket', async () => {
    const response = await fetch(`${await listen()}/api/triage`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket: '  ' }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Enter a ticket description before triage.' });
  });

  it('returns an offline moderation decision and mode metadata', async () => {
    activeServer = createServer({ NODE_ENV: 'test', JEV_MODE: 'live', TYPESAFE_API_KEY: 'test-only' });
    await new Promise<void>((resolve) => activeServer?.listen(0, '127.0.0.1', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/use-cases/content-moderation/run`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'I disagree with the release.', policy: 'Allow ordinary criticism.' }),
    });
    const payload = await response.json() as { mode: string; result: { decision: string; probabilities: Record<string, number>; policyScores: Record<string, number> } };
    expect(response.status).toBe(200);
    expect(payload.mode).toBe('mock');
    expect(payload.result.decision).toMatch(/approve|flag|remove/);
    expect(Object.keys(payload.result.probabilities)).toEqual(['allow', 'flag', 'remove']);
    expect(Object.keys(payload.result.policyScores)).toEqual(['harassment', 'threats', 'spam']);
  });

  it('returns a structured validation error for invalid moderation input', async () => {
    const response = await fetch(`${await listen()}/api/use-cases/content-moderation/run`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: '', policy: '' }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
