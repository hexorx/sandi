import { Agent } from '@strands-agents/sdk';
import { describe, expect, it, vi } from 'vitest';
import { OllamaModel } from './ollama-model.js';
import { createDeciderFromEnvironment } from './decider.js';

describe('Strands decider adapter', () => {
  it('uses the configured Ollama model when live configuration is present', () => {
    const decider = createDeciderFromEnvironment({
      OLLAMA_BASE_URL: 'http://ollama.internal:11434',
      OLLAMA_MODEL: 'local-model',
    });

    expect(decider).toBeInstanceOf(Agent);
    expect(decider.model).toBeInstanceOf(OllamaModel);
    expect(decider.model.getConfig()).toMatchObject({ modelId: 'local-model' });
  });

  it('uses a scripted Strands model when no Ollama configuration is provided', () => {
    const decider = createDeciderFromEnvironment({});

    expect(decider).toBeInstanceOf(Agent);
    expect(decider.model).not.toBeInstanceOf(OllamaModel);
  });

  it('sends a decider invocation through the configured Ollama model', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      message: { role: 'assistant', content: 'shipping' },
      done: true,
      prompt_eval_count: 4,
      eval_count: 2,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const decider = createDeciderFromEnvironment({
      OLLAMA_BASE_URL: 'http://ollama.internal:11434',
      OLLAMA_MODEL: 'local-model',
    }, { fetch: fetchMock });

    await decider.invoke('Classify this as billing, shipping, or account: package delayed');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://ollama.internal:11434/api/chat');
  });
});
