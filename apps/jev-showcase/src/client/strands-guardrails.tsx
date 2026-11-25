import React, { useState } from 'react';

type Verdict = { name: string; decision: 'allow' | 'block'; details: string };
type GuardrailEvent = { stage: 'input' | 'output'; decision: 'allow' | 'block'; guardrails: Verdict[] };

export function parseSseEvents(buffer: string): Array<{ event: string; data: unknown }> {
  return buffer.split('\n\n').flatMap((frame) => {
    let event = 'message';
    let data = '';
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return [];
    try { return [{ event, data: JSON.parse(data) as unknown }]; } catch { return []; }
  });
}

export function StrandsGuardrailsPage() {
  const [prompt, setPrompt] = useState('Summarize this fictional project note in one sentence.');
  const [mock, setMock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [verdicts, setVerdicts] = useState<GuardrailEvent[]>([]);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true); setAnswer(''); setVerdicts([]); setError('');
    try {
      const response = await fetch('/api/strands-guardrails/run', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' }, body: JSON.stringify({ prompt, mock }) });
      if (!response.ok || !response.body) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? 'The guardrails example is unavailable.');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        pending = pending.replaceAll('\r\n', '\n');
        const boundary = pending.lastIndexOf('\n\n');
        if (boundary >= 0) {
          for (const message of parseSseEvents(pending.slice(0, boundary + 2))) {
            if (message.event === 'token' && message.data && typeof message.data === 'object' && 'text' in message.data && typeof message.data.text === 'string') {
              const token = message.data.text;
              setAnswer((current) => current + token);
            }
            if (message.event === 'guardrail') setVerdicts((current) => [...current, message.data as GuardrailEvent]);
          }
          pending = pending.slice(boundary + 2);
        }
        finished = done;
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The guardrails example is unavailable.'); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-6xl px-6 pb-20 pt-12 lg:px-10">
    <nav aria-label="Main navigation" className="flex flex-wrap gap-5 text-sm text-muted"><a href="/" className="hover:text-brand">Showcase</a><a href="/jev-agent" className="hover:text-brand">Jev agent</a><a href="/pii-phi-guardrails" className="hover:text-brand">PII/PHI guardrails</a></nav>
    <p className="mt-12 text-xs font-semibold uppercase tracking-[0.18em] text-brand">Use case 08 · Local guardrails</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight">Strands + LiteLLM guardrails</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">A Strands agent calls a local model through LiteLLM. Three local pattern checks report their own decisions and details as an explicit SSE <code>guardrail</code> event. Output is held until checks finish, so blocked text is not sent to the browser.</p>
    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="rounded-card border border-line bg-surface p-6 shadow-card">
        <label htmlFor="strands-prompt" className="text-sm font-medium">Prompt</label>
        <textarea id="strands-prompt" data-testid="strands-guardrails__prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} maxLength={2000} className="mt-2 w-full rounded-xl border border-line bg-elevated p-3 text-sm leading-6" />
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={mock} onChange={(event) => setMock(event.target.checked)} /> Offline mock response (no model call)</label>
        <button type="button" data-testid="strands-guardrails__run" onClick={() => void run()} disabled={busy || !prompt.trim()} className="mt-4 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Running…' : 'Run guardrails'}</button>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {answer && <div data-testid="strands-guardrails__answer" className="mt-6 rounded-xl border border-line bg-canvas p-4"><h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Agent response</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{answer}</p></div>}
      </div>
      <div className="rounded-card border border-line bg-surface p-6 shadow-card">
        <h2 className="font-semibold">Guardrail results</h2>
        <p className="mt-1 text-sm text-muted">Results arrive in the terminal SSE event after the stream is screened.</p>
        <div data-testid="strands-guardrails__results" className="mt-4 space-y-3" aria-live="polite">
          {verdicts.map((stage, stageIndex) => <section key={`${stage.stage}-${stageIndex}`} className="rounded-xl border border-line bg-canvas p-4"><h3 className="text-sm font-semibold capitalize">{stage.stage} · {stage.decision}</h3><ul className="mt-3 space-y-2">{stage.guardrails.map((guardrail) => <li key={guardrail.name} className="border-t border-line pt-2 text-sm"><p className="font-medium">{guardrail.name} · {guardrail.decision}</p><p className="mt-1 text-muted">{guardrail.details}</p></li>)}</ul></section>)}
          {!verdicts.length && <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Run an example to see the individual guardrail decisions and details.</p>}
        </div>
      </div>
    </section>
  </main>;
}
