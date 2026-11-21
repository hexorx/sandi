import React, { useState } from 'react';
import pipelineSource from '../server/decision-pipeline.ts?raw';
import type { RuntimeMode } from './app.js';
import { currentEngineSelection } from './engine-switch.js';

interface Receipt {
  id: string;
  timestamp: string;
  stage: string;
  inputHash: string;
  action: string;
  reason: string;
  threshold: number;
  jev?: { model: string; probabilities: Record<string, number> };
}

interface PipelineResponse {
  useCase: 'decision-pipeline';
  finalAction?: string;
  mode: RuntimeMode;
  receipts?: Receipt[];
  execution?: unknown;
}

interface Props { mode: RuntimeMode; }

export function DecisionPipelinePage({ mode }: Props) {
  const [item, setItem] = useState('A routine request with clear evidence');
  const [threshold, setThreshold] = useState(0.7);
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/decision-pipeline/run', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ item, threshold, ...currentEngineSelection() }),
      });
      const payload = await response.json() as PipelineResponse | { error?: string };
      if (!response.ok) throw new Error('error' in payload ? payload.error : 'Pipeline could not run.');
      if ('execution' in payload) window.dispatchEvent(new CustomEvent('sandi-engine-result', { detail: payload.execution }));
      setResult(payload as PipelineResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pipeline could not run.');
    } finally {
      setBusy(false);
    }
  }

  function exportJson(): void {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.receipts ?? [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'decision-receipts.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  return <main className="mx-auto max-w-6xl px-6 pb-20 pt-10 lg:px-10">
    <nav className="mb-8 text-sm text-muted"><a href="/" className="text-brand">Showcase</a> / Decision pipeline</nav>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Use case 04</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Decision pipeline</h1>
        <p className="mt-3 max-w-2xl text-muted">Each gate leaves a receipt, including stages skipped after a decision.</p></div>
      <span aria-label="Runtime mode" className="rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-semibold">{mode.toUpperCase()}</span>
    </header>
    {result?.execution !== undefined ? <pre data-testid="engine-compare-result" className="mt-5 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-white">{JSON.stringify(result.execution, null, 2)}</pre> : null}
    <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-card border border-line bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold">Try the pipeline</h2>
        <label className="mt-5 block text-sm font-medium" htmlFor="pipeline-item">Synthetic items <span className="font-normal text-muted">(one per line, up to 20)</span></label>
        <textarea id="pipeline-item" data-testid="decision-input" className="mt-2 min-h-28 w-full rounded-xl border border-line p-3" value={item} onChange={(event) => setItem(event.target.value)} maxLength={10_000} />
        <label className="mt-4 flex items-center justify-between text-sm font-medium" htmlFor="pipeline-threshold">Confidence threshold <span>{Math.round(threshold * 100)}%</span></label>
        <input id="pipeline-threshold" className="mt-3 w-full" type="range" min="0" max="1" step="0.05" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
        <button data-testid="run-decision-pipeline" className="mt-5 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-blue-200" onClick={() => void run()} disabled={busy}>{busy ? 'Running…' : 'Run pipeline'}</button>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {result && <p className="mt-4 text-sm">Final action: <strong data-testid="decision-final-action">{result.finalAction ?? 'See selected engine result'}</strong></p>}
      </div>
      <section className="rounded-card border border-line bg-surface p-6 shadow-card" aria-labelledby="receipt-heading">
        <div className="flex items-center justify-between gap-4"><h2 id="receipt-heading" className="text-lg font-semibold">Decision receipts</h2>
          <button className="rounded-lg border border-line px-3 py-2 text-sm font-medium disabled:opacity-50" onClick={exportJson} disabled={!result}>Export JSON</button></div>
        {!result && <p className="mt-5 text-sm text-muted">Run the pipeline to inspect its receipt log.</p>}
        {result && <ol data-testid="decision-receipt-log" className="mt-5 space-y-3">{(result.receipts ?? []).map((receipt) => <li key={receipt.id} className="rounded-xl border border-line p-4">
          <div className="flex justify-between gap-3"><strong>{receipt.stage}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{receipt.action}</span></div>
          <p className="mt-2 text-sm text-muted">{receipt.reason}</p><p className="mt-2 font-mono text-xs text-muted">{receipt.inputHash}</p>
          <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Inspect receipt JSON</summary><pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-3 text-xs" data-testid="decision-receipt-json">{JSON.stringify(receipt, null, 2)}</pre></details>
        </li>)}</ol>}
      </section>
    </section>
    <section className="mt-8 rounded-card border border-line bg-slate-950 p-6 text-slate-100 shadow-card" aria-label="Pipeline implementation">
      <h2 className="text-lg font-semibold">Pipeline implementation</h2>
      <p className="mt-1 text-sm text-slate-300">Source from the server module that generated these receipts.</p>
      <pre className="mt-4 max-h-[32rem] overflow-auto text-xs leading-6"><code>{pipelineSource}</code></pre>
    </section>
  </main>;
}
