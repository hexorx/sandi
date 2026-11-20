// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolSafetyPage } from './tool-safety-page.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('tool safety page', () => {
  it('lets a user choose a tool call and shows the decision with probabilities', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mode: 'mock', decision: 'block', probabilities: { allow: 0.04, block: 0.96 }, reason: 'Destructive commands are blocked.' }) }));
    render(<ToolSafetyPage />);
    fireEvent.click(screen.getByRole('button', { name: /evaluate tool call/i }));
    expect(await screen.findByTestId('tool-safety-decision')).toHaveTextContent('BLOCK');
    expect(screen.getByTestId('tool-safety-probability-allow')).toHaveTextContent('4%');
  });

  it('shows a review state and a clear error when evaluation fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ mode: 'mock', decision: 'review', probabilities: { allow: 0.51, block: 0.49 }, reason: 'Confidence is below the review threshold.' }) }).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Safety decision is unavailable. Try again.' }) }));
    render(<ToolSafetyPage />);
    fireEvent.click(screen.getByRole('button', { name: /evaluate tool call/i }));
    expect(await screen.findByTestId('tool-safety-decision')).toHaveTextContent('REVIEW');
    fireEvent.click(screen.getByRole('button', { name: /evaluate tool call/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i);
  });
});
