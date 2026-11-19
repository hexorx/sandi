import { JevProtocolError, type JevRequest, type JevResponse } from "./types.js";

/** Wire decoding is isolated here; the current normalized envelope is a map of question names to answers. */
export function validateResponse(request: JevRequest, input: unknown): JevResponse {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new JevProtocolError();
  const body = input as Record<string, unknown>;
  const result: JevResponse = {};
  for (const [name, question] of Object.entries(request.questions)) {
    const raw = body[name];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new JevProtocolError();
    const answer = raw as Record<string, unknown>;
    if (!(typeof answer.value === "string" || typeof answer.value === "number" || typeof answer.value === "boolean") || !answer.probabilities || typeof answer.probabilities !== "object" || Array.isArray(answer.probabilities)) throw new JevProtocolError();
    const probabilities = answer.probabilities as Record<string, unknown>;
    const expected = question.type === "noul" ? ["yes", "no"] : question.type === "choice" ? Object.keys(question.criteria) : [...question.criteria];
    if (expected.some((key) => typeof probabilities[key] !== "number" || !Number.isFinite(probabilities[key]) || (probabilities[key] as number) < 0 || (probabilities[key] as number) > 1)) throw new JevProtocolError();
    result[name] = { value: answer.value, probabilities: Object.fromEntries(expected.map((key) => [key, probabilities[key] as number])) };
  }
  return result;
}
