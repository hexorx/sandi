import React, { useState } from 'react';
import guardrailCode from '../server/pii-phi.ts?raw';
import type { GuardrailPolicy } from '../server/pii-phi.js';
import type { EngineRun } from '../decision-engine-contract.js';

type Engine = 'jev' | 'decider';
const sampleText = 'Patient: Example Person; SSN: 123-45-6789; MRN: DEMO-MRN-0001; DOB: 2000-01-01; demo@example.invalid; (202) 555-0100; 123 Example St; Diagnosis: Example condition';

interface GuardrailAnswer {
  guardrails: { action: string; findings: Array<{ category: string; start: number; end: number; confidence: string }>; redactedText?: string; reasonCode: string };
  received: { engine: Engine; mode: 'mock'; text: string; response: string } | null;
}
type RunResult = EngineRun & { answer: GuardrailAnswer };

export function PiiPhiGuardrailsPage() {
  const [text, setText] = useState(sampleText);
  const [policy, setPolicy] = useState<GuardrailPolicy>('strict');
  const [engine, setEngine] = useState<Engine>('jev');
  const [compare, setCompare] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function evaluate() {
    setError(''); setResult(null); setLoading(true);
    try {
      const response = await fetch('/api/use-cases/pii-phi-guardrails/run', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, policy, engine, compare }),
      });
      const payload = await response.json() as { execution?: unknown; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? 'Guardrail check failed. Try again.');
      setResult(payload.execution);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Guardrail check failed. Try again.'); }
    finally { setLoading(false); }
  }

  const execution = result as { mode?: unknown; results?: Record<string, RunResult>; result?: RunResult } | null;
  const runs: Array<[string, RunResult]> = execution?.mode === 'compare' && execution.results
    ? Object.entries(execution.results)
    : execution?.result
      ? [[execution.result.requestedEngine ?? engine, execution.result]]
      : [];

  return <div className="min-h-screen bg-canvas text-ink">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
      <a className="font-semibold" href="/">Jev <span className="font-normal text-muted">Showcase</span></a>
      <nav aria-label="Main navigation" className="flex gap-5 text-sm text-muted"><a href="/tool-safety">Tool safety</a><a href="/content-moderation">Content moderation</a><a href="/pii-phi-guardrails">PII/PHI guardrails</a></nav>
      <span data-testid="app__mode-badge" className="rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted">MOCK</span>
    </header>
    <main className="mx-auto grid max-w-6xl gap-8 px-6 pb-20 pt-8 lg:grid-cols-[1fr_0.9fr] lg:px-10">
      <section className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Use case 07 · Safety</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">PII/PHI guardrails</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Synthetic examples only. Detection is heuristic. Passing this check does not make real information safe to share. The detector and mock agent run locally.</p>
        <label htmlFor="guardrail-input" className="mt-6 block text-sm font-medium">Synthetic prompt</label>
        <textarea id="guardrail-input" data-testid="pii-phi__input" value={text} onChange={(event) => setText(event.target.value)} rows={7} maxLength={5000} className="mt-2 w-full rounded-xl border border-line bg-white p-3 text-sm leading-6 focus:outline-none focus:ring-4 focus:ring-blue-100" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Policy<select data-testid="pii-phi__policy" value={policy} onChange={(event) => setPolicy(event.target.value as GuardrailPolicy)} className="mt-2 block w-full rounded-lg border border-line bg-white p-2"><option value="strict">Strict: block every finding</option><option value="redact-medium">Redact medium confidence</option></select></label>
          <label className="text-sm font-medium">Mock agent<select data-testid="pii-phi__engine" value={engine} onChange={(event) => setEngine(event.target.value as Engine)} className="mt-2 block w-full rounded-lg border border-line bg-white p-2"><option value="jev">Jev</option><option value="decider">Decider</option></select></label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm"><input data-testid="pii-phi__compare" type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} />Compare Jev and Decider mock runs</label>
        <button type="button" data-testid="pii-phi__run" onClick={() => void evaluate()} disabled={loading || !text.trim()} className="mt-5 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{loading ? 'Checking…' : 'Check and simulate'}</button>
        {error && <p role="alert" data-testid="pii-phi__error" className="mt-4 text-sm text-red-700">{error}</p>}
        {runs.map(([name, run]) => <article key={name} data-testid={`pii-phi__result-${name}`} className="mt-6 rounded-xl border border-line bg-canvas p-4">
          <h2 className="font-semibold capitalize">{name} · MOCK · {run.answer.guardrails.action}</h2>
          <p className="mt-1 text-sm text-muted">{run.answer.guardrails.reasonCode === 'no_findings' ? 'No supported pattern detected; this is not proof that the text contains no sensitive data.' : run.answer.guardrails.reasonCode === 'needs_review' ? 'Review the sample before continuing.' : 'Sensitive pattern detected.'}</p>
          <ul data-testid="pii-phi__findings" className="mt-3 space-y-1 text-sm">{run.answer.guardrails.findings.map((finding, index) => <li key={`${finding.start}-${index}`}><span className="font-medium capitalize">{finding.category}</span> · {finding.confidence} confidence · span {finding.start}–{finding.end}</li>)}</ul>
          {run.answer.guardrails.redactedText && <p data-testid="pii-phi__redacted" className="mt-3 rounded-lg bg-white p-3 text-sm">{run.answer.guardrails.redactedText}</p>}
          {run.answer.received ? <div data-testid="pii-phi__agent-received" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"><p>{run.answer.received.response}</p><p className="mt-1 break-words font-mono">{run.answer.received.text}</p></div> : <p data-testid="pii-phi__agent-blocked" className="mt-3 text-sm font-medium text-red-700">The mock agent received nothing.</p>}
        </article>)}
      </section>
      <aside className="overflow-hidden rounded-card border border-line bg-slate-950 text-slate-100 shadow-card"><div className="border-b border-slate-800 px-5 py-4"><p className="text-sm font-semibold">Detection and policy logic</p><p className="mt-1 text-xs text-slate-400">Source: apps/jev-showcase/src/server/pii-phi.ts</p></div><pre data-testid="pii-phi__code" className="max-h-[52rem] overflow-auto p-5 text-xs leading-6"><code>{guardrailCode}</code></pre></aside>
    </main>
  </div>;
}
