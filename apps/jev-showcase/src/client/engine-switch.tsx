import React, { useEffect, useState } from 'react';

export type ClientEngine = 'jev' | 'decider';

export function currentEngineSelection(): { engine: ClientEngine; compare: boolean } {
  if (typeof window === 'undefined') return { engine: 'jev', compare: false };
  return {
    engine: window.localStorage.getItem('sandi-engine') === 'decider' ? 'decider' : 'jev',
    compare: window.localStorage.getItem('sandi-compare') === 'true',
  };
}

export function EngineSwitch() {
  const [engine, setEngine] = useState<ClientEngine>(() => currentEngineSelection().engine);
  const [compare, setCompare] = useState(() => currentEngineSelection().compare);
  const [result, setResult] = useState<unknown>();
  useEffect(() => {
    const onResult = (event: Event) => setResult((event as CustomEvent<unknown>).detail);
    window.addEventListener('sandi-engine-result', onResult);
    return () => window.removeEventListener('sandi-engine-result', onResult);
  }, []);
  return <div className="mb-5">
    <fieldset className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4" data-testid="engine-switch">
    <legend className="px-2 text-sm font-semibold">Decision engine</legend>
    <label className="flex items-center gap-2 text-sm"><input aria-label="Decision engine" type="radio" name="decision-engine" value="jev" checked={engine === 'jev'} onChange={() => { setEngine('jev'); window.localStorage.setItem('sandi-engine', 'jev'); }} />Jev</label>
    <label className="flex items-center gap-2 text-sm"><input aria-label="Decision engine" type="radio" name="decision-engine" value="decider" checked={engine === 'decider'} onChange={() => { setEngine('decider'); window.localStorage.setItem('sandi-engine', 'decider'); }} />Strands decider</label>
    <label className="flex items-center gap-2 text-sm"><input aria-label="Compare engines" type="checkbox" checked={compare} onChange={(event) => { setCompare(event.target.checked); window.localStorage.setItem('sandi-compare', String(event.target.checked)); }} />Compare</label>
    </fieldset>
    {result !== undefined && <pre data-testid="engine-compare-result" className="mt-3 max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-white">{JSON.stringify(result, null, 2)}</pre>}
  </div>;
}
