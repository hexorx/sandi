import React from 'react';
import { ToolSafetyPage } from './tool-safety-page.js';

export type RuntimeMode = 'mock' | 'live';

interface AppProps {
  mode: RuntimeMode;
  path?: string;
}

const useCases = [
  { number: '01', title: 'A clear recommendation', text: 'Turn a question into a decision you can explain.' },
  { number: '02', title: 'Choices with context', text: 'Compare options against the criteria that matter.' },
  { number: '03', title: 'A confidence score', text: 'See how strongly the evidence supports an outcome.' },
];

export function App({ mode, path = '/' }: AppProps) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <a className="flex items-center gap-3 font-semibold tracking-tight" href="/" aria-label="Jev Showcase home">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white">J</span>
          <span>Jev <span className="font-normal text-muted">Showcase</span></span>
        </a>
        <nav aria-label="Use cases" className="mr-auto ml-8 hidden gap-5 text-sm font-medium text-muted sm:flex">
          <a href="/tool-safety" className="hover:text-brand">Tool safety</a>
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

      {path === '/tool-safety' ? <ToolSafetyPage /> : <main className="mx-auto max-w-6xl px-6 pb-20 pt-12 lg:px-10 lg:pt-20">
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
            href="#examples"
          >
            Explore the examples <span aria-hidden="true">→</span>
          </a>
        </section>

        <section id="examples" className="mt-20 grid gap-4 md:grid-cols-3" aria-label="Example decisions">
          {useCases.map((item) => (
            <article key={item.number} className="rounded-card border border-line bg-surface p-6 shadow-card">
              <span className="font-mono text-xs text-brand">{item.number}</span>
              <h2 className="mt-8 text-lg font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
              <span className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-brand">
                Example coming soon <span aria-hidden="true">↗</span>
              </span>
            </article>
          ))}
        </section>

        <footer className="mt-16 flex flex-col gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Built for thoughtful decisions.</span>
          <span>Safe to explore · Mock mode is the default</span>
        </footer>
      </main>}
    </div>
  );
}
