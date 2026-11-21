import React, { useState } from 'react';
import implementationSource from '../server/jev-agent.ts?raw';
import type { RuntimeMode } from './app.js';
import { currentEngineSelection } from './engine-switch.js';

interface JevAgentPageProps {
  mode: RuntimeMode;
}

interface TraceStep {
  kind: 'task' | 'plan' | 'jev-check' | 'action' | 'result' | 'error';
  message: string;
  probabilities?: { yes: number; no: number };
  status?: 'simulated';
}

interface AgentRun {
  outcome: 'acted' | 'refused' | 'error';
  agentMode: 'scripted' | 'ollama';
  steps: TraceStep[];
}

const initialTask = 'Prepare a customer workspace export.';
const initialAction = 'Create an export link for the current workspace.';
const stepLabels: Record<TraceStep['kind'], string> = {
  task: 'User task',
  plan: 'Agent plan',
  'jev-check': 'Jev consultation',
  action: 'Action',
  result: 'Result',
  error: 'Error',
};

export function JevAgentPage({ mode }: JevAgentPageProps) {
  const [task, setTask] = useState(initialTask);
  const [action, setAction] = useState(initialAction);
  const [run, setRun] = useState<AgentRun>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task.trim() || !action.trim()) {
      setError('Enter both a task and proposed action.');
      return;
    }
    setLoading(true);
    setError('');
    setRun(undefined);
    try {
      const response = await fetch('/api/use-cases/jev-agent/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task, action, ...currentEngineSelection() }),
      });
      const payload = await response.json() as AgentRun | { error?: string };
      if ('execution' in payload) window.dispatchEvent(new CustomEvent('sandi-engine-result', { detail: payload.execution }));
      if (!response.ok) throw new Error('error' in payload ? payload.error : undefined);
      if ('steps' in payload) setRun(payload);
      else setRun({ outcome: 'acted', agentMode: 'ollama', steps: [{ kind: 'result', message: 'See the selected engine result above.' }] });
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'Agent run unavailable. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setTask(initialTask);
    setAction(initialAction);
    setRun(undefined);
    setError('');
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <a className="flex items-center gap-3 font-semibold tracking-tight" href="/" aria-label="Jev Showcase home">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white">J</span>
          <span>Jev <span className="font-normal text-muted">Showcase</span></span>
        </a>
        <span data-testid="app__mode-badge" aria-label="Runtime mode" className="rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-semibold tracking-wide text-muted">{mode.toUpperCase()}</span>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-8 lg:px-10">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted"><a className="text-brand hover:underline" href="/">Home</a> / Jev agent</nav>
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand">Use case 05 · Strands Agents</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Let an agent ask before it acts.</h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted">A Strands agent calls a Jev safety tool first. The proposed action is simulated only when Jev allows it with enough confidence.</p>

            <form onSubmit={(event) => void submit(event)} className="mt-7 rounded-card border border-line bg-surface p-6 shadow-card">
              <label className="block text-sm font-medium" htmlFor="jev-agent-task">Task</label>
              <textarea id="jev-agent-task" value={task} onChange={(event) => setTask(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-line bg-elevated p-3 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-blue-200" data-testid="jev-agent__task-input" />
              <label className="mt-5 block text-sm font-medium" htmlFor="jev-agent-action">Proposed action</label>
              <textarea id="jev-agent-action" value={action} onChange={(event) => setAction(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-line bg-elevated p-3 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-blue-200" data-testid="jev-agent__action-input" />
              <p className="mt-4 rounded-xl bg-brand-soft p-3 text-sm leading-6 text-muted">The action is simulated; no export link is created.</p>
              {error && <p role="alert" className="mt-4 rounded-xl border border-negative/30 bg-negative/5 p-3 text-sm text-negative">{error}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="submit" disabled={loading} data-testid="jev-agent__run-button" className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:opacity-60">{loading ? 'Agent is checking the proposed action…' : 'Run the agent'}</button>
                <button type="button" onClick={reset} data-testid="jev-agent__reset-button" className="rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink hover:bg-elevated focus:outline-none focus:ring-4 focus:ring-blue-200">Reset example</button>
              </div>
            </form>

            <section aria-label="Agent run trace" aria-live="polite" className="mt-6 rounded-card border border-line bg-surface p-6 shadow-card">
              <h2 className="text-lg font-semibold">Agent run</h2>
              {loading && <p className="mt-4 text-sm text-muted" data-testid="jev-agent__loading">Agent is checking its proposed action…</p>}
              {!run && !loading && <p className="mt-4 text-sm text-muted" data-testid="jev-agent__empty">Run the example to see the Jev tool trace.</p>}
              {run && <>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-pill bg-brand-soft px-3 py-1 text-brand">{run.agentMode === 'scripted' ? 'SCRIPTED MODEL' : 'OLLAMA MODEL'}</span>
                  <span className={`rounded-pill px-3 py-1 ${run.outcome === 'acted' ? 'bg-positive/10 text-positive' : run.outcome === 'refused' ? 'bg-caution/10 text-caution' : 'bg-negative/10 text-negative'}`}>{run.outcome.toUpperCase()}</span>
                </div>
                <ol className="mt-5 space-y-3" data-testid="jev-agent__timeline">
                  {run.steps.map((step, index) => <li key={`${step.kind}-${index}`} data-testid={`jev-agent__trace-${step.kind}`} className="rounded-xl border border-line bg-elevated p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand">{stepLabels[step.kind]}</p>
                    <p className="mt-1 text-sm leading-6">{step.message}</p>
                    {step.probabilities && <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-muted">Allow</dt><dd className="font-semibold">{Math.round(step.probabilities.yes * 100)}%</dd></div>
                      <div><dt className="text-muted">Block</dt><dd className="font-semibold">{Math.round(step.probabilities.no * 100)}%</dd></div>
                    </dl>}
                    {step.status && <span className="mt-2 inline-block rounded-pill bg-caution/10 px-2 py-1 text-xs font-semibold text-caution">SIMULATED</span>}
                  </li>)}
                </ol>
              </>}
            </section>
          </section>

          <aside className="h-fit rounded-card border border-line bg-surface p-6 shadow-card lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold">How the safety gate works</h2>
            <p className="mt-2 text-sm leading-6 text-muted">The Strands tool owns both steps: it asks Jev for a decision, then simulates the action only after an allow above the confidence threshold.</p>
            <pre data-testid="jev-agent__code" className="mt-5 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-elevated p-4 font-mono text-xs leading-5 text-ink"><code>{implementationSource}</code></pre>
          </aside>
        </div>
      </main>
    </div>
  );
}
