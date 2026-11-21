# How mock and replay work

Sandi’s Jev client lives in [`packages/jev`](../packages/jev). Every evaluate path returns the same wire shape: named answers with `{ value, probabilities }`. Mode is chosen on the **server**; the browser only sees a `mock` / `live` badge.

## Modes

| Mode | When | Network |
| --- | --- | --- |
| **mock** (default) | No key, or not explicitly live | None. Deterministic SHA-256 weights per answer key, normalized to probabilities. |
| **replay** | `createJevClient({ mode: "replay", fixtures })` | None. Looks up a fixture by SHA-256 of the canonical request JSON; throws `FixtureNotFoundError` on a miss. |
| **live** | Explicit `{ mode: "live", apiKey }` (or env: `JEV_MODE=live` + `TYPESAFE_API_KEY` outside test/CI) | `POST https://api.typesafe.ai/v1/systemone` with pinned model `jev-1.14.0`. |

`createJevClient()` with no options is mock. Tests and CI must leave `TYPESAFE_API_KEY` unset and must not select live mode.

## Request shape

Questions use `instructions` (not `question`). Types:

- **`noul`** — yes/no with probabilities
- **`choice`** — named options (`criteria` is an object of option → description)
- **`score`** — ordered levels (`criteria` is an array)

Helpers: `noul`, `choice`, `score`, `request` from `@sandi/jev`.

## Mock determinism

The mock hashes the canonical request, question name, and each answer key, derives one positive weight per key, and normalizes. Same request → same probabilities every time. That is enough for demos, unit tests, and e2e without fixtures.

## Replay fixtures

Replay stores scrubbed `{ requestHash, response }` pairs only. Fixtures must contain **no** API keys, headers, or private user data. The package recorder (`pnpm --filter @sandi/jev record-fixture -- synthetic-tool-gate`) accepts a fixed synthetic scenario only.

## Showcase wiring

`apps/jev-showcase` builds a client from the environment (`getRuntimeMode` / `createJevClientFromEnvironment`). Live is enabled only when all of these hold:

1. `JEV_MODE=live`
2. `TYPESAFE_API_KEY` is set
3. `NODE_ENV` is not `test` and `CI` is not `true`

Otherwise the app stays in mock. Playwright additionally aborts any `api.typesafe.ai` request and asserts none occurred.

## Switching to live safely

1. Keep values out of git: copy `.env.example` → `.env` (git-ignored).
2. Set variable **names** only in docs and examples; put real values only in the local shell or `.env`.
3. Start the server with live env; confirm the header badge shows **LIVE**.
4. Never screenshot or paste key material. Prefer mock for shared demos.
