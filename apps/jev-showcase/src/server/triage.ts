import { choice, createJevClient, request, score, type JevClient, type JevQuestion } from '@sandi/jev';

const CONFIDENCE_THRESHOLD = 0.65;
const questions = {
  category: choice('Choose the best ticket category.', { orders: 'Order, delivery, or return issue', billing: 'Payment, invoice, or refund', account: 'Sign-in, profile, or account access' }),
  urgency: score('Rate how urgently this ticket needs attention.', ['low', 'normal', 'high'] as const),
  queue: choice('Choose the team best equipped to resolve this ticket.', { support: 'General customer support', billing: 'Payments and refunds team', fulfillment: 'Orders and delivery team' }),
} satisfies Record<string, JevQuestion>;

export type Confidence = { category: number; urgency: number; queue: number };
export function routeTicket(confidence: Confidence): { queue: string; needsHuman: boolean } {
  const needsHuman = Math.min(confidence.category, confidence.urgency, confidence.queue) < CONFIDENCE_THRESHOLD;
  return { queue: needsHuman ? 'human-review' : 'assigned', needsHuman };
}

export async function triageTicket(ticket: string, client: Pick<JevClient, 'mode' | 'evaluate'> = createJevClient()): Promise<{
  mode: JevClient['mode']; category: { value: string; probabilities: Record<string, number> };
  urgency: { value: string; probabilities: Record<string, number> }; queue: { value: string; probabilities: Record<string, number> };
  route: string; needsHuman: boolean;
}> {
  if (!ticket.trim()) throw new Error('Enter a ticket description before triage.');
  try {
    const response = await client.evaluate(request(`Support ticket: ${ticket}`, questions));
    const confidence = {
      category: Math.max(...Object.values(response.category.probabilities)),
      urgency: Math.max(...Object.values(response.urgency.probabilities)),
      queue: Math.max(...Object.values(response.queue.probabilities)),
    };
    const routing = routeTicket(confidence);
    return { mode: client.mode, category: response.category, urgency: response.urgency, queue: response.queue, route: routing.needsHuman ? routing.queue : response.queue.value, needsHuman: routing.needsHuman };
  } catch {
    throw new Error('Unable to triage ticket. Please retry or assign it manually.');
  }
}
