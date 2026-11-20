import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from './server.js';

let activeServer: ReturnType<typeof createServer> | undefined;
afterEach(async () => {
  if (activeServer?.listening) await new Promise<void>((resolve, reject) => activeServer?.close((error) => error ? reject(error) : resolve()));
  activeServer = undefined;
});

async function run(body: unknown) {
  activeServer = createServer({ NODE_ENV: 'test', JEV_MODE: 'live', TYPESAFE_API_KEY: 'test-only' });
  await new Promise<void>((resolve) => activeServer?.listen(0, '127.0.0.1', resolve));
  const address = activeServer.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind');
  return fetch(`http://127.0.0.1:${address.port}/api/use-cases/pii-phi-guardrails/run`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('PII/PHI guardrail endpoint', () => {
  it('blocks sensitive input and keeps both mock engine runs offline in compare mode', async () => {
    const response = await run({ text: 'Email demo@example.invalid', policy: 'strict', engine: 'jev', compare: true });
    const payload = await response.json() as { mode: string; execution: { mode: string; results: Record<string, { answer: { guardrails: { action: string }; received: unknown }; engine: string; requestedEngine: string }> } };
    expect(response.status).toBe(200);
    expect(payload.mode).toBe('mock');
    expect(payload.execution.mode).toBe('compare');
    expect(payload.execution.results.jev.answer.guardrails.action).toBe('block');
    expect(payload.execution.results.jev.engine).toBe('mock');
    expect(payload.execution.results.decider.requestedEngine).toBe('decider');
    expect(payload.execution.results.jev.answer.received).toBeNull();
    expect(payload.execution.results.decider.answer.received).toBeNull();
  });

  it('passes only redacted text to the selected mock agent', async () => {
    const response = await run({ text: 'Call me at (202) 555-0100', policy: 'redact-medium', engine: 'decider', compare: false });
    const payload = await response.json() as { execution: { result: { answer: { received: { text: string } } } } };
    expect(payload.execution.result.answer.received.text).toBe('Call me at [REDACTED:PHONE]');
    expect(payload.execution.result.answer.received.text).not.toContain('555-0100');
  });
});
