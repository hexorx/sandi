# Jev showcase architecture

This document describes the implementation contract for `apps/jev-showcase`, the first Sandi app. The app is a Vite, React, TypeScript and Tailwind client served by a small Node TypeScript API. Its normal mode is offline mock/replay; no credential is needed to run the app, tests, CI or Playwright suite.

## Workspace boundaries

```text
apps/jev-showcase/
  src/client/       React routes, pages, components
  src/server/       HTTP routes, adapters, environment parsing
  src/agent/        Use case 5 Strands agent and scripted model
packages/shared/    Zod API schemas and inferred types
packages/jev/       Jev wire types, HTTP client, mock/replay client
```

The single app deployment serves the built Vite assets and `/api/*`. Browser code imports shared schemas/types but never imports server adapters or reads secrets. `packages/shared` is limited to transport/domain types; `packages/jev` owns Jev-specific request and response validation. Do not create a general UI package until another app has a real consumer.

## Jev client contract

The Jev client translates application decisions to the upstream object request. The model is pinned by default to `jev-1.14.0`.

```ts
export type JevQuestionType = "noul" | "choice" | "score";
export type JevCriteria = Record<string, string> | readonly string[];

export interface JevQuestion {
  type: JevQuestionType;
  instructions: string;
  criteria?: JevCriteria;
}

export interface JevRequest {
  model: "jev-1.14.0";
  state: string;
  questions: Record<string, JevQuestion>;
}

export interface JevAnswer {
  value: string | number | boolean;
  probabilities: Record<string, number>;
}

export type JevResponse = Record<string, JevAnswer>;

export interface JevClient {
  readonly mode: "mock" | "live";
  evaluate(request: JevRequest, options?: { signal?: AbortSignal }): Promise<JevResponse>;
}
```

Validate upstream output before returning it to application code. `noul` answers expose yes/no probability; `choice` answers use the named option probabilities; `score` answers use the ordered level probabilities. Confirm the precise response envelope against the Jev API during the implementation ticket and normalize it at this adapter boundary. The request is always an object of `{ model, state, questions }`; each question uses `instructions`. Do not send the map as an array.

`HttpJevClient` posts JSON to `https://api.typesafe.ai/v1/systemone` with the server-only `TYPESAFE_API_KEY`. `MockJevClient` canonicalizes a request, hashes it with SHA-256, and returns a matching fixture or deterministic synthetic response. `ReplayJevClient` uses the same hash and fixture format; a miss uses the same mock fallback so offline demos remain usable.

Fixture format:

```json
{
  "version": 1,
  "requestHash": "sha256:<hex>",
  "scenario": "synthetic-tool-allowed",
  "response": {
    "safe": {
      "value": "allow",
      "probabilities": { "allow": 0.97, "block": 0.03 }
    }
  }
}
```

Fixtures must be synthetic and sanitized. Never store request bodies, authorization headers, API keys or private data. Stable hashing is not anonymization. Canonicalization sorts object keys recursively and uses compact JSON before hashing.

## Shared API contract

The schemas below are the target shape. Implement them as Zod schemas in `packages/shared`, then export inferred types. Each request and response includes a closed use-case discriminator. The server returns mode metadata with every successful response so the badge cannot be guessed by the browser.

```ts
export const UseCaseIdSchema = z.enum([
  "tool-safety", "ticket-triage", "content-moderation",
  "decision-pipeline", "jev-agent", "threshold-playground",
]);
export type UseCaseId = z.infer<typeof UseCaseIdSchema>;

export const RunRequestSchema = z.discriminatedUnion("useCase", [
  z.object({ useCase: z.literal("tool-safety"), toolName: z.string().min(1), arguments: z.record(z.unknown()) }),
  z.object({ useCase: z.literal("ticket-triage"), subject: z.string(), body: z.string(), priorityHint: z.string().optional() }),
  z.object({ useCase: z.literal("content-moderation"), content: z.string(), policy: z.string() }),
  z.object({ useCase: z.literal("decision-pipeline"), input: z.string(), threshold: z.number().min(0).max(1) }),
  z.object({ useCase: z.literal("jev-agent"), task: z.string(), proposedAction: z.string() }),
  z.object({ useCase: z.literal("threshold-playground"), scenario: z.string(), threshold: z.number().min(0).max(1) }),
]);
export type RunRequest = z.infer<typeof RunRequestSchema>;

export interface RunEnvelope<T> {
  requestId: string;
  mode: "mock" | "live";
  result: T;
}

export interface ApiError {
  requestId: string;
  error: { code: string; message: string };
}
```

Response result types are specific per `useCase`, and are returned with the same discriminator. Every decision result includes its Jev model and probability map; the pipeline returns `receipts`. Generate the six result schemas alongside request schemas so malformed adapter output is rejected before the response is sent.

### Route, timeout and errors

`POST /api/use-cases/:useCase/run` handles one use case. The path discriminator and body discriminator must agree. Parse input before dispatch and validate output before responding. Return `400 VALIDATION_ERROR` for malformed input; `401 LIVE_MODE_NOT_CONFIGURED` if live mode is selected without the Jev key; `429 UPSTREAM_RATE_LIMITED`; `504 UPSTREAM_TIMEOUT`; and `502 UPSTREAM_ERROR`. The stable error body is `{ requestId, error: { code, message } }`. Messages must not expose keys, headers, raw provider errors or user content.

