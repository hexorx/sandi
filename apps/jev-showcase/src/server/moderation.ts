import { choice, createJevClient, request, score, type JevClient } from '@sandi/jev';
import { evaluateModeration, type ModerationAnswer } from '../moderation-core.js';
import type { ModerationInput, ModerationResult } from '../moderation-contract.js';
export { evaluateModeration, type ModerationAnswer } from '../moderation-core.js';

export class ModerationError extends Error {
  readonly code = 'UPSTREAM_ERROR';
  readonly message = 'Decision unavailable. Try again.';

  constructor() {
    super('Decision unavailable. Try again.');
    this.name = 'ModerationError';
  }
}

const policyNames = ['harassment', 'threats', 'spam'] as const;

export function createModerationRequest({ content, policy }: ModerationInput) {
  const normalizedContent = content.trim();
  const normalizedPolicy = policy.trim();
  if (!normalizedContent || normalizedContent.length > 5_000) throw new TypeError('Content must be between 1 and 5000 characters.');
  if (!normalizedPolicy || normalizedPolicy.length > 500) throw new TypeError('Policy must be between 1 and 500 characters.');

  return request(`Review this user post against the policy.\nPolicy: ${normalizedPolicy}\nPost: ${normalizedContent}`, {
    outcome: choice('Choose the moderation action supported by the policy and post.', {
      allow: 'Approve content that follows the policy.',
      flag: 'Send uncertain or borderline content to a human reviewer.',
      remove: 'Remove content that clearly violates the policy.',
    }),
    harassment: score('Rate the likelihood of targeted harassment under the policy.', ['low', 'medium', 'high']),
    threats: score('Rate the likelihood of a direct threat under the policy.', ['low', 'medium', 'high']),
    spam: score('Rate the likelihood of repetitive or deceptive spam under the policy.', ['low', 'medium', 'high']),
  });
}

export async function runModeration(input: ModerationInput, client: JevClient = createJevClient()): Promise<ModerationResult> {
  const moderationRequest = createModerationRequest(input);
  try {
    const response = await client.evaluate(moderationRequest);
    const answer = {
      outcome: response.outcome,
      policyScores: Object.fromEntries(policyNames.map((name) => [name, response[name]])),
    };
    return evaluateModeration(answer as ModerationAnswer);
  } catch {
    throw new ModerationError();
  }
}
