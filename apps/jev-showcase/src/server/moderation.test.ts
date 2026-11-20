import { describe, expect, it, vi } from 'vitest';
import { evaluateModeration, runModeration } from './moderation.js';

describe('content moderation', () => {
  it('maps clear outcomes to allow or remove with policy risk scores', () => {
    expect(evaluateModeration({
      outcome: { value: 'allow', probabilities: { allow: 0.9, flag: 0.06, remove: 0.04 } },
      policyScores: { harassment: { value: 'low', probabilities: { low: 0.9, medium: 0.08, high: 0.02 } } },
    })).toMatchObject({ decision: 'approve', probabilities: { allow: 0.9 }, policyScores: { harassment: 0.1 } });
    expect(evaluateModeration({
      outcome: { value: 'remove', probabilities: { allow: 0.02, flag: 0.03, remove: 0.95 } },
      policyScores: { harassment: { value: 'high', probabilities: { low: 0.01, medium: 0.04, high: 0.95 } } },
    }).decision).toBe('remove');
  });

  it('routes low confidence outcomes to a human review band', () => {
    const result = evaluateModeration({
      outcome: { value: 'allow', probabilities: { allow: 0.41, flag: 0.34, remove: 0.25 } },
      policyScores: {},
    });
    expect(result.decision).toBe('flag');
    expect(result.reviewRequired).toBe(true);
  });

  it('returns an explicit safe error when the engine fails', async () => {
    const engine = { mode: 'live' as const, evaluate: vi.fn().mockRejectedValue(new Error('private provider detail')) };
    await expect(runModeration({ content: 'A sample post', policy: 'Be kind' }, engine)).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR', message: 'Decision unavailable. Try again.',
    });
    expect(JSON.stringify(engine.evaluate.mock.calls)).not.toContain('private provider detail');
  });
});
