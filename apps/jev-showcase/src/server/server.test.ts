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
  it('returns an offline tool-safety decision with probabilities', async () => {
    const response = await fetch(`${await listen()}/api/tool-safety/evaluate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toolCallId: 'read-status' }),
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

  it('runs the decision pipeline offline and returns request-scoped receipts without raw input', async () => {
    const baseUrl = await listen();
    const firstResponse = await fetch(`${baseUrl}/api/decision-pipeline/run`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item: 'A harmful synthetic request', threshold: 0.7 }),
    });
    const first = await firstResponse.json() as { finalAction: string; mode: string; receipts: Array<{ id: string; action: string; reason: string }> };
    expect(firstResponse.status).toBe(200);
    expect(first.mode).toBe('mock');
    expect(first.finalAction).toBe('block');
    expect(first.receipts).toHaveLength(3);
    expect(first.receipts[1]?.action).toBe('skipped');
    expect(JSON.stringify(first)).not.toContain('harmful synthetic request');

    const secondResponse = await fetch(`${baseUrl}/api/decision-pipeline/run`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item: 'A routine synthetic request', threshold: 0.7 }),
    });
    const second = await secondResponse.json() as { receipts: Array<{ id: string }> };
    expect(second.receipts).toHaveLength(3);
    expect(second.receipts.some((receipt) => first.receipts.some((previous) => previous.id === receipt.id))).toBe(false);
  });

  it('returns a safe error when a live decision pipeline is unavailable', async () => {
    activeServer = createServer({ JEV_MODE: 'live', TYPESAFE_API_KEY: 'test-only' });
    await new Promise<void>((resolve) => activeServer?.listen(0, '127.0.0.1', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/decision-pipeline/run`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item: 'example', threshold: 0.5 }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: expect.stringContaining('Live decision pipeline is not configured') });
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

  it('runs the scripted agent offline and returns the Jev decision trace', async () => {
    const response = await fetch(`${await listen()}/api/use-cases/jev-agent/run`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
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
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task: '', action: 'Create an export link' }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Task and proposed action must be between 1 and 1000 characters.' });
  });
});
