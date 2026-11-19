import { JevProtocolError, type JevQuestion, type JevRequest, type JevResponse } from "./types.js";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function declaredKeys(question: JevQuestion): string[] {
  return question.type === "noul" ? ["yes", "no"] : question.type === "choice" ? Object.keys(question.criteria) : [...question.criteria];
}

function checkedProbabilities(value: unknown, keys: readonly string[]): Record<string, number> {
  if (!isObject(value) || keys.some((key) => typeof value[key] !== "number" || !Number.isFinite(value[key]) || (value[key] as number) < 0 || (value[key] as number) > 1)) throw new JevProtocolError();
  const probabilities = Object.fromEntries(keys.map((key) => [key, value[key] as number]));
  const total = Object.values(probabilities).reduce((sum, probability) => sum + probability, 0);
  if (Math.abs(total - 1) > 1e-6) throw new JevProtocolError();
  return probabilities;
}

function highestProbability(probabilities: Record<string, number>): string {
  return Object.keys(probabilities).reduce((best, key) => probabilities[key]! > probabilities[best]! ? key : best);
}

function normalizeAnswer(question: JevQuestion, raw: unknown): JevResponse[string] {
  if (!isObject(raw)) throw new JevProtocolError();
  // Keep older normalized replay fixtures readable while decoding the upstream wire format.
  if ("value" in raw && "probabilities" in raw) {
    const probabilities = checkedProbabilities(raw.probabilities, declaredKeys(question));
    if (typeof raw.value !== "string" || !declaredKeys(question).includes(raw.value)) throw new JevProtocolError();
    return { value: raw.value, probabilities };
  }
  if (raw.type !== question.type) throw new JevProtocolError();
  if (question.type === "noul") {
    const yes = raw.noul;
    if (typeof yes !== "number" || !Number.isFinite(yes) || yes < 0 || yes > 1) throw new JevProtocolError();
    return { value: yes >= 0.5 ? "yes" : "no", probabilities: { yes, no: Number((1 - yes).toPrecision(15)) } };
  }
  const probabilities = checkedProbabilities(raw[question.type], declaredKeys(question));
  return { value: highestProbability(probabilities), probabilities };
}

/** Decode the Jev wire envelope into the stable response shape consumed by callers. */
export function validateResponse<const Q extends JevRequest["questions"]>(request: JevRequest & { questions: Q }, input: unknown): JevResponse<Q> {
  if (!isObject(input)) throw new JevProtocolError();
  if (input.model !== undefined && input.model !== request.model) throw new JevProtocolError();
  const answers = isObject(input.answers) ? input.answers : input;
  const result: JevResponse = {};
  for (const [name, question] of Object.entries(request.questions)) result[name] = normalizeAnswer(question, answers[name]);
  return result as JevResponse<Q>;
}
