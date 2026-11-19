import { describe, expect, expectTypeOf, it, vi } from "vitest";
import realNoulResponse from "./fixtures/real-noul-response.json" with { type: "json" };
import { choice, createJevClient, hashRequest, JevError, noul, request, score, validateResponse } from "../src/index.js";

const demoRequest = request("A synthetic tool request", {
  safe: noul("Should the tool call be allowed?"),
  route: choice("Choose a route", { support: "Support queue", billing: "Billing queue" }),
  urgency: score("Rate urgency", ["low", "medium", "high"] as const),
});

describe("typed responses", () => {
  it("preserves declared question and answer keys in the client result", async () => {
    const response = await createJevClient().evaluate(demoRequest);
    expectTypeOf(response.safe.value).toEqualTypeOf<"yes" | "no">();
    expectTypeOf(response.route.value).toEqualTypeOf<"support" | "billing">();
    expectTypeOf(response.urgency.value).toEqualTypeOf<"low" | "medium" | "high">();
    expectTypeOf(response.route.probabilities).toEqualTypeOf<Record<"support" | "billing", number>>();
    expectTypeOf(response).toHaveProperty("safe");
  });
});

describe("request builders", () => {
  it("normalizes the recorded real Jev answers envelope", () => {
    const realRequest = request("synthetic", { safe: noul("Allow this synthetic action?") });
    expect(validateResponse(realRequest, realNoulResponse)).toEqual({
      safe: { value: "yes", probabilities: { yes: 0.56, no: 0.44 } },
    });
  });

  it("normalizes choice and score distributions from typed Jev answers", () => {
    const typedRequest = request("synthetic", {
      route: choice("Choose a route", { support: "Support", billing: "Billing" }),
      urgency: score("Rate urgency", ["low", "high"] as const),
    });
    expect(validateResponse(typedRequest, { model: "jev-1.14.0", answers: {
      route: { type: "choice", choice: { support: 0.7, billing: 0.3 } },
      urgency: { type: "score", score: { low: 0.2, high: 0.8 } },
    }, usage: { input_tokens: 1, output_tokens: 1 } })).toEqual({
      route: { value: "support", probabilities: { support: 0.7, billing: 0.3 } },
      urgency: { value: "high", probabilities: { low: 0.2, high: 0.8 } },
    });
  });

  it("rejects wire answers with an unexpected type or invalid distribution", () => {
    const req = request("synthetic", { route: choice("Choose", { support: "Support", billing: "Billing" }) });
    expect(() => validateResponse(req, { answers: { route: { type: "score", choice: { support: 0.7, billing: 0.3 } } } })).toThrowError();
    expect(() => validateResponse(req, { answers: { route: { type: "choice", choice: { support: 0.7, billing: 0.2 } } } })).toThrowError();
    expect(() => validateResponse(req, { answers: { route: { type: "choice", choice: { support: 1.1, billing: -0.1 } } } })).toThrowError();
    expect(() => validateResponse(req, { answers: { route: { type: "choice", choice: { support: 0.7, billing: 0.3, unexpected: 1 } } } })).toThrowError();
    expect(() => validateResponse(req, { model: "jev-unsupported", answers: { route: { type: "choice", choice: { support: 0.7, billing: 0.3 } } } })).toThrowError();
  });

  it("build the pinned object request with the Jev wire field names", () => {
    expect(demoRequest).toEqual({ model: "jev-1.14.0", state: "A synthetic tool request", questions: {
      safe: { type: "noul", instructions: "Should the tool call be allowed?" },
      route: { type: "choice", instructions: "Choose a route", criteria: { support: "Support queue", billing: "Billing queue" } },
      urgency: { type: "score", instructions: "Rate urgency", criteria: ["low", "medium", "high"] },
    } });
  });

  it("rejects invalid criteria", () => {
    expect(() => choice("Choose", { only: "one" })).toThrow(TypeError);
    expect(() => score("Rate", [])).toThrow(TypeError);
  });

  it("keeps only declared answer and probability fields at the fixture boundary", () => {
    const sanitized = validateResponse(request("synthetic", { allowed: noul("Allow? ") }), {
      authorization: "discard-me",
      allowed: {
        value: "yes",
        headers: { authorization: "discard-me" },
        probabilities: { yes: 0.8, no: 0.2 },
      },
    });
    expect(sanitized).toEqual({ allowed: { value: "yes", probabilities: { yes: 0.8, no: 0.2 } } });
  });
});

