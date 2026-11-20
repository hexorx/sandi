import React, { useState } from 'react';
import { JevAgentPage } from './jev-agent-page.js';
import triageCode from '../server/triage.ts?raw';
import { ContentModerationPage } from './moderation.js';
import { ToolSafetyPage } from './tool-safety-page.js';
import { PiiPhiGuardrailsPage } from './pii-phi-guardrails.js';

export type RuntimeMode = 'mock' | 'live';

interface AppProps {
  mode: RuntimeMode;
  path?: string;
}

const useCases = [
  { number: '01', title: 'Tool safety', text: 'Gate tool calls with an explainable risk decision.' },
  { number: '02', title: 'Support ticket triage', text: 'Route tickets with confidence and human review.' },
  { number: '03', title: 'Content moderation', text: 'Apply a policy consistently, with a clear human-review band.' },
  { number: '05', title: 'Jev consulting agent', text: 'Let an agent check with Jev before it acts.' },
];

const sampleTicket = 'My headphones arrived with a cracked ear cup, and I need a replacement before my trip next week.';

export function App({ mode, path = window.location.pathname }: AppProps) {
  if (path === '/jev-agent') return <JevAgentPage mode={mode} />;
  if (path === '/tool-safety') return <ToolSafetyPage />;
  if (path === '/content-moderation') return <ContentModerationPage mode={mode} />;
  if (path === '/pii-phi-guardrails') return <PiiPhiGuardrailsPage />;
  const [ticket, setTicket] = useState(sampleTicket);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function triage() {
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/triage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket }) });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Unable to triage ticket. Please retry or assign it manually.');
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to triage ticket. Please retry or assign it manually.');
    } finally { setLoading(false); }
  }
  const answer = (key: string) => result?.[key] as { value: string; probabilities: Record<string, number> } | undefined;
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <a className="flex items-center gap-3 font-semibold tracking-tight" href="/" aria-label="Jev Showcase home">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white">J</span>
          <span>Jev <span className="font-normal text-muted">Showcase</span></span>
        </a>
        <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm text-muted sm:flex">
          <a href="/tool-safety" className="hover:text-brand">Tool safety</a>
          <a href="#support-triage" data-testid="nav-support-triage" className="hover:text-brand">Support ticket triage</a>
          <a href="/content-moderation" className="hover:text-brand">Content moderation</a>
          <a href="/pii-phi-guardrails" data-testid="nav-pii-phi-guardrails" className="hover:text-brand">PII/PHI guardrails</a>
          <a href="/jev-agent" data-testid="jev-agent__nav-link" className="hover:text-brand">Jev consulting agent</a>
        </nav>
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
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
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
            <textarea id="ticket" data-testid="ticket-input" value={ticket} onChange={(event) => setTicket(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-line bg-white p-3 text-sm leading-6 focus:outline-none focus:ring-4 focus:ring-blue-100" />
            <button type="button" onClick={() => void triage()} disabled={loading || !ticket.trim()} className="mt-4 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" data-testid="triage-button">
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

        <section id="examples" className="mt-20 grid gap-4 md:grid-cols-3" aria-label="Example decisions">
          {[...useCases, { number: '07', title: 'PII/PHI guardrails', text: 'Detect synthetic sensitive patterns and block or redact before a mock agent.' }].map((item) => (
            <article key={item.number} className="rounded-card border border-line bg-surface p-6 shadow-card">
              <span className="font-mono text-xs text-brand">{item.number}</span>
              <h2 className="mt-8 text-lg font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
              {item.number === '07' ? <a href="/pii-phi-guardrails" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-brand" data-testid="home__pii-phi-guardrails-link">Open demo <span aria-hidden="true">↗</span></a> : item.number === '03' ? <a href="/content-moderation" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-brand" data-testid="home__content-moderation-link">
                Open demo <span aria-hidden="true">↗</span>
              </a> : item.number === '05' ? <a href="/jev-agent" data-testid="jev-agent__home-link" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline">
                Open demo <span aria-hidden="true">↗</span>
              </a> : <span className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-brand">Example coming soon <span aria-hidden="true">↗</span></span>}
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
