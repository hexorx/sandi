// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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

  it('links to the tool safety use case from navigation', () => {
    render(<App mode="mock" />);
    expect(screen.getByRole('link', { name: /tool safety/i })).toHaveAttribute('href', '/tool-safety');
  });

  it('renders the tool safety page at its route', () => {
    render(<App mode="mock" path="/tool-safety" />);
    expect(screen.getByRole('heading', { name: /should this tool call run/i })).toBeTruthy();
    expect(screen.getByTestId('tool-safety-code').textContent).toContain('createToolSafetyRequest');
  });
});
