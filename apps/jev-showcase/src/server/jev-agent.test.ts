import { describe, expect, it, vi } from 'vitest';
import type { JevClient } from '@sandi/jev';
import { runJevAgent } from './jev-agent.js';

function client(answer: 'yes' | 'no', confidence: number): JevClient {
  return {
    mode: 'mock',
    evaluate: vi.fn(async () => ({
      safe: { value: answer, probabilities: { yes: confidence, no: Number((1 - confidence).toFixed(2)) } },
    })) as unknown as JevClient['evaluate'],
  };
}

describe('Jev gated agent action', () => {
  it('consults Jev before simulating an allowed action and returns an ordered trace', async () => {
    const jev = client('yes', 0.94);
    const result = await runJevAgent({
      task: 'Prepare a workspace export',
      action: 'Create an export link',
      jev,
      threshold: 0.8,
    });

    expect(jev.evaluate).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      outcome: 'acted',
      confidence: 0.94,
      steps: [
        { kind: 'task' },
        { kind: 'plan' },
        { kind: 'jev-check', probabilities: { yes: 0.94, no: 0.06 } },
        { kind: 'action', status: 'simulated' },
        { kind: 'result' },
      ],
    });
  });

  it('refuses when Jev denies or confidence is below the threshold', async () => {
    const result = await runJevAgent({
      task: 'Prepare a workspace export',
      action: 'Create an export link',
      jev: client('yes', 0.61),
      threshold: 0.8,
    });

    expect(result.outcome).toBe('refused');
    expect(result.steps.some((step) => step.kind === 'action')).toBe(false);
    expect(result.steps.at(-1)?.message).toMatch(/confidence/i);
  });

  it('returns a safe error trace when Jev is unavailable and never simulates the action', async () => {
    const jev: JevClient = {
      mode: 'mock',
      evaluate: vi.fn().mockRejectedValue(new Error('provider detail')) as unknown as JevClient['evaluate'],
    };
    const result = await runJevAgent({
      task: 'Prepare a workspace export',
      action: 'Create an export link',
      jev,
      threshold: 0.8,
    });

    expect(result.outcome).toBe('error');
    expect(result.steps.some((step) => step.kind === 'action')).toBe(false);
    expect(JSON.stringify(result)).not.toContain('provider detail');
  });
});
