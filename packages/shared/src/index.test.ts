import { describe, expect, it } from 'vitest';
import { experimentId, slugify } from './index.js';

describe('slugify', () => {
  it('creates a URL-safe slug from free text', () => {
    expect(slugify('Hello, Sandi!')).toBe('hello-sandi');
  });
});

describe('experimentId', () => {
  it('uses the provided date and a slugified name', () => {
    expect(
      experimentId('Example Run', new Date('2026-11-19T12:00:00.000Z')),
    ).toBe('2026-11-19-example-run');
  });
});
