// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JevAgentPage } from './jev-agent-page.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Jev agent page', () => {
  it('shows the trace in order, probabilities and the implementation source', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      outcome: 'acted',
      confidence: 0.94,
      steps: [
        { kind: 'task', message: 'Prepare a workspace export' },
        { kind: 'plan', message: 'Check safety before creating an export link.' },
        { kind: 'jev-check', message: 'Jev allows this simulated action.', probabilities: { yes: 0.94, no: 0.06 } },
        { kind: 'action', message: 'Create an export link', status: 'simulated' },
        { kind: 'result', message: 'The export link would be created after approval.' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    render(<JevAgentPage mode="mock" />);
    fireEvent.click(screen.getByTestId('jev-agent__run-button'));

    expect(await screen.findByTestId('jev-agent__trace-jev-check')).toHaveTextContent('94%');
    expect(screen.getByTestId('jev-agent__trace-action')).toHaveTextContent(/simulated/i);
    expect(screen.getByTestId('jev-agent__code')).toHaveTextContent('runJevAgent');
    expect(screen.getByTestId('app__mode-badge')).toHaveTextContent('MOCK');
  });

  it('shows a recoverable error and preserves the sample task', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'Jev could not evaluate this action. Try again.',
    }), { status: 502, headers: { 'content-type': 'application/json' } })));

    render(<JevAgentPage mode="live" />);
    fireEvent.click(screen.getByTestId('jev-agent__run-button'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not evaluate/i);
    expect(screen.getByLabelText('Task')).toHaveValue('Prepare a customer workspace export.');
    expect(screen.getByTestId('app__mode-badge')).toHaveTextContent('LIVE');
  });
});
