import { describe, expect, it, vi } from 'vitest';
import { Message, Model, type ModelStreamEvent, type ToolSpec } from '@strands-agents/sdk';
import { OllamaModel, createModelFromEnvironment } from './ollama-model.js';

describe('Ollama Strands model', () => {
  it('loads endpoint and model from environment, with a scripted default', () => {
    expect(createModelFromEnvironment({})).toEqual({ kind: 'scripted' });
    expect(createModelFromEnvironment({ OLLAMA_BASE_URL: 'http://ollama.internal:11434' })).toEqual({ kind: 'scripted' });
    expect(createModelFromEnvironment({ NODE_ENV: 'test', OLLAMA_BASE_URL: 'http://ollama.internal:11434', OLLAMA_MODEL: 'local-model' }))
      .toEqual({ kind: 'scripted' });
    expect(createModelFromEnvironment({ OLLAMA_BASE_URL: 'http://ollama.internal:11434', OLLAMA_MODEL: 'local-model' }))
      .toEqual({ kind: 'ollama', model: expect.any(OllamaModel) });
  });

  it('posts tool specs to /api/chat and converts the returned tool call to Strands events', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name: 'lookup_order', arguments: { order_id: '4821' } } }],
      },
      done: true,
      prompt_eval_count: 12,
      eval_count: 4,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const model = new OllamaModel({
      baseUrl: 'http://ollama.internal:11434/',
      modelId: 'local-model',
      fetch: fetchMock,
    });
    const messages = [Message.fromMessageData({ role: 'user', content: [{ text: 'Look up order 4821' }] })];
    const tools = [{ name: 'lookup_order', description: 'Look up an order', inputSchema: {
      type: 'object', properties: { order_id: { type: 'string' } }, required: ['order_id'],
    } }] satisfies ToolSpec[];
    const events: ModelStreamEvent[] = [];

    for await (const event of model.stream(messages, { toolSpecs: tools })) events.push(event);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://ollama.internal:11434/api/chat');
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      model: string;
      stream: boolean;
      tools: Array<{ function: { name: string; parameters: unknown } }>;
    };
    expect(request).toMatchObject({ model: 'local-model', stream: false });
    expect(request.tools).toEqual([{ type: 'function', function: { name: 'lookup_order', description: 'Look up an order', parameters: tools[0]!.inputSchema } }]);
    expect(events.map((event) => event.type)).toEqual([
      'modelMessageStartEvent',
      'modelContentBlockStartEvent',
      'modelContentBlockDeltaEvent',
      'modelContentBlockStopEvent',
      'modelMessageStopEvent',
    ]);
    expect(events[1]).toMatchObject({ start: { name: 'lookup_order' } });
    expect(events[2]).toMatchObject({ delta: { input: '{"order_id":"4821"}' } });
    expect(model).toBeInstanceOf(Model);
  });

  it('returns an actionable safe error for an invalid Ollama response', async () => {
    const model = new OllamaModel({
      baseUrl: 'http://ollama.internal:11434',
      modelId: 'local-model',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{"message":{}}', { status: 200 })),
    });
    const iterator = model.stream([Message.fromMessageData({ role: 'user', content: [{ text: 'hello' }] })])[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toThrow('Ollama returned an invalid chat response');
  });
});