describe("canonical requests and mock", () => {
  it("hashes object keys independent of insertion order", () => {
    const a = request("state", { pick: choice("choose", { a: "A", b: "B" }) });
    const b = request("state", { pick: choice("choose", { b: "B", a: "A" }) });
    expect(hashRequest(a)).toBe(hashRequest(b));
    expect(hashRequest(a)).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hashRequest(request("changed", { pick: choice("choose", { a: "A", b: "B" }) }))).not.toBe(hashRequest(a));
  });

  it("returns deterministic, normalized probabilities covering declared options and levels", async () => {
    const client = createJevClient();
    const first = await client.evaluate(demoRequest);
    expect(client.mode).toBe("mock");
    expect(await client.evaluate(demoRequest)).toEqual(first);
    expect(first.safe?.probabilities).toEqual(expect.objectContaining({ yes: expect.any(Number), no: expect.any(Number) }));
    expect(Object.keys(first.route!.probabilities).sort()).toEqual(["billing", "support"]);
    expect(Object.keys(first.urgency!.probabilities)).toEqual(["low", "medium", "high"]);
    for (const answer of Object.values(first)) {
      const values = Object.values(answer.probabilities);
      expect(values.every((value) => Number.isFinite(value) && value > 0 && value <= 1)).toBe(true);
      expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    }
  });
});

describe("client modes", () => {
  it("uses replay fixtures by canonical request hash and fails loudly on a miss", async () => {
    const response = { safe: { value: "yes", probabilities: { yes: 0.8, no: 0.2 } }, route: { value: "support", probabilities: { support: 0.8, billing: 0.2 } }, urgency: { value: "low", probabilities: { low: 0.7, medium: 0.2, high: 0.1 } } };
    const fixture = { schemaVersion: 1 as const, requestHash: hashRequest(demoRequest), request: demoRequest, response };
    const replay = createJevClient({ mode: "replay", fixtures: [fixture] });
    expect(await replay.evaluate(demoRequest)).toEqual(response);
    await expect(createJevClient({ mode: "replay" }).evaluate(demoRequest)).rejects.toMatchObject({ code: "FIXTURE_NOT_FOUND" });
  });

  it("only infers live with an explicit key outside test/CI, and explicit live requires a key", () => {
    expect(createJevClient({ apiKey: "injected", runtime: { nodeEnv: "test" } }).mode).toBe("mock");
    expect(createJevClient({ apiKey: "injected", runtime: { ci: true } }).mode).toBe("mock");
    expect(createJevClient({ apiKey: "injected", runtime: { nodeEnv: "development" } }).mode).toBe("live");
    expect(() => createJevClient({ mode: "live" })).toThrow(JevError);
  });

  it("uses only the injected fetch and maps HTTP and malformed responses to typed errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      safe: { value: "yes", probabilities: { yes: 0.9, no: 0.1 } },
      route: { value: "support", probabilities: { support: 0.9, billing: 0.1 } },
      urgency: { value: "low", probabilities: { low: 0.8, medium: 0.1, high: 0.1 } },
    }), { status: 200 }));
    const live = createJevClient({ apiKey: "injected-test-value", fetch: fetcher, runtime: { nodeEnv: "development" } });
    await live.evaluate(demoRequest);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(demoRequest);
    expect(new Headers(init?.headers).has("authorization")).toBe(true);

    const httpFailure = createJevClient({ apiKey: "x", runtime: { nodeEnv: "development" }, fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 429 })) });
    await expect(httpFailure.evaluate(demoRequest)).rejects.toMatchObject({ code: "HTTP_ERROR" });
    const malformed = createJevClient({ apiKey: "x", runtime: { nodeEnv: "development" }, fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 })) });
    await expect(malformed.evaluate(demoRequest)).rejects.toMatchObject({ code: "PROTOCOL_ERROR" });
    const invalidJson = createJevClient({ apiKey: "x", runtime: { nodeEnv: "development" }, fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("not-json", { status: 200 })) });
    await expect(invalidJson.evaluate(demoRequest)).rejects.toMatchObject({ code: "INVALID_JSON" });
    const timedOut = createJevClient({
      apiKey: "x",
      runtime: { nodeEnv: "development" },
      timeoutMs: 1,
      fetch: vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      })),
    });
    await expect(timedOut.evaluate(demoRequest)).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
