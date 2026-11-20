// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app.js';

afterEach(() => cleanup());

describe('landing page', () => {
  it('shows the showcase introduction and mock mode badge', () => {
    render(<App mode="mock" />);
    expect(screen.getByRole('heading', { name: /decisions, made clear/i })).toBeTruthy();
    expect(screen.getByLabelText('Runtime mode')).toHaveTextContent('MOCK');
  });

  it('shows a live mode badge when the server reports live mode', () => {
    render(<App mode="live" />);
    expect(screen.getByLabelText('Runtime mode')).toHaveTextContent('LIVE');
  });

  it('shows the triage page, probabilities, and source code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      mode: 'mock', route: 'fulfillment', needsHuman: false,
      category: { value: 'orders', probabilities: { orders: 0.91, billing: 0.05, account: 0.04 } },
      urgency: { value: 'normal', probabilities: { low: 0.1, normal: 0.8, high: 0.1 } },
      queue: { value: 'fulfillment', probabilities: { support: 0.1, billing: 0.1, fulfillment: 0.8 } },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    render(<App mode="mock" />);
    expect(screen.getByTestId('nav-support-triage')).toHaveAttribute('href', '#support-triage');
    fireEvent.click(screen.getByTestId('triage-button'));
    expect(await screen.findByTestId('triage-result')).toHaveTextContent('fulfillment');
    expect(screen.getByTestId('triage-confidence-category')).toHaveTextContent('91%');
    expect(screen.getByTestId('triage-code')).toHaveTextContent('CONFIDENCE_THRESHOLD');
    expect(fetch).toHaveBeenCalledWith('/api/triage', expect.objectContaining({ method: 'POST' }));
  });

  it('shows a needs-human state for low confidence triage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ route: 'human-review', needsHuman: true,
      category: { value: 'orders', probabilities: { orders: 0.51, billing: 0.3, account: 0.19 } },
      urgency: { value: 'normal', probabilities: { low: 0.1, normal: 0.8, high: 0.1 } },
      queue: { value: 'fulfillment', probabilities: { support: 0.1, billing: 0.1, fulfillment: 0.8 } },
    }), { status: 200 }));
    render(<App mode="mock" />);
    fireEvent.click(screen.getByTestId('triage-button'));
    expect(await screen.findByTestId('needs-human')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
