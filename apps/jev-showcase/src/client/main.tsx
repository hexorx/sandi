import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App, type RuntimeMode } from './app.js';
import './styles.css';

function Showcase() {
  const [mode, setMode] = useState<RuntimeMode>('mock');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/mode', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() as Promise<{ mode?: RuntimeMode }> : null))
      .then((payload) => {
        if (payload?.mode === 'live') setMode('live');
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return <App mode={mode} />;
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('The showcase root element is missing');

createRoot(rootElement).render(
  <StrictMode>
    <Showcase />
  </StrictMode>,
);
