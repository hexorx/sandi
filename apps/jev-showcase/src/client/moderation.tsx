import React, { useState } from 'react';
import moderationCode from '../moderation-core.ts?raw';
import type { ModerationInput, ModerationResult } from '../moderation-contract.js';
import type { RuntimeMode } from './app.js';

interface ModerationPageProps {
  mode: RuntimeMode;
  run?: (input: ModerationInput) => Promise<ModerationResult>;
  initialResult?: ModerationResult;
}

const example: ModerationInput = {
  content: 'I disagree with this release; please fix the export bug.',
  policy: 'Block targeted harassment and direct threats. Allow ordinary criticism.',
};

async function requestModeration(input: ModerationInput): Promise<ModerationResult> {
  const response = await fetch('/api/use-cases/content-moderation/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await response.json() as { result?: ModerationResult; error?: { message?: string } };
  if (!response.ok || !payload.result) throw new Error(payload.error?.message ?? 'Decision unavailable. Try again.');
  return payload.result;
}

function CodePanel() {
  return (
    <section className="rounded-panel border border-line bg-elevated p-6" data-testid="content-moderation__code-panel" aria-labelledby="moderation-code-title">
      <h2 id="moderation-code-title" className="text-heading">Example TypeScript</h2>
      <p className="mt-2 text-sm text-muted">The decision band uses the same function that shapes the server response.</p>
      <pre className="mt-5 overflow-x-auto rounded-card bg-[#111827] p-5 text-xs leading-6 text-slate-100"><code>{moderationCode}</code></pre>
    </section>
  );
}

export function ContentModerationPage({ mode, run = requestModeration, initialResult }: ModerationPageProps) {
  const [content, setContent] = useState(example.content);
  const [policy, setPolicy] = useState(example.policy);
  const [result, setResult] = useState(initialResult);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveConfirmed, setLiveConfirmed] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() || !policy.trim()) {
      setError('Enter both content and a policy to review.');
      return;
    }
    if (mode === 'live' && !liveConfirmed) {
      setError('Confirm that this sample will be sent to TypeSafe Jev before running in LIVE mode.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      setResult(await run({ content, policy }));
    } catch {
      setError('Decision unavailable. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setContent(example.content);
    setPolicy(example.policy);
    setResult(undefined);
    setError('');
    setLiveConfirmed(false);
  }

  const chipStyle = result?.decision === 'approve' ? 'text-positive border-positive' : result?.decision === 'remove' ? 'text-negative border-negative' : 'text-caution border-caution';

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex max-w-workspace items-center justify-between px-6 py-6 lg:px-10">
        <a href="/" className="font-semibold text-brand">← All examples</a>
        <span className="rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-semibold" data-testid="app__mode-badge">{mode.toUpperCase()}</span>
      </header>
      <main className="mx-auto max-w-workspace px-6 pb-16 lg:px-10">
        <p className="text-micro font-semibold uppercase tracking-[0.18em] text-brand">Use case 03</p>
        <h1 className="mt-3 text-title">Content moderation</h1>
        <p className="mt-2 max-w-reading text-body text-muted">Apply a policy consistently, with a reason and a clear path for borderline cases.</p>
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
          <section className="rounded-panel border border-line bg-surface p-6 shadow-card" aria-label="Moderation review">
            <form onSubmit={submit} data-testid="content-moderation__form" className="space-y-5">
              <label className="block text-sm font-medium" htmlFor="moderation-policy">Policy
                <textarea id="moderation-policy" data-testid="content-moderation__policy-input" value={policy} onChange={(event) => setPolicy(event.target.value)} rows={3} className="mt-2 block w-full rounded-card border border-line bg-elevated p-3 text-sm" />
              </label>
              <label className="block text-sm font-medium" htmlFor="moderation-content">User content
                <textarea id="moderation-content" data-testid="content-moderation__content-input" value={content} onChange={(event) => setContent(event.target.value)} rows={4} maxLength={5000} className="mt-2 block w-full rounded-card border border-line bg-elevated p-3 text-sm" />
              </label>
              {mode === 'live' && <label className="flex items-start gap-3 text-sm text-muted">
                <input type="checkbox" data-testid="content-moderation__live-confirmation" checked={liveConfirmed} onChange={(event) => setLiveConfirmed(event.target.checked)} className="mt-1 accent-brand" />
                <span>I confirm this sample text and policy can be sent to TypeSafe Jev for a live decision.</span>
              </label>}
              {error && <p role="alert" data-testid="content-moderation__error" className="text-sm text-negative">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={loading} data-testid="content-moderation__run-button" className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-brand/25 disabled:opacity-60">{loading ? 'Reviewing…' : 'Review content'}</button>
                <button type="button" onClick={reset} data-testid="content-moderation__reset-button" className="rounded-xl border border-line px-5 py-3 text-sm font-medium">Reset example</button>
              </div>
            </form>
            {loading && <p role="status" data-testid="content-moderation__loading" className="mt-6 text-sm text-muted">Reviewing against the displayed policy…</p>}
            {!result && !loading && <p data-testid="content-moderation__empty" className="mt-6 text-sm text-muted">Review the example to see a moderation decision.</p>}
            {result && <section aria-live="polite" className="mt-7 border-t border-line pt-6">
              <div className="flex items-center gap-3">
                <span data-testid="content-moderation__decision-chip" className={`rounded-pill border px-3 py-1 text-sm font-semibold uppercase ${chipStyle}`}>{result.decision}</span>
                {result.reviewRequired && <span data-testid="content-moderation__review-band" className="text-sm font-medium text-caution">Human review · borderline confidence</span>}
              </div>
              <p className="mt-3 text-sm text-muted">{result.reason}</p>
              <h2 className="mt-6 text-sm font-semibold">Decision probabilities</h2>
              <div className="mt-2 space-y-2">{Object.entries(result.probabilities).map(([label, probability]) => <Probability key={label} label={label} value={probability} />)}</div>
              <h2 className="mt-6 text-sm font-semibold">Policy scores</h2>
              <div className="mt-2 space-y-2">{Object.entries(result.policyScores).map(([label, value]) => <Probability key={label} label={label} value={value} testId={`content-moderation__policy-score-${label}`} />)}</div>
            </section>}
          </section>
          <CodePanel />
        </div>
      </main>
    </div>
  );
}

function Probability({ label, value, testId }: { label: string; value: number; testId?: string }) {
  return <div className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-xs">
    <span className="capitalize text-muted">{label}</span>
    <progress data-testid={testId} aria-label={`${label} probability`} className="h-2 w-full accent-brand" max={1} value={value} />
    <span className="text-right tabular-nums">{Math.round(value * 100)}%</span>
  </div>;
}
