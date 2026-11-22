import React, { useState } from 'react';
import { JevAgentPage } from './jev-agent-page.js';
import triageCode from '../server/triage.ts?raw';
import thresholdCode from './threshold.ts?raw';
import { decideWithThresholds, playgroundScenarios, summarizeOutcomes, thresholdSamples } from './threshold.js';
import { ContentModerationPage } from './moderation.js';
import { ToolSafetyPage } from './tool-safety-page.js';
import { PiiPhiGuardrailsPage } from './pii-phi-guardrails.js';
import { DecisionPipelinePage } from './decision-pipeline-page.js';
import { currentEngineSelection } from './engine-switch.js';

export type RuntimeMode = 'mock' | 'live';

interface AppProps {
  mode: RuntimeMode;
  path?: string;
}

const useCases = [
  { number: '01', title: 'Tool-call safety', text: 'Gate proposed tool calls with an explainable risk decision.', href: '/tool-safety', testId: 'home__tool-safety-link' },
  { number: '02', title: 'Support ticket triage', text: 'Route tickets with clear confidence and a human-review path.', href: '#support-triage', testId: 'home__ticket-triage-link' },
  { number: '03', title: 'Content moderation', text: 'Apply a policy consistently, with a clear review band.', href: '/content-moderation', testId: 'home__content-moderation-link' },
  { number: '04', title: 'Decision receipts', text: 'Inspect every decision and see why later gates were skipped.', href: '/decision-pipeline', testId: 'home__decision-pipeline-link' },
  { number: '05', title: 'Jev consulting agent', text: 'Let an agent check with Jev before it acts.', href: '/jev-agent', testId: 'jev-agent__home-link' },
  { number: '06', title: 'Confidence playground', text: 'Adjust confidence thresholds while the evidence stays fixed.', href: '#confidence-playground', testId: 'home__threshold-playground-link' },
  { number: '07', title: 'PII/PHI guardrails', text: 'Inspect synthetic sensitive patterns before a mock agent.', href: '/pii-phi-guardrails', testId: 'home__pii-phi-guardrails-link' },
];

const sampleTicket = 'My headphones arrived with a cracked ear cup, and I need a replacement before my trip next week.';

