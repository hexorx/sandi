import { choice, createJevClient, JevError, noul, request, type JevClient, type JevResponse } from '@sandi/jev';
import type { ToolCallExample } from './tool-calls.js';

export type SafetyDecision = 'allow' | 'block' | 'review';

export interface ToolSafetyResult {
  mode: JevClient['mode'];
  decision: SafetyDecision;
  probabilities: { allow: number; block: number };
  reason: string;
}

const REVIEW_THRESHOLD = 0.7;

export function createToolSafetyRequest(toolCall: ToolCallExample) {
  return request(`Proposed tool call: ${toolCall.tool} — ${toolCall.action}. Context: ${toolCall.description}. Treat destructive, broad, or externally disclosing actions as risky.`, {
    allowed: noul('Is this tool call safe to perform as proposed, considering scope, reversibility, and data exposure?'),
    action: choice('Should the gate allow or block this proposed tool call?', {
      allow: 'The action is scoped, authorized, and has acceptable side effects.',
      block: 'The action is destructive, unauthorized, too broad, or exposes sensitive data.',
    }),
  });
}

export async function decideToolCall(
  toolCall: ToolCallExample,
  options: { client?: JevClient } = {},
): Promise<ToolSafetyResult> {
  const client = options.client ?? createJevClient();
  let result: JevResponse;
  try {
    result = await client.evaluate(createToolSafetyRequest(toolCall));
  } catch (error) {
    if (error instanceof JevError) throw error;
    throw new Error('Safety decision is unavailable. Try again.', { cause: error });
  }

  const allowed = result.allowed?.value === 'yes';
  const allow = clampProbability(result.action?.probabilities.allow ?? 0);
  const block = clampProbability(result.action?.probabilities.block ?? 0);
  const confidence = Math.max(allow, block);
  const decision: SafetyDecision = confidence < REVIEW_THRESHOLD
    ? 'review'
    : allowed && result.action?.value === 'allow' && allow >= REVIEW_THRESHOLD ? 'allow' : 'block';

  const reason = decision === 'review'
    ? 'Confidence is below the review threshold. A person should decide before this tool call runs.'
    : decision === 'allow'
      ? 'The proposed action appears scoped and acceptable under the safety criteria.'
      : 'The proposed action is risky or does not meet the allow criteria.';

  return { mode: client.mode, decision, probabilities: { allow, block }, reason };
}

function clampProbability(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
