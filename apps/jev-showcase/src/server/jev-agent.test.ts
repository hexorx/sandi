import {
  Model,
  ModelContentBlockDeltaEvent,
  ModelContentBlockStartEvent,
  ModelContentBlockStopEvent,
  ModelMessageStartEvent,
  ModelMessageStopEvent,
  type BaseModelConfig,
  type ModelStreamEvent,
} from '@strands-agents/sdk';
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

class RepeatingToolModel extends Model<BaseModelConfig> {
  updateConfig(): void {}
  getConfig(): BaseModelConfig { return { modelId: 'repeating-tool' }; }
  async *stream(): AsyncIterable<ModelStreamEvent> {
    yield new ModelMessageStartEvent({ type: 'modelMessageStartEvent', role: 'assistant' });
    yield new ModelContentBlockStartEvent({ type: 'modelContentBlockStartEvent', start: { type: 'toolUseStart', name: 'jev_gated_action', toolUseId: crypto.randomUUID() } });
    yield new ModelContentBlockDeltaEvent({ type: 'modelContentBlockDeltaEvent', delta: { type: 'toolUseInputDelta', input: '{}' } });
    yield new ModelContentBlockStopEvent({ type: 'modelContentBlockStopEvent' });
    yield new ModelMessageStopEvent({ type: 'modelMessageStopEvent', stopReason: 'toolUse' });
  }
}

describe('Jev gated agent action', () => {
  it('consults Jev before simulating an allowed action and returns an ordered trace', async () => {
    const jev = client('yes', 0.94);
    const result = await runJevAgent({ task: 'Prepare a workspace export', action: 'Create an export link', jev, threshold: 0.8 });

    expect(jev.evaluate).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      outcome: 'acted', confidence: 0.94,
      steps: [{ kind: 'task' }, { kind: 'plan' }, { kind: 'jev-check', probabilities: { yes: 0.94, no: 0.06 } }, { kind: 'action', status: 'simulated' }, { kind: 'result' }],
    });
  });

  it('refuses when Jev denies or confidence is below the threshold', async () => {
    const result = await runJevAgent({ task: 'Prepare a workspace export', action: 'Create an export link', jev: client('yes', 0.61), threshold: 0.8 });
    expect(result.outcome).toBe('refused');
    expect(result.steps.some((step) => step.kind === 'action')).toBe(false);
    expect(result.steps.at(-1)?.message).toMatch(/confidence/i);
  });

  it('returns a safe error trace when Jev is unavailable and never simulates or retries', async () => {
    const jev: JevClient = { mode: 'mock', evaluate: vi.fn().mockRejectedValue(new Error('provider detail')) as unknown as JevClient['evaluate'] };
    const result = await runJevAgent({ task: 'Prepare a workspace export', action: 'Create an export link', jev, threshold: 0.8 });
    expect(result.outcome).toBe('error');
    expect(jev.evaluate).toHaveBeenCalledOnce();
    expect(result.steps.some((step) => step.kind === 'action')).toBe(false);
    expect(JSON.stringify(result)).not.toContain('provider detail');
  });

  it('caps repeated tool use at five agent turns', async () => {
    const jev = client('yes', 0.94);
    const result = await runJevAgent({ task: 'Prepare export', action: 'Create link', jev, model: new RepeatingToolModel() });
    expect(jev.evaluate).toHaveBeenCalledTimes(5);
    expect(result.outcome).toBe('error');
    expect(result.steps.at(-1)?.message).toMatch(/maximum of 5 turns/i);
  });

  it('passes cancellation to Jev when the request is aborted', async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const jev: JevClient = {
      mode: 'mock',
      evaluate: vi.fn((_request, options) => {
        receivedSignal = options?.signal;
        return new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
      }) as unknown as JevClient['evaluate'],
    };
    const running = runJevAgent({ task: 'Prepare export', action: 'Create link', jev, signal: controller.signal });
    await vi.waitFor(() => expect(receivedSignal).toBeDefined());
    controller.abort();
    const result = await running;
    expect(receivedSignal?.aborted).toBe(true);
    expect(result.outcome).toBe('error');
  });

  it('stops Jev evaluation when the overall timeout expires', async () => {
    let receivedSignal: AbortSignal | undefined;
    const jev: JevClient = {
      mode: 'mock',
      evaluate: vi.fn((_request, options) => {
        receivedSignal = options?.signal;
        return new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
      }) as unknown as JevClient['evaluate'],
    };
    const result = await runJevAgent({ task: 'Prepare export', action: 'Create link', jev, timeoutMs: 20 });
    expect(receivedSignal?.aborted).toBe(true);
    expect(result.outcome).toBe('error');
  });
});
