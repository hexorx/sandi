import { describe, expect, it } from 'vitest';
import { createJevClient, type JevClient } from '@sandi/jev';
import { sampleToolCalls } from './tool-calls.js';
import { decideToolCall } from './tool-safety.js';

describe('tool-call safety gate', () => {
  it('ships safe, dangerous and borderline examples', () => {
    expect(sampleToolCalls.length).toBeGreaterThanOrEqual(6);
    expect(new Set(sampleToolCalls.map(({ risk }) => risk))).toEqual(new Set(['safe', 'dangerous', 'borderline']));
  });

  it('returns an explainable deterministic mock decision and its probabilities', async () => {
    const result = await decideToolCall(sampleToolCalls[0]!, { client: createJevClient({ mode: 'mock' }) });

    expect(result.mode).toBe('mock');
    expect(result.probabilities.allow).toBeGreaterThanOrEqual(0);
    expect(result.probabilities.block).toBeGreaterThanOrEqual(0);
    expect(result.reason).toBeTruthy();
  });

  it('routes uncertain results to review', async () => {
    const client = {
      mode: 'mock' as const,
      evaluate: async () => ({
        allowed: { value: 'yes', probabilities: { yes: 0.51, no: 0.49 } },
        action: { value: 'allow', probabilities: { allow: 0.51, block: 0.49 } },
      }),
    } as unknown as JevClient;
    const result = await decideToolCall(sampleToolCalls[0]!, { client });
    expect(result.decision).toBe('review');
    expect(result.reason).toMatch(/confidence/i);
  });

  it('surfaces provider errors as a safe error result', async () => {
    const client = { mode: 'live' as const, evaluate: async () => { throw new Error('private upstream detail'); } } as unknown as JevClient;
    await expect(decideToolCall(sampleToolCalls[0]!, { client })).rejects.toThrow('Safety decision is unavailable');
  });
});
