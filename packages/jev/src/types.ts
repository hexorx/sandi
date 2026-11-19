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

export interface JevAnswer {
  value: string | number | boolean;
  probabilities: Record<string, number>;
}

export type JevResponse = Record<string, JevAnswer>;
export type JevMode = "mock" | "replay" | "live";

export interface JevFixture {
  schemaVersion: 1;
  requestHash: string;
  request: JevRequest;
  response: JevResponse;
}

export interface JevClient {
  readonly mode: JevMode;
  evaluate(request: JevRequest, options?: { signal?: AbortSignal }): Promise<JevResponse>;
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
