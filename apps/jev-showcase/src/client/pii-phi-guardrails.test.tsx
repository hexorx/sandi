// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PiiPhiGuardrailsPage } from './pii-phi-guardrails.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('PII/PHI guardrails page', () => {
  it('shows the synthetic-only notice, engine controls, mode and source code', () => {
    render(<PiiPhiGuardrailsPage />);
    expect(screen.getByTestId('app__mode-badge')).toHaveTextContent('MOCK');
    expect((screen.getByTestId('pii-phi__input') as HTMLTextAreaElement).value).toContain('Example Person');
    expect(screen.getByText(/Synthetic examples only/)).toBeInTheDocument();
    expect(screen.getByTestId('pii-phi__code')).toHaveTextContent('detectSensitivePatterns');
  });

  it('shows blocked findings and what the mock agent received', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ execution: { mode: 'single', result: {
      engine: 'mock', requestedEngine: 'jev', latencyMs: 0, answer: { guardrails: { action: 'block', reasonCode: 'sensitive_pattern', findings: [{ category: 'email', start: 9, end: 30, confidence: 'high' }] }, received: null }, confidence: {},
    } } }) }));
    render(<PiiPhiGuardrailsPage />);
    await userEvent.click(screen.getByTestId('pii-phi__run'));
    expect(await screen.findByTestId('pii-phi__agent-blocked')).toHaveTextContent('received nothing');
    expect(screen.getByTestId('pii-phi__findings')).toHaveTextContent('email · high confidence');
  });

  it('shows a recoverable message when the guardrail endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<PiiPhiGuardrailsPage />);
    await userEvent.click(screen.getByTestId('pii-phi__run'));
    expect(await screen.findByTestId('pii-phi__error')).toHaveTextContent('offline');
  });
});
