export type ModerationDecision = 'approve' | 'flag' | 'remove';

export interface ModerationResult {
  decision: ModerationDecision;
  reviewRequired: boolean;
  probabilities: Readonly<Record<'allow' | 'flag' | 'remove', number>>;
  policyScores: Readonly<Record<string, number>>;
  reason: string;
}

export interface ModerationInput {
  content: string;
  policy: string;
}
