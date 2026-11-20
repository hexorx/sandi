import { describe, expect, it } from 'vitest';
import { routeTicket, triageTicket } from './triage.js';
import type { JevClient } from '@sandi/jev';

describe('support ticket triage', () => {
  it('returns category, urgency, routing queue, and probabilities', async () => {
    const client = {
      mode: 'mock',
      async evaluate() {
        return {
          category: { value: 'orders', probabilities: { orders: 0.9, billing: 0.05, account: 0.05 } },
          urgency: { value: 'high', probabilities: { low: 0.05, normal: 0.05, high: 0.9 } },
          queue: { value: 'fulfillment', probabilities: { support: 0.1, billing: 0.1, fulfillment: 0.8 } },
        };
      },
    } as unknown as Pick<JevClient, 'mode' | 'evaluate'>;
    const result = await triageTicket('My order arrived damaged.', client);
    expect(result.mode).toBe('mock');
    expect(result.category.probabilities.orders).toBe(0.9);
    expect(result.needsHuman).toBe(false);
    expect(result.route).toBe('fulfillment');
  });

  it('routes low confidence decisions to human review', () => {
    expect(routeTicket({ category: 0.51, urgency: 0.8, queue: 0.9 })).toEqual({ queue: 'human-review', needsHuman: true });
  });

  it('converts provider errors into a clear user-facing error', async () => {
    const client = { mode: 'live', async evaluate() { throw new Error('private provider detail'); } } as unknown as Pick<JevClient, 'mode' | 'evaluate'>;
    await expect(triageTicket('Payment charged twice', client))
      .rejects.toThrow('Unable to triage ticket. Please retry or assign it manually.');
  });
});