The server imposes a 10 second deadline for a complete run and passes an `AbortSignal` to upstream calls and Strands invocation. Return 504 on deadline expiry. Mock adapters are local and deterministic. The UI presents validation/errors next to the code and retains no submitted user content after navigation.

### Mode configuration and visibility

Server mode defaults to `mock`. Live Jev mode requires `JEV_MODE=live` and `TYPESAFE_API_KEY`; any absent key makes startup/configuration fail closed to mock (with a safe diagnostic). For use case 5, a model provider is enabled only by explicit live-agent configuration and a server-only `MODEL_API_KEY`; otherwise a scripted deterministic model supplies tool-call and final-answer events. `NODE_ENV=test` and CI force mock regardless of machine environment. No client bundle may receive either key.

Every page displays a persistent `MOCK` or `LIVE` badge sourced from the `RunEnvelope.mode` (initial page mode is available from a safe `/api/mode` response). Mock and live styles must be visually distinct. Live mode requires an explicit UI confirmation before a run, because it sends demo input to external services.

## Six use cases

Each page has a form/demo panel, result/probability view, mode badge and a neighboring readable code panel. The code panel shows the concise TypeScript request and the core decision/action logic, not generated bundles or secrets. Use shared synthetic examples and a “reset example” control.

| Page | Demonstration | Input and result |
| --- | --- | --- |
| Tool-call safety gate | Gate a proposed tool invocation using a `noul` question, then show allow/block and probabilities. Never execute the proposed tool. | Tool name and synthetic arguments; decision, allow/block probabilities, explanation. |
| Support-ticket triage | Classify a ticket and show a routing queue and urgency. | Synthetic subject/body and optional hint; queue choice, priority/score and probabilities. |
| Content moderation | Evaluate text against a displayed policy and show a moderation outcome. | Synthetic text and policy; allow/review/block decision, probabilities and reason. |
| Decision pipeline | Run ordered gates, showing an immutable receipt for every evaluated or skipped stage. | Synthetic input and threshold; final action and ordered receipts. |
| Jev consulting agent | A Strands agent calls the Jev tool before proposing an action; show tool call, Jev result and final agent response. | Task and proposed action; tool trace, decision probabilities and response. Any action is simulated. |
| Confidence and threshold playground | Re-evaluate a fixed synthetic scenario at adjustable thresholds and visualize the selected action. | Scenario and threshold slider; stable Jev probability distribution, threshold, action. |

## Decision receipt schema

Use case 4 must create a receipt for every pipeline stage, including stages not run because an earlier stage short-circuited. Preserve pipeline order. A skipped stage has `action: "skipped"`, an explicit `reason`, and an empty probability map if Jev was not called.

```ts
export const DecisionReceiptSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime({ offset: true }),
  stage: z.string().min(1),
  inputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  jev: z.object({
    model: z.literal("jev-1.14.0"),
    probabilities: z.record(z.number().min(0).max(1)),
  }).optional(),
  threshold: z.number().min(0).max(1),
  action: z.string().min(1), // "allow", "block", a route, or "skipped"
  reason: z.string().min(1),
});
export type DecisionReceipt = z.infer<typeof DecisionReceiptSchema>;

export interface DecisionPipelineResult {
  useCase: "decision-pipeline";
  finalAction: string;
  receipts: DecisionReceipt[];
}
```

Generate receipt IDs and timestamps at the server boundary. Hash canonical synthetic input for the stage. Do not include raw input in a receipt or log. Probabilities describe the Jev response used at that stage. The optional `jev` block is omitted only for an intentional skip.

## Tests and CI

- **Vitest:** unit tests for canonical JSON/hash, schemas, Jev request mapping, fixture selection, deterministic fallback, threshold logic, receipts, timeout/error mapping, and the scripted model adapter. Assert mock adapters never call `fetch`.
- **Testing Library:** page forms, errors, probability/result display, readable code panel and persistent MOCK/LIVE badge.
- **Playwright:** run all six pages in forced mock mode with no network and no key. Assert stable outputs, correct badges and that use case 5 displays the Jev tool step before its simulated action. Block external network in e2e.
- **GitHub Actions:** install with frozen pnpm lockfile; run lint, typecheck, Vitest, Playwright mock suite, then production build. No secrets are configured in CI. Cache pnpm by lockfile and upload Playwright report on failure only if it contains no user data.

## Container and compose target

The deploy ticket should implement a multi-stage Docker build: pinned Node/pnpm builder installs the workspace and builds `apps/jev-showcase`; a slim Node runtime contains the app output and serves the static client plus API on one internal port. Compose defines one `jev-showcase` service, a health check, restart policy and an internal-only port binding on the LAN host. Pass `JEV_MODE` and keys through the deployment secret/environment mechanism, never through image build args or committed compose defaults. The default compose configuration uses mock mode and has no dependency on external services. No public DNS, tunnel or internet exposure is part of this architecture.

## Open questions

1. **Exact Jev response envelope:** confirm the wire envelope from a sanitized captured response or official API schema while implementing `packages/jev`. Recommended answer: normalize it inside the adapter to the `JevResponse` map above and keep the rest of the app independent of wire details.
2. **Live-mode UI confirmation copy:** choose final wording when the UI is implemented. Recommended answer: explicitly say the synthetic input will be sent to TypeSafe Jev and/or the configured model provider; require confirmation per run.
3. **Fixture coverage:** choose examples as the six demos are implemented. Recommended answer: keep a small set of synthetic fixtures for meaningful named outcomes and rely on deterministic typed fallbacks for all other hashes.
