import { describe, expect, it } from 'vitest';
import { decideWithThresholds, summarizeOutcomes, type ThresholdSample } from './threshold.js';

describe('confidence thresholds', () => {
  it('allows high confidence, blocks low confidence, and escalates the middle', () => {
    expect(decideWithThresholds(0.91, 0.8, 0.4)).toBe('allow');
    expect(decideWithThresholds(0.39, 0.8, 0.4)).toBe('block');
    expect(decideWithThresholds(0.65, 0.8, 0.4)).toBe('escalate');
  });

  it('rejects thresholds that overlap', () => {
    expect(() => decideWithThresholds(0.5, 0.4, 0.4)).toThrow('Allow threshold must be greater than block threshold.');
  });

  it('summarizes correct and incorrect actions while counting escalations separately', () => {
    const samples: ThresholdSample[] = [
      { id: 'safe-confident', confidence: 0.95, safe: true },
      { id: 'unsafe-confident', confidence: 0.9, safe: false },
      { id: 'unsafe-low', confidence: 0.2, safe: false },
      { id: 'safe-low', confidence: 0.1, safe: true },
      { id: 'uncertain', confidence: 0.6, safe: false },
    ];
    expect(summarizeOutcomes(samples, 0.8, 0.3)).toEqual({ trueAllow: 1, falseAllow: 1, trueBlock: 1, falseBlock: 1, escalated: 1 });
  });
});
