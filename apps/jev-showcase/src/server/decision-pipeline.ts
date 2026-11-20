import { createHash, randomUUID } from 'node:crypto';

export interface DecisionReceipt {
  id: string;
  timestamp: string;
  stage: string;
  inputHash: string;
  jev?: { model: 'jev-1.14.0'; probabilities: Record<string, number> };
  threshold: number;
  action: string;
  reason: string;
}

export interface DecisionPipelineResult {
  useCase: 'decision-pipeline';
  finalAction: string;
  receipts: DecisionReceipt[];
}

export interface DecisionPipelineInput {
  item: string;
  threshold: number;
}

const decisionReceiptLog: DecisionReceipt[] = [];

export function getDecisionReceiptLog(): readonly DecisionReceipt[] {
  return decisionReceiptLog;
}

function hash(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function makeReceipt(stage: string, item: string, threshold: number, action: string, reason: string, probabilities?: Record<string, number>): DecisionReceipt {
  return {
    id: randomUUID(), timestamp: new Date().toISOString(), stage,
    inputHash: hash(JSON.stringify({ stage, item })),
    ...(probabilities ? { jev: { model: 'jev-1.14.0', probabilities } } : {}),
    threshold, action, reason,
  };
}

async function runSingleDecision(input: DecisionPipelineInput): Promise<DecisionPipelineResult> {
  if (typeof input.item !== 'string' || input.item.trim().length === 0 || input.item.length > 500) {
    throw new Error('Enter an item between 1 and 500 characters.');
  }
  if (!Number.isFinite(input.threshold) || input.threshold < 0 || input.threshold > 1) {
    throw new Error('Threshold must be between 0 and 1.');
  }

  const item = input.item.trim();
  const receipts: DecisionReceipt[] = [];
  const unsafe = /\b(block|unsafe|harmful)\b/i.test(item);
  const safetyProbability = unsafe ? 0.94 : /ambiguous/i.test(item) ? 0.52 : 0.91;
  const safetyAction = safetyProbability >= input.threshold ? (unsafe ? 'block' : 'allow') : 'review';
  receipts.push(makeReceipt('safety', item, input.threshold, safetyAction,
    safetyAction === 'review' ? 'Safety confidence is below the configured threshold; routed for review.' : `Safety gate ${safetyAction}ed the item based on its synthetic signal.`,
    { allow: unsafe ? 1 - safetyProbability : safetyProbability, block: unsafe ? safetyProbability : 1 - safetyProbability }));

  if (safetyAction === 'block') {
    receipts.push(makeReceipt('quality', item, input.threshold, 'skipped', 'Skipped because the safety gate blocked the item.'));
    receipts.push(makeReceipt('routing', item, input.threshold, 'skipped', 'Skipped because the safety gate blocked the item.'));
    return { useCase: 'decision-pipeline', finalAction: 'block', receipts };
  }

  const qualityProbability = /ambiguous/i.test(item) ? 0.56 : 0.88;
  const qualityAction = qualityProbability >= input.threshold ? 'pass' : 'review';
  receipts.push(makeReceipt('quality', item, input.threshold, qualityAction,
    qualityAction === 'review' ? 'Quality confidence is below the configured threshold; routed for review.' : 'Quality gate passed the item.',
    { pass: qualityProbability, review: 1 - qualityProbability }));
  if (qualityAction === 'review') {
    receipts.push(makeReceipt('routing', item, input.threshold, 'skipped', 'Skipped because quality requires review.'));
    return { useCase: 'decision-pipeline', finalAction: 'review', receipts };
  }

  receipts.push(makeReceipt('routing', item, input.threshold, 'approved-queue', 'Quality passed; routed to the approved queue.', { 'approved-queue': 0.88, 'manual-review': 0.12 }));
  return { useCase: 'decision-pipeline', finalAction: 'approved-queue', receipts };
}

export async function runDecisionPipeline(input: DecisionPipelineInput): Promise<DecisionPipelineResult> {
  if (typeof input.item !== 'string') throw new Error('Enter one or more items.');
  const items = input.item.split('\n').map((item) => item.trim()).filter(Boolean);
  if (items.length === 0 || items.length > 20) throw new Error('Enter between 1 and 20 items, one per line.');
  const results = await Promise.all(items.map((item) => runSingleDecision({ item, threshold: input.threshold })));
  const receipts = results.flatMap((result, index) => result.receipts.map((receipt) => ({
    ...receipt,
    stage: items.length === 1 ? receipt.stage : `Item ${index + 1} · ${receipt.stage}`,
  })));
  const finalAction = results.some((result) => result.finalAction === 'block') ? 'block'
    : results.some((result) => result.finalAction === 'review') ? 'review' : 'approved-queue';
  decisionReceiptLog.push(...receipts);
  if (decisionReceiptLog.length > 1_000) decisionReceiptLog.splice(0, decisionReceiptLog.length - 1_000);
  return { useCase: 'decision-pipeline', finalAction, receipts };
}
