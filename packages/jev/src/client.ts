import { liveResponse } from "./adapters/live.js";
import { mockResponse } from "./adapters/mock.js";
import { replayResponse } from "./adapters/replay.js";
import { JevError, type JevClient, type JevFixture, type JevMode, type JevRequest, type JevResponse } from "./types.js";

export interface JevClientOptions {
  mode?: JevMode;
  apiKey?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  fixtures?: readonly JevFixture[];
  runtime?: { nodeEnv?: string; ci?: boolean };
}

export function createJevClient(options: JevClientOptions = {}): JevClient {
  const inferredMode: JevMode = options.apiKey && options.runtime?.nodeEnv !== "test" && options.runtime?.ci !== true ? "live" : "mock";
  const mode = options.mode ?? inferredMode;
  if (mode === "live" && !options.apiKey) throw new JevError("LIVE_NOT_CONFIGURED", "Live Jev mode requires an API key");
  const evaluate = async (request: JevRequest, evaluateOptions?: { signal?: AbortSignal }): Promise<JevResponse> => {
    if (mode === "mock") return mockResponse(request);
    if (mode === "replay") return replayResponse(request, options.fixtures ?? []);
    return liveResponse(request, options.apiKey!, options.fetch ?? fetch, options.timeoutMs ?? 10_000, evaluateOptions?.signal);
  };
  return { mode, evaluate };
}
