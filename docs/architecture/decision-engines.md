# Decision-engine contract

`@sandi/decider` is the provider-neutral boundary for all decision use cases. Its types live in `packages/decider/src/types.ts`; providers normalize into `DecisionResult`, and the existing per-use-case schemas remain responsible for validating the answer shape.

## Provider contract

An adapter implements:

```ts
interface DecisionEngine {
  readonly id: "jev" | "decider" | "mock";
  decide(input: DecisionInput, options?: { signal?: AbortSignal }): Promise<DecisionResult>;
}
```

`DecisionInput` carries a stable `useCase` id and its already validated payload. `DecisionResult.answer` is the normalized use-case answer; `confidence` maps named outcomes to values in `[0, 1]`; `explanation` is optional safe display text. Provider response validation occurs inside the provider adapter before normalization. The route validates the normalized answer again with the use-case schema before returning it.

## Page selection and compare

Each page presents a selection for Jev or Decider. The server executes that choice through the registry. In compare mode, the server invokes both providers concurrently with the same input and cancellation signal. It returns one `EngineRunResult` for each side, including normalized answer, confidence, requested and actual engine ids, and latency measured server-side. A provider failure is contained to its engine result; the other result remains visible. An unavailable provider uses the mock engine for that side and is marked as fallback in safe response metadata.

The page renders answers side by side, displays confidence values using consistent labels, and reports latency in milliseconds. It must label fallback/mock results so they cannot be mistaken for live provider output. Compare mode does not persist or log submitted payloads.

## Runtime configuration and offline behavior

Only the Node server reads environment variables. Jev is live only with explicit Jev live-mode configuration and `TYPESAFE_API_KEY`. Decider is live only with explicit decider live-mode configuration and both `OLLAMA_BASE_URL` and `OLLAMA_MODEL`. The URL and model have no repository defaults; deployment binds them at runtime. The client receives only safe engine availability metadata and never receives keys or provider URLs.

Unset configuration, provider reachability failure, tests, CI, and e2e use deterministic local mock/scripted adapters. A mock adapter cannot call `fetch`, create a model client, or read credentials. Tests force mock mode even if a developer shell contains live configuration. Live provider errors are reduced to safe error codes/messages before reaching the browser.

## Use-case integration rule

Use-case pages and handlers depend on `DecisionEngine` and normalized result types only. They may define their own validated input and answer schemas, but they must not branch on Jev/Ollama wire fields. Provider-specific mapping, retries, timeouts, and error sanitization stay in server adapters. Compare is a shared dispatcher operation and must not be reimplemented per page.
