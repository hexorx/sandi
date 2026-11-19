import { JEV_MODEL, type JevQuestion, type JevRequest } from "./types.js";

export function noul(instructions: string): JevQuestion {
  return { type: "noul", instructions };
}

export function choice<const C extends Record<string, string>>(instructions: string, criteria: C): JevQuestion & { type: "choice"; criteria: C } {
  validateCriteria(criteria);
  return { type: "choice", instructions, criteria };
}

export function score<const C extends readonly string[]>(instructions: string, criteria: C): JevQuestion & { type: "score"; criteria: C } {
  if (!Array.isArray(criteria) || criteria.length === 0 || criteria.some((entry) => !entry.trim())) {
    throw new TypeError("score criteria must be a non-empty array of non-empty levels");
  }
  return { type: "score", instructions, criteria };
}

export function request<const Q extends Record<string, JevQuestion>>(state: string, questions: Q): JevRequest & { questions: Q } {
  if (!state.trim()) throw new TypeError("state must be non-empty");
  if (Object.keys(questions).length === 0) throw new TypeError("questions must be non-empty");
  return { model: JEV_MODEL, state, questions };
}

function validateCriteria(criteria: Record<string, string>): void {
  if (!criteria || Object.keys(criteria).length < 2 || Object.entries(criteria).some(([key, value]) => !key.trim() || !value.trim())) {
    throw new TypeError("choice criteria must contain at least two named options with descriptions");
  }
}
