import React, { useState } from 'react';
import { sampleToolCalls } from '../server/tool-calls.js';
import toolSafetySource from '../server/tool-safety.ts?raw';
import { currentEngineSelection } from './engine-switch.js';

interface ToolSafetyResponse {
  mode: 'mock' | 'replay' | 'live';
  decision: 'allow' | 'block' | 'review';
  probabilities: { allow: number; block: number };
  reason: string;
  execution?: unknown;
}

export function ToolSafetyPage() {
  const [selectedId, setSelectedId] = useState(sampleToolCalls[0]!.id);
  const [result, setResult] = useState<ToolSafetyResponse>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = sampleToolCalls.find(({ id }) => id === selectedId)!;

  async function evaluate(): Promise<void> {
    setBusy(true);
    setError('');
    setResult(undefined);
    try {
      const response = await fetch('/api/tool-safety/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toolCallId: selectedId, ...currentEngineSelection() }),
      });
      const payload = await response.json() as ToolSafetyResponse & { error?: string; execution?: unknown };
      if ('execution' in payload) window.dispatchEvent(new CustomEvent('sandi-engine-result', { detail: payload.execution }));
      if (!response.ok) throw new Error(payload.error);
      setResult(payload.execution ? { mode: 'mock', decision: 'review', probabilities: { allow: 0, block: 0 }, reason: 'See the selected engine result above.', execution: payload.execution } : payload);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'Safety decision is unavailable. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pb-20 pt-12 lg:px-10">
      <a href="/" className="text-sm font-medium text-brand">← All examples</a>
      <section className="mt-8 max-w-3xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-brand">Use case 01 · Tool safety</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Should this tool call run?</h1>
        <p className="mt-4 text-lg leading-8 text-muted">Choose a proposed action. Jev estimates whether it should be allowed, blocked, or sent for human review.</p>
      </section>
      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]" aria-label="Tool safety evaluation">
        <article className="rounded-card border border-line bg-surface p-6 shadow-card">
          <label htmlFor="tool-call" className="text-sm font-semibold">Proposed tool call</label>
          <select id="tool-call" data-testid="tool-safety-select" className="mt-3 w-full rounded-xl border border-line bg-elevated p-3 text-sm" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {sampleToolCalls.map((toolCall) => <option key={toolCall.id} value={toolCall.id}>{toolCall.tool} · {toolCall.action}</option>)}
          </select>
          <p className="mt-3 text-sm leading-6 text-muted">{selected.description}</p>
          <span className="mt-5 inline-flex rounded-pill border border-line px-2.5 py-1 text-xs capitalize text-muted">{selected.risk} example</span>
          <button type="button" data-testid="tool-safety-evaluate" className="mt-7 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 disabled:opacity-60" onClick={() => void evaluate()} disabled={busy}>
            {busy ? 'Evaluating…' : 'Evaluate tool call'}
          </button>
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
          {result?.execution !== undefined ? <pre className="mt-6 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-white" data-testid="engine-compare-result">{JSON.stringify(result.execution, null, 2)}</pre> : null}
          {result && 'decision' in result && <div className="mt-6 rounded-xl border border-line bg-canvas p-5" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <h2 data-testid="tool-safety-decision" className="text-xl font-semibold">{result.decision.toUpperCase()}</h2>
              <span data-testid="tool-safety-mode" className="rounded-pill border border-line bg-elevated px-3 py-1 text-xs font-semibold">{result.mode.toUpperCase()}</span>
            </div>
            <p data-testid="tool-safety-reason" className="mt-3 text-sm leading-6 text-muted">{result.reason}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <p>Allow <strong data-testid="tool-safety-probability-allow">{Math.round(result.probabilities.allow * 100)}%</strong></p>
              <p>Block <strong data-testid="tool-safety-probability-block">{Math.round(result.probabilities.block * 100)}%</strong></p>
            </div>
          </div>}
        </article>

        <article className="rounded-card border border-line bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold">The gate behind the decision</h2>
          <p className="mt-2 text-sm leading-6 text-muted">This is the same server module used by the endpoint. It builds Jev’s questions and applies the confidence threshold.</p>
          <pre data-testid="tool-safety-code" className="mt-5 max-h-[34rem] overflow-auto rounded-xl bg-slate-950 p-5 text-xs leading-6 text-slate-100"><code>{toolSafetySource}</code></pre>
        </article>
      </section>
    </main>
  );
}
