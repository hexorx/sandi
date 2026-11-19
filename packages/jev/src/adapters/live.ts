import { JevError, JevProtocolError, type JevRequest, type JevResponse } from "../types.js";
import { validateResponse } from "../validation.js";

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export async function liveResponse(request: JevRequest, apiKey: string, fetcher: typeof fetch, timeoutMs: number, signal?: AbortSignal): Promise<JevResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const relayAbort = () => controller.abort();
  signal?.addEventListener("abort", relayAbort, { once: true });
  try {
    const response = await fetcher(JEV_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) throw new JevError("HTTP_ERROR", `Jev request failed with HTTP ${response.status}`);
    let body: unknown;
    try { body = await response.json(); } catch { throw new JevError("INVALID_JSON", "Jev returned invalid JSON"); }
    return validateResponse(request, body);
  } catch (error) {
    if (error instanceof JevError) throw error;
    if (controller.signal.aborted) throw new JevError("TIMEOUT", "Jev request timed out or was cancelled");
    throw new JevError("HTTP_ERROR", "Jev request failed");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", relayAbort);
  }
}

export function isProtocolError(error: unknown): error is JevProtocolError {
  return error instanceof JevProtocolError;
}
