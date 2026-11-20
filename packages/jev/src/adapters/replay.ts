import { hashRequest } from "../canonical.js";
import { FixtureNotFoundError, type JevFixture, type JevRequest, type JevResponse } from "../types.js";

export function replayResponse(request: JevRequest, fixtures: readonly JevFixture[]): JevResponse {
  const hash = hashRequest(request);
  const fixture = fixtures.find((candidate) => candidate.requestHash === hash);
  if (!fixture) throw new FixtureNotFoundError(hash);
  return fixture.response;
}
