export type ThresholdDecision = 'allow' | 'block' | 'escalate';

export interface ThresholdSample {
  id: string;
  confidence: number;
  safe: boolean;
}

export interface OutcomeSummary {
  trueAllow: number;
  falseAllow: number;
  trueBlock: number;
  falseBlock: number;
  escalated: number;
}

export function decideWithThresholds(confidence: number, allowThreshold: number, blockThreshold: number): ThresholdDecision {
  if (allowThreshold <= blockThreshold) throw new Error('Allow threshold must be greater than block threshold.');
  if (confidence >= allowThreshold) return 'allow';
  if (confidence < blockThreshold) return 'block';
  return 'escalate';
}

export function summarizeOutcomes(samples: ThresholdSample[], allowThreshold: number, blockThreshold: number): OutcomeSummary {
  return samples.reduce<OutcomeSummary>((summary, sample) => {
    const decision = decideWithThresholds(sample.confidence, allowThreshold, blockThreshold);
    if (decision === 'escalate') summary.escalated += 1;
    else if (decision === 'allow' && sample.safe) summary.trueAllow += 1;
    else if (decision === 'allow') summary.falseAllow += 1;
    else if (sample.safe) summary.falseBlock += 1;
    else summary.trueBlock += 1;
    return summary;
  }, { trueAllow: 0, falseAllow: 0, trueBlock: 0, falseBlock: 0, escalated: 0 });
}

export const playgroundScenarios = {
  'tool-safety': {
    label: 'Tool call safety',
    question: 'Should the agent run this command?',
    description: 'rm -rf ./cache — remove generated cache files',
    probabilities: { Safe: 0.23, 'Needs review': 0.62, Unsafe: 0.15 },
    safe: false,
  },
  'message-safety': {
    label: 'Message moderation',
    question: 'Is this reply safe to send?',
    description: 'Your refund has been processed. It should arrive in 3–5 business days.',
    probabilities: { Safe: 0.91, 'Needs review': 0.06, Unsafe: 0.03 },
    safe: true,
  },
  'account-access': {
    label: 'Account access',
    question: 'Does this request need a human check?',
    description: 'Reset access after a caller cannot verify the account email.',
    probabilities: { Safe: 0.48, 'Needs review': 0.4, Unsafe: 0.12 },
    safe: false,
  },
} as const;

export const thresholdSamples: ThresholdSample[] = [
  { id: 'routine-tool', confidence: 0.94, safe: true },
  { id: 'known-malware', confidence: 0.96, safe: false },
  { id: 'verified-refund', confidence: 0.88, safe: true },
  { id: 'unverified-reset', confidence: 0.28, safe: false },
  { id: 'ambiguous-message', confidence: 0.58, safe: false },
  { id: 'unclear-command', confidence: 0.42, safe: true },
];
