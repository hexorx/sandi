// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionPipelinePage } from './decision-pipeline-page.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('decision pipeline page', () => {
  it('runs a sample and shows inspectable JSON receipts in mock mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      useCase: 'decision-pipeline', finalAction: 'allow', mode: 'mock',
      receipts: [{ id: 'receipt-1', stage: 'safety', action: 'allow', reason: 'Synthetic safe example', timestamp: '2026-01-01T00:00:00Z', inputHash: `sha256:${'a'.repeat(64)}`, threshold: 0.7, jev: { model: 'jev-1.14.0', probabilities: { allow: 0.9 } } }],
    }) }));
    render(<DecisionPipelinePage mode="mock" />);
    fireEvent.click(screen.getByRole('button', { name: /run pipeline/i }));
    expect(await screen.findByTestId('decision-receipt-log')).toHaveTextContent('Synthetic safe example');
    expect(screen.getByTestId('decision-receipt-json')).toHaveTextContent('receipt-1');
    expect(screen.getByLabelText('Runtime mode')).toHaveTextContent('MOCK');
  });

  it('shows a clear error when the backend fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Pipeline unavailable' }) }));
    render(<DecisionPipelinePage mode="mock" />);
    fireEvent.click(screen.getByRole('button', { name: /run pipeline/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pipeline unavailable');
  });
});
