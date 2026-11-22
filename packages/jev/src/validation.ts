import { JevProtocolError, type JevQuestion, type JevRequest, type JevResponse } from "./types.js";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function declaredKeys(question: JevQuestion): string[] {
  return question.type === "noul" ? ["yes", "no"] : question.type === "choice" ? Object.keys(question.criteria) : [...question.criteria];
}

function checkedProbabilities(value: unknown, keys: readonly string[]): Record<string, number> {
  if (!isObject(value) || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => typeof value[key] !== "number" || !Number.isFinite(value[key]) || (value[key] as number) < 0 || (value[key] as number) > 1)) throw new JevProtocolError("Jev returned an invalid probability distribution");
  const probabilities = Object.fromEntries(keys.map((key) => [key, value[key] as number]));
  const total = Object.values(probabilities).reduce((sum, probability) => sum + probability, 0);
  if (Math.abs(total - 1) > 1e-6) throw new JevProtocolError("Jev returned a probability distribution that does not sum to 1");
  return probabilities;
}

function highestProbability(probabilities: Record<string, number>): string {
  return Object.keys(probabilities).reduce((best, key) => probabilities[key]! > probabilities[best]! ? key : best);
}

function normalizeAnswer(question: JevQuestion, raw: unknown): JevResponse[string] {
  if (!isObject(raw)) throw new JevProtocolError("Jev returned an answer that is not an object");
  // Keep older normalized replay fixtures readable while decoding the upstream wire format.
  if ("value" in raw && "probabilities" in raw) {
    const probabilities = checkedProbabilities(raw.probabilities, declaredKeys(question));
    if (typeof raw.value !== "string" || !declaredKeys(question).includes(raw.value)) throw new JevProtocolError("Jev returned an answer value outside the requested criteria");
    return { value: raw.value, probabilities };
  }
  if (raw.type !== question.type) throw new JevProtocolError(`Jev returned an unexpected answer type (expected ${question.type})`);
  if (question.type === "noul") {
    const yes = raw.noul;
    if (typeof yes !== "number" || !Number.isFinite(yes) || yes < 0 || yes > 1) throw new JevProtocolError("Jev returned an invalid noul probability");
    return { value: yes >= 0.5 ? "yes" : "no", probabilities: { yes, no: Number((1 - yes).toPrecision(15)) } };
  }
  const criteria = declaredKeys(question);
  let probabilities: Record<string, number>;
  if (question.type === "choice" && typeof raw.choice === "string") {
    if (!criteria.includes(raw.choice)) throw new JevProtocolError("Jev returned a choice outside the requested criteria");
    probabilities = checkedProbabilities(raw.probabilities, criteria);
    return { value: raw.choice, probabilities };
  } else if (question.type === "score" && typeof raw.score === "number") {
    const legend = raw.legend;
    if (!Number.isFinite(raw.score) || raw.score < 0 || raw.score > criteria.length - 1 || !isObject(legend)) {
      throw new JevProtocolError("Jev returned a score without a valid criteria legend");
    }
    const wireKeys = Object.keys(legend);
    if (wireKeys.length !== criteria.length || wireKeys.some((key) => !/^\d+$/.test(key) || typeof legend[key] !== "string" || !criteria.includes(legend[key] as string)) || new Set(Object.values(legend)).size !== criteria.length) {
      throw new JevProtocolError("Jev returned a score legend that does not match the requested criteria");
    }
    const wireProbabilities = checkedProbabilities(raw.probabilities, wireKeys);
    probabilities = Object.fromEntries(criteria.map((criterion) => {
      const wireKey = wireKeys.find((key) => legend[key] === criterion)!;
      return [criterion, wireProbabilities[wireKey]!];
    }));
  } else {
    // Older wire replies encoded each answer kind's probability map under its kind name.
    probabilities = checkedProbabilities(raw[question.type], criteria);
  }
  return { value: highestProbability(probabilities), probabilities };
}

/** Decode the Jev wire envelope into the stable response shape consumed by callers. */
export function validateResponse<const Q extends JevRequest["questions"]>(request: JevRequest & { questions: Q }, input: unknown): JevResponse<Q> {
  if (!isObject(input)) throw new JevProtocolError("Jev returned a response that is not an object");
  if (input.model !== undefined && input.model !== request.model) throw new JevProtocolError("Jev returned an unsupported model version");
  const answers = isObject(input.answers) ? input.answers : input;
  const result: JevResponse = {};
  for (const [name, question] of Object.entries(request.questions)) {
    if (!(name in answers)) throw new JevProtocolError(`Jev response is missing answer '${name}'`);
    result[name] = normalizeAnswer(question, answers[name]);
  }
  return result as JevResponse<Q>;
}
