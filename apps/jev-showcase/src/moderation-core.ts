import type { ModerationResult } from './moderation-contract.js';

export interface ModerationAnswer {
  outcome: { value: 'allow' | 'flag' | 'remove'; probabilities: Record<'allow' | 'flag' | 'remove', number> };
  policyScores: Record<string, { value: 'low' | 'medium' | 'high'; probabilities: Record<'low' | 'medium' | 'high', number> }>;
}

export function evaluateModeration(answer: ModerationAnswer): ModerationResult {
  const confidence = answer.outcome.probabilities[answer.outcome.value];
  const reviewRequired = answer.outcome.value === 'flag' || confidence < 0.65;
  const decision = reviewRequired ? 'flag' : answer.outcome.value === 'allow' ? 'approve' : 'remove';
  const policyScores = Object.fromEntries(Object.entries(answer.policyScores).map(([name, score]) => [
    name,
    Number((1 - score.probabilities.low).toFixed(3)),
  ]));
  const reason = reviewRequired
    ? 'The result is borderline and needs a human review.'
    : decision === 'approve'
      ? 'The post follows the displayed policy.'
      : 'The post clearly violates the displayed policy.';

  return { decision, reviewRequired, probabilities: answer.outcome.probabilities, policyScores, reason };
}
