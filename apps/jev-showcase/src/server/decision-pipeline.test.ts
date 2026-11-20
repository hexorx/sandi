import { describe, expect, it } from 'vitest';
import { getDecisionReceiptLog, runDecisionPipeline } from './decision-pipeline.js';

describe('decision pipeline', () => {
  it('records a receipt for every gate, including skipped gates', async () => {
    const result = await runDecisionPipeline({ item: 'unsafe synthetic item', threshold: 0.7 });
    expect(result.useCase).toBe('decision-pipeline');
    expect(result.receipts).toHaveLength(3);
    expect(result.receipts[0]?.inputHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.receipts[1]?.action).toBe('skipped');
    expect(result.receipts[1]?.reason).toBeTruthy();
    expect(result.receipts[2]?.jev).toBeUndefined();
  });

  it('returns low confidence as an explicit review decision with receipts', async () => {
    const result = await runDecisionPipeline({ item: 'ambiguous synthetic item', threshold: 0.95 });
    expect(result.finalAction).toBe('review');
    expect(result.receipts.every((receipt) => receipt.reason.length > 0)).toBe(true);
  });

  it('rejects invalid thresholds with a safe actionable message', async () => {
    await expect(runDecisionPipeline({ item: 'example', threshold: 2 })).rejects.toThrow('Threshold must be between 0 and 1.');
  });

  it('processes a newline-delimited stream and preserves item and stage order', async () => {
    const result = await runDecisionPipeline({ item: 'routine item\nunsafe item', threshold: 0.7 });
    expect(result.receipts).toHaveLength(6);
    expect(result.receipts[0]?.stage).toBe('Item 1 · safety');
    expect(result.receipts[3]?.stage).toBe('Item 2 · safety');
    expect(result.finalAction).toBe('block');
  });

  it('keeps receipts in the in-memory log across pipeline runs', async () => {
    const before = getDecisionReceiptLog().length;
    await runDecisionPipeline({ item: 'first log item', threshold: 0.7 });
    await runDecisionPipeline({ item: 'second log item', threshold: 0.7 });
    expect(getDecisionReceiptLog().length).toBe(before + 6);
  });
});