export function App({ mode, path = window.location.pathname }: AppProps) {
  if (path === '/jev-agent') return <JevAgentPage mode={mode} />;
  if (path === '/tool-safety') return <ToolSafetyPage />;
  if (path === '/content-moderation') return <ContentModerationPage mode={mode} />;
  if (path === '/pii-phi-guardrails') return <PiiPhiGuardrailsPage />;
  if (path === '/decision-pipeline') return <DecisionPipelinePage mode={mode} />;
  const [ticket, setTicket] = useState(sampleTicket);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scenario, setScenario] = useState<keyof typeof playgroundScenarios>('tool-safety');
  const [confidence, setConfidence] = useState(62);
  const [allowThreshold, setAllowThreshold] = useState(80);
  const [blockThreshold, setBlockThreshold] = useState(35);
  const [thresholdExecution, setThresholdExecution] = useState<unknown>();
  const [thresholdBusy, setThresholdBusy] = useState(false);
  async function triage() {
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/triage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket, ...currentEngineSelection() }) });
      const payload = await response.json() as Record<string, unknown>;
      if (payload.execution) window.dispatchEvent(new CustomEvent('sandi-engine-result', { detail: payload.execution }));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Unable to triage ticket. Please retry or assign it manually.');
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to triage ticket. Please retry or assign it manually.');
    } finally { setLoading(false); }
  }
  async function evaluateThreshold() {
    setThresholdBusy(true);
    try {
      const response = await fetch('/api/threshold/evaluate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: selectedScenario.label, confidence: scenarioConfidence, allowThreshold: allowThreshold / 100, blockThreshold: blockThreshold / 100, ...currentEngineSelection() }) });
      const payload = await response.json() as { execution?: unknown; error?: string };
      if (!response.ok || payload.execution === undefined) throw new Error(payload.error ?? 'Threshold evaluation is unavailable.');
      setThresholdExecution(payload.execution);
      window.dispatchEvent(new CustomEvent('sandi-engine-result', { detail: payload.execution }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Threshold evaluation is unavailable.'); }
    finally { setThresholdBusy(false); }
  }
  const answer = (key: string) => result?.[key] as { value: string; probabilities: Record<string, number> } | undefined;
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const selectedScenario = playgroundScenarios[scenario];
  const scenarioConfidence = Math.max(...Object.values(selectedScenario.probabilities));
  const decision = decideWithThresholds(confidence / 100, allowThreshold / 100, blockThreshold / 100);
  const summary = summarizeOutcomes(thresholdSamples, allowThreshold / 100, blockThreshold / 100);
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <a className="flex items-center gap-3 font-semibold tracking-tight" href="/" aria-label="Jev Showcase home">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white">J</span>
          <span>Jev <span className="font-normal text-muted">Showcase</span></span>
        </a>
        <nav aria-label="Main navigation" className="hidden items-center gap-5 text-sm text-muted xl:flex">
          <a href="/tool-safety" className="hover:text-brand">Tool safety</a>
          <a href="#support-triage" data-testid="nav-support-triage" className="hover:text-brand">Support ticket triage</a>
          <a href="#confidence-playground" data-testid="nav-confidence-playground" className="hover:text-brand">Confidence playground</a>
          <a href="/content-moderation" className="hover:text-brand">Content moderation</a>
          <a href="/decision-pipeline" data-testid="decision-pipeline-nav" className="hover:text-brand">Decision receipts</a>
          <a href="/pii-phi-guardrails" data-testid="nav-pii-phi-guardrails" className="hover:text-brand">PII/PHI guardrails</a>
          <a href="/jev-agent" data-testid="jev-agent__nav-link" className="hover:text-brand">Jev consulting agent</a>
        </nav>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-ink transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 xl:hidden"
          aria-label={mobileNavigationOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileNavigationOpen}
          aria-controls="mobile-navigation"
          data-testid="app__mobile-menu"
          onClick={() => setMobileNavigationOpen((open) => !open)}
        >
          <span aria-hidden="true" className="text-lg leading-none">{mobileNavigationOpen ? '×' : '☰'}</span>
        </button>
        <span
          className={`inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-xs font-semibold tracking-wide ${
            mode === 'live' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-line bg-surface text-muted'
          }`}
          aria-label="Runtime mode"
        >
          <span className={`size-1.5 rounded-full ${mode === 'live' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {mode.toUpperCase()}
        </span>
      </header>

      {mobileNavigationOpen && <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        data-testid="app__mobile-navigation"
        className="mx-auto grid max-w-6xl gap-1 border-y border-line bg-surface px-6 py-3 text-sm text-muted sm:grid-cols-2 lg:px-10 xl:hidden"
      >
        {[
          ['/tool-safety', 'Tool safety'],
          ['#support-triage', 'Support ticket triage'],
          ['#confidence-playground', 'Confidence playground'],
          ['/content-moderation', 'Content moderation'],
          ['/decision-pipeline', 'Decision receipts'],
          ['/pii-phi-guardrails', 'PII/PHI guardrails'],
          ['/jev-agent', 'Jev consulting agent'],
        ].map(([href, label]) => <a key={href} href={href} onClick={() => setMobileNavigationOpen(false)} className="rounded-lg px-3 py-2.5 transition hover:bg-elevated hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25">{label}</a>)}
      </nav>}

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-12 lg:px-10 lg:pt-20">
        <section className="max-w-3xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-brand">A practical guide to Jev</p>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl">
            Decisions, made clear.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Explore how structured questions turn complex choices into useful, understandable decisions.
            Start with a guided example and see every step along the way.
          </p>
          <a
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25"
            href="#support-triage"
          >
            Support ticket triage <span aria-hidden="true">→</span>
          </a>
        </section>

        <section id="support-triage" className="mt-16 grid gap-8 lg:grid-cols-[1fr_1fr]" aria-labelledby="triage-title">
          <div className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Use case 02 · Support operations</p>
            <h2 id="triage-title" className="mt-3 text-2xl font-semibold tracking-tight">Support ticket triage</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Jev classifies the issue, scores urgency, and picks the best team. Uncertain decisions go to a person.</p>
            <label htmlFor="ticket" className="mt-6 block text-sm font-medium">Ticket description</label>
            <textarea id="ticket" data-testid="ticket-input" value={ticket} onChange={(event) => setTicket(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-line bg-elevated p-3 text-sm leading-6" />
            <button type="button" onClick={() => void triage()} disabled={loading || !ticket.trim()} className="mt-4 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 disabled:opacity-50" data-testid="triage-button">
              {loading ? 'Triaging…' : 'Triage ticket'}
            </button>
            {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
            {result && <div data-testid="triage-result" className="mt-6 rounded-xl border border-line bg-canvas p-4">
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-muted">Category</dt><dd data-testid="triage-category" className="font-medium">{answer('category')?.value ?? 'Unavailable'}</dd></div>
                <div><dt className="text-xs text-muted">Urgency</dt><dd data-testid="triage-urgency" className="font-medium">{answer('urgency')?.value ?? 'Unavailable'}</dd></div>
                <div><dt className="text-xs text-muted">Selected queue</dt><dd data-testid="triage-selected-queue" className="font-medium">{answer('queue')?.value ?? 'Unavailable'}</dd></div>
              </dl>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Final route</p>
              <p className="mt-1 font-semibold">{String(result.route)}</p>
              {result.needsHuman === true && <p data-testid="needs-human" className="mt-2 text-sm text-amber-800">Needs human review · at least one decision is below the 65% confidence threshold.</p>}
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs" data-testid="probabilities">
                {(['category', 'urgency', 'queue'] as const).map((key) => <div key={key} data-testid={`triage-confidence-${key}`} className="rounded-lg bg-white p-2"><span className="block capitalize text-muted">{key}</span><strong>{percent(Math.max(...Object.values(answer(key)?.probabilities ?? { unknown: 0 })))}</strong></div>)}
              </div>
            </div>}
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-slate-950 text-slate-100 shadow-card">
            <div className="border-b border-slate-800 px-5 py-4"><p className="text-sm font-semibold">Routing logic</p><p className="mt-1 text-xs text-slate-400">Source: apps/jev-showcase/src/server/triage.ts</p></div>
            <pre data-testid="triage-code" className="max-h-[28rem] overflow-auto p-5 text-xs leading-6"><code>{triageCode}</code></pre>
          </div>
        </section>

        <section id="confidence-playground" className="mt-20" aria-labelledby="threshold-title">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Use case 06 · Decision quality</p>
            <h2 id="threshold-title" className="mt-3 text-3xl font-semibold tracking-tight">Confidence &amp; threshold playground</h2>
            <p className="mt-3 text-sm leading-6 text-muted">Explore how confidence cutoffs shape a decision. Replay scenarios are synthetic and run locally in mock mode.</p>
          </div>
          <div className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
              <label htmlFor="threshold-scenario" className="block text-sm font-medium">Scenario</label>
              <select id="threshold-scenario" data-testid="threshold-scenario" value={scenario} onChange={(event) => {
                const next = event.target.value as keyof typeof playgroundScenarios;
                setScenario(next);
                setConfidence(Math.round(Math.max(...Object.values(playgroundScenarios[next].probabilities)) * 100));
              }} className="mt-2 w-full rounded-xl border border-line bg-elevated p-3 text-sm">
                {Object.entries(playgroundScenarios).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
              </select>
              <div className="mt-5 rounded-xl bg-canvas p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{selectedScenario.question}</p>
                <p className="mt-2 text-sm leading-6">{selectedScenario.description}</p>
              </div>
              <div className="mt-6" data-testid="threshold-distribution">
                <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Probability distribution</h3><span className="text-xs text-muted">scenario output</span></div>
                <div className="mt-3 space-y-3">
                  {Object.entries(selectedScenario.probabilities).map(([label, value]) => <div key={label} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3 text-xs"><span>{label}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: percent(value) }} /></div><strong className="text-right">{percent(value)}</strong></div>)}
                </div>
              </div>
              <label htmlFor="threshold-confidence" className="mt-7 flex items-center justify-between text-sm font-medium">Selected confidence <span data-testid="confidence-value" className="font-mono text-brand">{confidence}%</span></label>
              <input id="threshold-confidence" data-testid="threshold-confidence" type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} className="mt-3 w-full accent-blue-600" />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">Allow at or above <span className="font-mono text-brand">{allowThreshold}%</span><input aria-label="Allow threshold" data-testid="allow-threshold" type="range" min="51" max="100" value={allowThreshold} onChange={(event) => setAllowThreshold(Math.max(Number(event.target.value), blockThreshold + 1))} className="mt-3 block w-full accent-blue-600" /></label>
                <label className="text-sm font-medium">Block below <span className="font-mono text-brand">{blockThreshold}%</span><input aria-label="Block threshold" data-testid="block-threshold" type="range" min="0" max="50" value={blockThreshold} onChange={(event) => setBlockThreshold(Math.min(Number(event.target.value), allowThreshold - 1))} className="mt-3 block w-full accent-blue-600" /></label>
              </div>
              <div data-testid="threshold-decision" className={`mt-6 rounded-xl border p-4 ${decision === 'allow' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : decision === 'block' ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                <p className="text-xs font-semibold uppercase tracking-wide">Decision</p><p className="mt-1 text-xl font-semibold capitalize">{decision}</p>
                <p className="mt-1 text-sm">{decision === 'allow' ? 'Confidence meets the allow cutoff.' : decision === 'block' ? 'Confidence is below the block cutoff.' : 'Send this case for human review.'}</p>
              </div>
              <button type="button" data-testid="threshold-engine-run" onClick={() => void evaluateThreshold()} disabled={thresholdBusy} className="mt-4 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{thresholdBusy ? 'Evaluating…' : 'Evaluate with selected engine'}</button>
              {thresholdExecution !== undefined ? <pre data-testid="threshold-engine-result" className="mt-3 max-h-48 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-white">{JSON.stringify(thresholdExecution, null, 2)}</pre> : null}
              <p className="mt-2 sr-only">Scenario confidence is {Math.round(scenarioConfidence * 100)}%.</p>
            </div>
            <div className="space-y-6">
              <div className="rounded-card border border-line bg-surface p-6 shadow-card" data-testid="threshold-summary">
                <h3 className="text-lg font-semibold">Sample set summary</h3><p className="mt-1 text-sm text-muted">Six synthetic cases · operational outcome vs. expected safe or unsafe</p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Object.entries({ 'Correct allow': summary.trueAllow, 'False allow': summary.falseAllow, 'Correct block': summary.trueBlock, 'False block': summary.falseBlock, Escalated: summary.escalated }).map(([label, count]) => <div key={label} className="rounded-xl bg-canvas p-3"><span className="block text-xs text-muted">{label}</span><strong className="mt-1 block text-2xl">{count}</strong></div>)}
                </div>
              </div>
              <div className="overflow-hidden rounded-card border border-line bg-slate-950 text-slate-100 shadow-card">
                <div className="border-b border-slate-800 px-5 py-4"><p className="text-sm font-semibold">Threshold logic</p><p className="mt-1 text-xs text-slate-400">Source: apps/jev-showcase/src/client/threshold.ts</p></div>
                <pre data-testid="threshold-code" className="max-h-[24rem] overflow-auto p-5 text-xs leading-6"><code>{thresholdCode}</code></pre>
              </div>
            </div>
          </div>
        </section>

        <section id="examples" className="mt-20 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Example decisions">
          {useCases.map((item) => (
            <article key={item.number} className="group rounded-card border border-line bg-surface p-6 shadow-card">
              <span className="font-mono text-xs font-semibold text-brand">{item.number}</span>
              <h2 className="mt-6 text-lg font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-muted">{item.text}</p>
              <a href={item.href} data-testid={item.testId} className="mt-5 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25">
                Open demo <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">↗</span>
              </a>
            </article>
          ))}
        </section>

        <footer className="mt-16 flex flex-col gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Built for thoughtful decisions.</span>
          <span>Safe to explore · Mock mode is the default</span>
        </footer>
      </main>
    </div>
  );
}
