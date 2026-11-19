import { JevProtocolError, type JevRequest, type JevResponse } from "./types.js";

/** Wire decoding is isolated here; the current normalized envelope is a map of question names to answers. */
export function validateResponse<const Q extends JevRequest["questions"]>(request: JevRequest & { questions: Q }, input: unknown): JevResponse<Q> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new JevProtocolError();
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((name) => Object.hasOwn(request.questions, name) === false && name !== "authorization")) throw new JevProtocolError();
  const result: Record<string, unknown> = {};
  for (const [name, question] of Object.entries(request.questions)) {
    const raw = body[name];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new JevProtocolError();
    const answer = raw as Record<string, unknown>;
    if (typeof answer.value !== "string" || !answer.probabilities || typeof answer.probabilities !== "object" || Array.isArray(answer.probabilities)) throw new JevProtocolError();
    const probabilities = answer.probabilities as Record<string, unknown>;
    const expected = question.type === "noul" ? ["yes", "no"] : question.type === "choice" ? Object.keys(question.criteria) : [...question.criteria];
    if (!expected.includes(answer.value) || Object.keys(probabilities).length !== expected.length || expected.some((key) => typeof probabilities[key] !== "number" || !Number.isFinite(probabilities[key]) || (probabilities[key] as number) < 0 || (probabilities[key] as number) > 1)) throw new JevProtocolError();
    const total = expected.reduce((sum, key) => sum + (probabilities[key] as number), 0);
    if (Math.abs(total - 1) > 1e-6) throw new JevProtocolError();
    result[name] = { value: answer.value, probabilities: Object.fromEntries(expected.map((key) => [key, probabilities[key] as number])) };
  }
  return result as JevResponse<Q>;
}
