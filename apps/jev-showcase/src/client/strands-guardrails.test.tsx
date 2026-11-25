// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseSseEvents, StrandsGuardrailsPage } from './strands-guardrails.js';

afterEach(() => cleanup());

describe('Strands guardrails SSE example', () => {
  it('parses the explicit guardrail event extension', () => {
    expect(parseSseEvents('event: guardrail\ndata: {"stage":"output","decision":"allow"}\n\n')).toEqual([
      { event: 'guardrail', data: { stage: 'output', decision: 'allow' } },
    ]);
  });

  it('renders the individual guardrail results from a streamed verdict', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: token\ndata: {"text":"Safe answer."}\n\n'));
        controller.enqueue(new TextEncoder().encode('event: guardrail\ndata: {"stage":"output","decision":"allow","guardrails":[{"name":"email detector","decision":"allow","details":"No matching pattern detected."}]}\n\n'));
        controller.close();
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    render(<StrandsGuardrailsPage />);
    fireEvent.click(screen.getByTestId('strands-guardrails__run'));
    expect(await screen.findByTestId('strands-guardrails__answer')).toHaveTextContent('Safe answer.');
    expect(screen.getByTestId('strands-guardrails__results')).toHaveTextContent('email detector · allow');
  });

  it('shows the blocked-path detail from the streamed guardrail event', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: guardrail\ndata: {"stage":"input","decision":"block","guardrails":[{"name":"email detector","decision":"block","details":"Email address detected at character 15."}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('event: done\ndata: {"blocked":true}\n\n'));
        controller.close();
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    render(<StrandsGuardrailsPage />);
    fireEvent.click(screen.getByTestId('strands-guardrails__run'));
    expect(await screen.findByTestId('strands-guardrails__results')).toHaveTextContent('Email address detected at character 15.');
    expect(screen.queryByTestId('strands-guardrails__answer')).not.toBeInTheDocument();
  });
});
