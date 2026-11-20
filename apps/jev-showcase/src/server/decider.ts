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
