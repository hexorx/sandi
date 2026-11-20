# ADR 0002: Shared decision-engine interface

- **Status:** Accepted for implementation
- **Date:** 2026-11-20
- **Decision owners:** Sandi maintainers
- **Implementation dependency:** HEX-684 Jev response validation and HEX-682 DeciderEngine provider

## Context

Use-case pages need to select TypeSafe Jev or the local Ollama/Strands decider and compare their outputs without depending on provider transport details. HEX-684 validates Jev's response boundary; HEX-682 supplies the Ollama/Strands provider. This contract is intentionally designed before either provider is wired into the pages.

The application must remain useful offline. No browser code may hold provider credentials or call providers directly, and tests/CI must not make live calls.

## Decision

Create a provider-neutral `@sandi/decider` package for the application contract. Keep HTTP and provider-specific request/response types inside `@sandi/jev` and the server-side DeciderEngine adapter. The shared package exports `DecisionEngine`, normalized decision/result types, engine selection/availability, and single/compare execution result types. It has no provider SDK or runtime dependency.

`JevEngine` adapts the validated `@sandi/jev` client. `DeciderEngine` adapts the Ollama/Strands implementation from HEX-682. Both implement `DecisionEngine`; use-case handlers pass the same validated `DecisionInput` and then validate the normalized `DecisionResult` against that use case's result schema. UI components consume only the normalized response, never a provider wire shape.

Each page owns an engine selection of `jev` or `decider`. Compare mode invokes both engines concurrently against the same immutable input and returns an `EngineRun` per provider with normalized answer, confidence, and server-measured latency. Each run is independently represented; a provider failure is reported for that side and does not discard the successful result. The request deadline and abort signal apply to both calls.

Availability is derived on the server from runtime environment configuration. Jev requires its explicit live mode and `TYPESAFE_API_KEY`; Decider requires explicit live mode plus `OLLAMA_BASE_URL` and `OLLAMA_MODEL`. No endpoint, model, or key is embedded in the package or browser bundle. The server exposes only safe availability and reason text. If a provider is unconfigured, unreachable, or fails, dispatch falls back to the deterministic mock/scripted engine and identifies the actual engine/mode in response metadata. Compare mode returns mock output for an unavailable side while preserving a successful live result for the other side.

Mock/scripted adapters are the default in local development, tests, CI, and e2e. `NODE_ENV=test` and CI force offline adapters, regardless of environment variables. Mock adapters never call `fetch` or construct Strands/Ollama clients. Live selection is explicit and server-side only.

## Package and app layout

```text
packages/decider/                 provider-neutral types and execution result contract
packages/jev/                     Jev wire validation, transport, mock/replay
apps/jev-showcase/src/server/     environment, registry, JevEngine, DeciderEngine, dispatcher
apps/jev-showcase/src/client/     per-page selection and compare controls/results
```

The exported TypeScript contract is in `packages/decider/src/types.ts`. Provider adapters belong in the app server initially; extract an adapter package only if a second app needs it.

## Consequences

- Use-case implementation tickets can target one stable interface without provider-specific branches.
- `@sandi/decider` remains dependency-free and does not own HTTP or configuration.
- Confidence values are normalized named probabilities; providers that cannot produce calibrated confidence must document the semantics and should not fabricate certainty.
- Compare mode makes two calls and may take longer or consume more local resources; one shared deadline and cancellation signal bound the operation.
- Offline fallbacks can make a provider outage look like a successful demo, so response metadata must report the actual engine and fallback status clearly.

## References

- [ADR 0001: Jev showcase architecture](0001-jev-showcase-architecture.md)
- [Jev showcase architecture contract](../architecture/jev-showcase.md)
- HEX-682: Ollama/Strands DeciderEngine provider
- HEX-684: Jev response-shape validation
