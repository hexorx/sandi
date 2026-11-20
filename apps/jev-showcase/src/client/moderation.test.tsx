// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentModerationPage } from './moderation.js';
import type { ModerationResult } from '../moderation-contract.js';

afterEach(() => cleanup());

describe('content moderation page', () => {
  it('shows a reachable form, policy scores, mode and implementation code', async () => {
    const mockResult: ModerationResult = {
      decision: 'approve', reviewRequired: false, probabilities: { allow: 0.8, flag: 0.1, remove: 0.1 },
      policyScores: { harassment: 0.1, threats: 0.05, spam: 0.2 }, reason: 'The post follows the displayed policy.',
    };
    render(<ContentModerationPage mode="mock" run={async () => mockResult} />);
    expect(screen.getByTestId('content-moderation__policy-input')).toBeInTheDocument();
    expect(screen.getByTestId('app__mode-badge')).toHaveTextContent('MOCK');
    await userEvent.click(screen.getByTestId('content-moderation__run-button'));
    expect(await screen.findByTestId('content-moderation__decision-chip')).toBeInTheDocument();
    expect(screen.getByTestId('content-moderation__policy-score-harassment')).toBeInTheDocument();
    expect(screen.getByTestId('content-moderation__code-panel')).toHaveTextContent('evaluateModeration');
  });

  it('shows a recoverable error and human-review band', async () => {
    const run = vi.fn().mockRejectedValue(new Error('offline'));
    render(<ContentModerationPage mode="mock" run={run} />);
    await userEvent.click(screen.getByTestId('content-moderation__run-button'));
    expect(await screen.findByTestId('content-moderation__error')).toHaveTextContent('Decision unavailable');
    expect(run).toHaveBeenCalledOnce();

    render(<ContentModerationPage mode="mock" initialResult={{
      decision: 'flag', reviewRequired: true, probabilities: { allow: 0.41, flag: 0.34, remove: 0.25 },
      policyScores: { harassment: 0.2 }, reason: 'The result is borderline and needs a human review.',
    }} />);
    expect(screen.getByTestId('content-moderation__review-band')).toHaveTextContent('Human review');
  });

  it('requires confirmation before sending content in live mode', async () => {
    const run = vi.fn();
    render(<ContentModerationPage mode="live" run={run} />);
    await userEvent.click(screen.getByTestId('content-moderation__run-button'));
    expect(screen.getByRole('alert')).toHaveTextContent('Confirm that this sample will be sent');
    expect(run).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('content-moderation__live-confirmation'));
    await userEvent.click(screen.getByTestId('content-moderation__run-button'));
    expect(run).toHaveBeenCalledOnce();
  });
});
