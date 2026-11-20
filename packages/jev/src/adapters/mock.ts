import { createHash } from "node:crypto";
import { canonicalJson } from "../canonical.js";
import { validateResponse } from "../validation.js";
import type { JevRequest, JevResponse } from "../types.js";

/** Hash the canonical request plus each answer key, map digest bytes to positive weights, then normalize. */
export function mockResponse(request: JevRequest): JevResponse {
  const seed = canonicalJson(request);
  const answers = Object.fromEntries(Object.entries(request.questions).map(([name, question]) => {
    const keys = question.type === "noul" ? ["yes", "no"] : question.type === "choice" ? Object.keys(question.criteria).sort() : [...question.criteria];
    const weights = keys.map((key) => 1 + createHash("sha256").update(`${seed}\0${name}\0${key}`).digest()[0]! / 255);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const probabilities = Object.fromEntries(keys.map((key, index) => [key, weights[index]! / total]));
    return [name, question.type === "noul"
      ? { type: "noul", noul: probabilities.yes }
      : { type: question.type, [question.type]: probabilities }];
  }));
  return validateResponse(request, { model: request.model, answers });
}
