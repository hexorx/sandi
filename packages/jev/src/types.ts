export const JEV_MODEL = "jev-1.14.0" as const;

export type JevQuestion =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: readonly string[] };

export interface JevRequest {
  model: typeof JEV_MODEL;
  state: string;
  questions: Record<string, JevQuestion>;
}

export type JevAnswerValue<Q extends JevQuestion> = Q extends { type: "noul" }
  ? "yes" | "no"
  : Q extends { type: "choice"; criteria: infer C extends Record<string, string> }
    ? keyof C & string
    : Q extends { type: "score"; criteria: infer C extends readonly string[] }
      ? C[number]
      : never;

export type JevAnswer<Q extends JevQuestion = JevQuestion> = {
  value: JevAnswerValue<Q>;
  probabilities: Record<JevAnswerValue<Q>, number>;
};

export type JevResponse<Q extends Record<string, JevQuestion> = Record<string, JevQuestion>> = {
  [K in keyof Q]: JevAnswer<Q[K]>;
};
export type JevMode = "mock" | "replay" | "live";

export interface JevFixture {
  schemaVersion: 1;
  requestHash: string;
  request: JevRequest;
  response: JevResponse;
}

export interface JevClient {
  readonly mode: JevMode;
  evaluate<const Q extends Record<string, JevQuestion>>(request: JevRequest & { questions: Q }, options?: { signal?: AbortSignal }): Promise<JevResponse<Q>>;
}

export type JevErrorCode = "FIXTURE_NOT_FOUND" | "HTTP_ERROR" | "TIMEOUT" | "INVALID_JSON" | "PROTOCOL_ERROR" | "LIVE_NOT_CONFIGURED";

export class JevError extends Error {
  constructor(readonly code: JevErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class FixtureNotFoundError extends JevError {
  constructor(readonly requestHash: string) {
    super("FIXTURE_NOT_FOUND", `No Jev replay fixture for ${requestHash}`);
  }
}

export class JevProtocolError extends JevError {
  constructor(message = "Jev returned a malformed response") {
    super("PROTOCOL_ERROR", message);
  }
}
