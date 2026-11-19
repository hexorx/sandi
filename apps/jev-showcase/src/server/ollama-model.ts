import {
  Model,
  ModelContentBlockDeltaEvent,
  ModelContentBlockStartEvent,
  ModelContentBlockStopEvent,
  ModelMessageStartEvent,
  ModelMessageStopEvent,
  Message,
  type BaseModelConfig,
  type ModelStreamEvent,
  type StreamOptions,
  type ToolSpec,
} from '@strands-agents/sdk';
import type { SystemPrompt } from '@strands-agents/sdk';

interface OllamaModelConfig extends BaseModelConfig {
  baseUrl: string;
}

interface OllamaModelOptions extends OllamaModelConfig {
  fetch?: typeof fetch;
}

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

interface OllamaChatResponse {
  message: { role: 'assistant'; content: string; tool_calls?: OllamaToolCall[] };
  prompt_eval_count?: number;
  eval_count?: number;
}

type ModelSelection = { kind: 'scripted' } | { kind: 'ollama'; model: OllamaModel };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asText(content: SystemPrompt | undefined): string | undefined {
  if (typeof content === 'string') return content;
  if (!content) return undefined;
  const text = content.flatMap((block) => ('text' in block ? [block.text] : [])).join('\n');
  return text || undefined;
}

function ollamaMessages(messages: Message[], systemPrompt?: SystemPrompt): Array<Record<string, unknown>> {
  const formatted: Array<Record<string, unknown>> = [];
  const system = asText(systemPrompt);
  if (system) formatted.push({ role: 'system', content: system });

  for (const message of messages) {
    const text: string[] = [];
    const toolCalls: Array<Record<string, unknown>> = [];
    for (const rawBlock of message.content as unknown[]) {
      if (!isRecord(rawBlock)) continue;
      const block = rawBlock;
      if (typeof block.text === 'string') text.push(block.text);
      else if (isRecord(block.toolUse) && typeof block.toolUse.toolUseId === 'string' && typeof block.toolUse.name === 'string') {
        toolCalls.push({
          id: block.toolUse.toolUseId,
          type: 'function',
          function: { name: block.toolUse.name, arguments: block.toolUse.input },
        });
      } else if (isRecord(block.toolResult)) {
        const toolResult = block.toolResult;
        formatted.push({
          role: 'tool',
          content: Array.isArray(toolResult.content) ? toolResult.content.map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : JSON.stringify(part))).join('\n') : '',
        });
      }
    }
    if (text.length || toolCalls.length) {
      formatted.push({ role: message.role, ...(text.length ? { content: text.join('\n') } : {}), ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
    }
  }
  return formatted;
}

function toOllamaTools(toolSpecs: ToolSpec[] | undefined): Array<Record<string, unknown>> | undefined {
  if (!toolSpecs?.length) return undefined;
  return toolSpecs.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema ?? { type: 'object', properties: {} },
    },
  }));
}

function isOllamaChatResponse(value: unknown): value is OllamaChatResponse {
  if (!isRecord(value) || !isRecord(value.message) || value.message.role !== 'assistant' || typeof value.message.content !== 'string') return false;
  if (value.message.tool_calls === undefined) return true;
  return Array.isArray(value.message.tool_calls) && value.message.tool_calls.every((call) =>
    isRecord(call) && isRecord(call.function) && typeof call.function.name === 'string' && isRecord(call.function.arguments));
}

export class OllamaModel extends Model<OllamaModelConfig> {
  private readonly requestFetch: typeof fetch;
  private config: OllamaModelConfig;

  constructor(options: OllamaModelOptions) {
    super();
    this.config = { baseUrl: options.baseUrl.replace(/\/+$/, ''), modelId: options.modelId, temperature: options.temperature, topP: options.topP, maxTokens: options.maxTokens, contextWindowLimit: options.contextWindowLimit };
    this.requestFetch = options.fetch ?? fetch;
  }

  updateConfig(modelConfig: OllamaModelConfig): void {
    this.config = { ...this.config, ...modelConfig };
  }

  getConfig(): OllamaModelConfig {
    return { ...this.config };
  }

  async *stream(messages: Message[], options: StreamOptions = {}): AsyncIterable<ModelStreamEvent> {
    const tools = toOllamaTools(options.toolSpecs);
    const toolChoice = options.toolChoice;
    const requestBody = {
      model: this.config.modelId,
      messages: ollamaMessages(messages, options.systemPrompt),
      stream: false,
      ...(tools ? { tools } : {}),
      ...(toolChoice && 'tool' in toolChoice ? { tool_choice: { type: 'function', function: { name: toolChoice.tool.name } } } : {}),
      options: {
        ...(this.config.temperature === undefined ? {} : { temperature: this.config.temperature }),
        ...(this.config.topP === undefined ? {} : { top_p: this.config.topP }),
        ...(this.config.maxTokens === undefined ? {} : { num_predict: this.config.maxTokens }),
        ...(this.config.contextWindowLimit === undefined ? {} : { num_ctx: this.config.contextWindowLimit }),
      },
    };

    let response: Response;
    try {
      response = await this.requestFetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: options.cancelSignal,
      });
    } catch {
      throw new Error('Ollama chat request failed');
    }
    if (!response.ok) throw new Error(`Ollama chat request failed with status ${response.status}`);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Ollama returned an invalid chat response');
    }
    if (!isOllamaChatResponse(payload)) throw new Error('Ollama returned an invalid chat response');

    yield new ModelMessageStartEvent({ type: 'modelMessageStartEvent', role: 'assistant' });
    if (payload.message.content) {
      yield new ModelContentBlockStartEvent({ type: 'modelContentBlockStartEvent' });
      yield new ModelContentBlockDeltaEvent({ type: 'modelContentBlockDeltaEvent', delta: { type: 'textDelta', text: payload.message.content } });
      yield new ModelContentBlockStopEvent({ type: 'modelContentBlockStopEvent' });
    }
    for (const call of payload.message.tool_calls ?? []) {
      yield new ModelContentBlockStartEvent({ type: 'modelContentBlockStartEvent', start: { type: 'toolUseStart', name: call.function.name, toolUseId: crypto.randomUUID() } });
      yield new ModelContentBlockDeltaEvent({ type: 'modelContentBlockDeltaEvent', delta: { type: 'toolUseInputDelta', input: JSON.stringify(call.function.arguments) } });
      yield new ModelContentBlockStopEvent({ type: 'modelContentBlockStopEvent' });
    }
    yield new ModelMessageStopEvent({ type: 'modelMessageStopEvent', stopReason: payload.message.tool_calls?.length ? 'toolUse' : 'endTurn' });
  }
}

export function createModelFromEnvironment(environment: NodeJS.ProcessEnv): ModelSelection {
  if (environment.NODE_ENV === 'test') return { kind: 'scripted' };
  const baseUrl = environment.OLLAMA_BASE_URL?.trim();
  const modelId = environment.OLLAMA_MODEL?.trim();
  if (!baseUrl || !modelId) return { kind: 'scripted' };
  try {
    const endpoint = new URL(baseUrl);
    if (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') return { kind: 'scripted' };
    return { kind: 'ollama', model: new OllamaModel({ baseUrl, modelId, contextWindowLimit: 8192 }) };
  } catch {
    return { kind: 'scripted' };
  }
}
