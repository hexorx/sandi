# ADR 0001: Jev showcase architecture

- **Status:** Accepted
- **Date:** 2026-11-19
- **Decision owners:** Sandi maintainers

## Context

The first Sandi app is a six page demonstration of TypeSafe Jev decisions. It must be useful on a clean checkout with no network access or credentials. Live Jev and model calls are opt-in. The project is a public Turborepo/pnpm workspace, so fixtures, logs, screenshots and documentation must never contain credentials or private customer data.

The Jev endpoint is `POST https://api.typesafe.ai/v1/systemone`, pinned to `jev-1.14.0`. Its request is `{ model, state, questions }`; `state` is a string and `questions` maps names to `{ type, instructions, criteria? }`. Supported question types are `noul`, `choice` and `score`. Choice criteria map option names to descriptions; score criteria are ordered levels. The property is `instructions` (not `question`), and the endpoint expects an object, not an array.

## Decision

### Backend: TypeScript Strands Agents SDK

Use the maintained `@strands-agents/sdk` TypeScript SDK in a small Node server. The current Strands documentation lists the TypeScript SDK as supporting the agent invocation loop, custom tools and structured output. The SDK uses Zod schemas for tools and structured output, which fits this application's TypeScript contracts. The old standalone `strands-agents/sdk-typescript` repository was archived after the code moved to the `strands-agents/harness-sdk` monorepo; install and track the published package and the maintained monorepo/docs, rather than taking a dependency on the archived repository.

Do not use Strands for ordinary Jev decisions. `packages/jev` owns Jev transport and mock/replay behavior. Strands is used by use case 5 to demonstrate an agent loop, whose Jev-check tool calls `packages/jev` before a mock or explicitly enabled action. In mock mode the app uses a scripted Strands model adapter that emits deterministic tool-call/final-answer events; it never constructs a network model provider. The scripted adapter is an application test/demo seam, not a claim that Strands itself ships an offline model. No model call is made unless a server-side model key is present and live mode is explicitly selected.

This is preferred over a Python sidecar because the six use cases and their contracts are TypeScript, and a Python service would add a second runtime, deployment artifact and contract boundary without a feature need. Revisit if the maintained TypeScript SDK cannot be installed or the scripted model seam cannot exercise the required loop in a supported way.

### Workspace layout

- `apps/jev-showcase`: Vite React client and Node HTTP server in one deployable app. Keep browser and server entry points separate; only the server reads environment variables.
- `packages/jev`: typed Jev request/response contract, client, deterministic mock/replay implementation and sanitized fixtures.
- `packages/shared`: shared Zod schemas and inferred TypeScript types for API requests/responses and common demo data.
- No shared `packages/ui` initially. The app has one consumer; extract reusable UI only when a second app needs the same components.

The architecture doc defines the interfaces that Coder tickets should implement.

### Mock, replay and live mode

Mock is the default for development, tests, CI and e2e. `JEV_MODE` is `mock` unless the server environment explicitly selects `live`. Live mode fails closed unless `TYPESAFE_API_KEY` is set; the value is read only by the server and is never sent to the browser. The UI shows a persistent `MOCK` or `LIVE` badge based on server-provided mode metadata. For use case 5, `MODEL_API_KEY` is likewise server-only; no model key means use the scripted model. Tests hard-force mock mode and must fail if a live adapter is attempted.

Mock responses are stable for a request: canonicalize the validated request JSON (sorted object keys, compact UTF-8 encoding), SHA-256 it, and use that hash to find a fixture or derive a deterministic fallback. Fixture files are versioned JSON with a format version, `requestHash`, validated response payload and optional non-sensitive scenario label. They contain no API headers, keys, raw user data, or private data. Hashing is for deterministic fixture selection and integrity, not privacy; demos use synthetic inputs. Replay lookup misses fall back to deterministic typed defaults in mock mode, and can be surfaced in development diagnostics without logging request bodies.

### API boundary

The browser calls one endpoint per use case (`POST /api/use-cases/:id/run`) with a discriminated request schema and receives a discriminated response schema plus mode metadata. Use Zod schemas in `packages/shared` as the source of runtime validation and TypeScript types. Use a single route shape with a closed use-case id union to avoid six incompatible transport implementations. `POST /api/receipts` is not needed: use case 4 returns receipts in the run response, and persistence is in-memory for the demo.

Requests have a 10 second end-to-end deadline, propagated with `AbortSignal` to Jev/model transports. Return structured errors: `400 VALIDATION_ERROR`, `401 LIVE_MODE_NOT_CONFIGURED`, `429 UPSTREAM_RATE_LIMITED`, `504 UPSTREAM_TIMEOUT`, and `502 UPSTREAM_ERROR`, each with a safe message and request id. Never return provider response headers or credentials. Mock-mode code paths do not perform network I/O.

### Decision receipts

Use case 4 returns a receipt for each evaluated stage and each skipped stage. Receipt identity, UTC timestamp, canonical input hash, Jev model, question probabilities, threshold, action and reason are mandatory. A skipped stage records its reason and threshold/action context; probabilities may be empty if Jev was intentionally not called. See the architecture document for the TypeScript schema.

## Consequences

- One Node deployment serves browser assets and the API; only the server owns secrets.
- Most behavior can be demonstrated and verified offline, deterministically.
- The maintained Strands SDK can change; pin it and isolate it behind the use-case-5 adapter.
- Replay hashes do not anonymize inputs. Only synthetic, sanitized demo scenarios may be recorded.
- Live mode requires an explicit deployment configuration and has no effect on tests or CI.

## References

- [Strands SDK feature availability](https://strandsagents.com/docs/)
- [Strands TypeScript package and agent loop](https://github.com/strands-agents/harness-sdk)
- [Strands TypeScript structured output](https://strandsagents.com/docs/user-guide/sdk/agents/structured-output-behavior/)
