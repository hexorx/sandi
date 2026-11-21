import {
  Agent,
  Model,
  ModelContentBlockDeltaEvent,
  ModelContentBlockStartEvent,
  ModelContentBlockStopEvent,
  ModelMessageStartEvent,
  ModelMessageStopEvent,
  type BaseModelConfig,
  type ModelStreamEvent,
} from '@strands-agents/sdk';
import { createModelFromEnvironment } from './ollama-model.js';
import type { EngineRun, EngineSelection } from '../decision-engine-contract.js';

class ScriptedModel extends Model<BaseModelConfig> {
  private config: BaseModelConfig = { modelId: 'scripted' };

  updateConfig(config: BaseModelConfig): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): BaseModelConfig {
    return { ...this.config };
  }

  async *stream(): AsyncIterable<ModelStreamEvent> {
    yield new ModelMessageStartEvent({ type: 'modelMessageStartEvent', role: 'assistant' });
    yield new ModelContentBlockStartEvent({ type: 'modelContentBlockStartEvent' });
    yield new ModelContentBlockDeltaEvent({
      type: 'modelContentBlockDeltaEvent',
      delta: { type: 'textDelta', text: 'Mock decision ready.' },
    });
    yield new ModelContentBlockStopEvent({ type: 'modelContentBlockStopEvent' });
    yield new ModelMessageStopEvent({ type: 'modelMessageStopEvent', stopReason: 'endTurn' });
  }
}

export function createDeciderFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  options: { fetch?: typeof fetch } = {},
): Agent {
  const selection = createModelFromEnvironment(environment, options);
  const model = selection.kind === 'ollama' ? selection.model : new ScriptedModel();
  return new Agent({ model, systemPrompt: 'You are the Sandi demo decider. Follow the provided decision instructions.' });
}

export async function runDecider(
  useCase: string,
  payload: unknown,
  environment: NodeJS.ProcessEnv = process.env,
  signal?: AbortSignal,
): Promise<EngineRun> {
  const configured = Boolean(environment.OLLAMA_BASE_URL && environment.OLLAMA_MODEL);
  const agent = createDeciderFromEnvironment(environment);
  const started = Date.now();
  const response = await agent.invoke(`Evaluate this ${useCase} input. Return a concise decision with rationale. Input: ${JSON.stringify(payload)}`, { cancelSignal: signal, limits: { turns: 5 } });
  const content = (response as { toString?: () => string }).toString?.() ?? 'Mock decision ready.';
  return {
    requestedEngine: 'decider',
    engine: configured ? 'decider' : 'mock',
    answer: { decision: content },
    confidence: {},
    explanation: content,
    latencyMs: Date.now() - started,
    ...(configured ? {} : { fallback: { reason: 'unconfigured' as const } }),
  };
}

export function engineSelection(value: unknown): EngineSelection | 'compare' {
  if (value === undefined) return 'jev';
  if (value === 'jev' || value === 'decider' || value === 'compare') return value;
  throw new TypeError('Choose Jev, Decider, or Compare.');
}

export function requestedEngine(engine: unknown, compare: unknown): EngineSelection | 'compare' {
  if (compare === true) return 'compare';
  if (compare !== undefined && compare !== false) throw new TypeError('Choose single or compare mode.');
  return engineSelection(engine);
}
