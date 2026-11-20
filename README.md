# Sandi

Sandi is a Turborepo + pnpm monorepo for trying out AI use cases offline-first. The first app is **`apps/jev-showcase`**: a Vite + React + TypeScript + Tailwind client served by a small Node HTTP API that demos TypeSafe **Jev** decision patterns.

Mock/replay mode is the default. You can run the app, unit tests, CI, and Playwright e2e with **no API keys** and no network calls to Jev.

## Quick start (mock mode, offline)

```sh
corepack enable
corepack pnpm install --frozen-lockfile
# Leave TYPESAFE_API_KEY unset (or empty). JEV_MODE defaults to mock.
corepack pnpm --filter @sandi/jev-showcase dev
```

Open the URL Vite prints (typically `http://localhost:5173`). The header badge should read **MOCK**.

Production-style build + start (also mock by default):

```sh
corepack pnpm exec turbo run build --filter=@sandi/jev-showcase...
env -u TYPESAFE_API_KEY JEV_MODE=mock PORT=3000 corepack pnpm --filter @sandi/jev-showcase start
```

Health check: `GET /healthz`.

Docker (from repo root):

```sh
docker build -f apps/jev-showcase/Dockerfile -t jev-showcase .
docker run --rm -p 3000:3000 jev-showcase
```

## Live mode (optional)

Live Jev calls are **opt-in** and server-only. Never put a key in client code, fixtures, screenshots, or commits.

Environment variable **names** (see `.env.example`; values stay in a local `.env` that is git-ignored):

| Variable | Purpose |
| --- | --- |
| `TYPESAFE_API_KEY` | Server-side Jev API key. Required for live mode. |
| `JEV_MODE` | Set to `live` together with a key to enable live Jev. Anything else (or unset) stays mock. |
| `OLLAMA_BASE_URL` | Optional. When set with a model name, the Jev consulting agent can use a local Ollama model instead of the scripted agent. |
| `OLLAMA_MODEL` | Optional. Model id for the Ollama-backed agent path. |

Example (local shell only — do not commit values):

```sh
export JEV_MODE=live
export TYPESAFE_API_KEY=…   # from your TypeSafe account; never commit
corepack pnpm --filter @sandi/jev-showcase start
```

The UI shows a **LIVE** badge only when `JEV_MODE=live` and `TYPESAFE_API_KEY` are both present at runtime and the process is not in `test`/`CI`. The key is never sent to the browser.

## Tests and checks

From the repository root, with `TYPESAFE_API_KEY` unset:

```sh
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm e2e    # Playwright against mock mode (builds + starts on :4173)
```

Playwright aborts any request to `https://api.typesafe.ai/**` and expects zero such calls.

## Repo layout

```text
apps/
  jev-showcase/     React + Vite UI and Node API demos
  example/          Minimal example app
packages/
  jev/              Typed Jev client (mock / replay / live)
  decider/          Shared decision-engine interface
  shared/           Shared utilities / schemas
docs/
  demos/            Per-use-case writeups + screenshots
  demo-script.md    10-minute walkthrough for demos
  mock-replay.md    How mock and replay work
  architecture/     Deeper design notes
  adr/              Architecture decision records
e2e/                Playwright mock-mode suite
```

## Showcase use cases

| # | Demo | Path |
| --- | --- | --- |
| 01 | Tool-call safety gate | `/tool-safety` |
| 02 | Support ticket triage | `/#support-triage` |
| 03 | Content moderation | `/content-moderation` |
| 04 | Decision receipts pipeline | `/decision-pipeline` |
| 05 | Jev consulting agent (Strands) | `/jev-agent` |
| 06 | Confidence & threshold playground | `/#confidence-playground` |
| 07 | PII/PHI guardrails | `/pii-phi-guardrails` |

Writeups: [`docs/demos/`](docs/demos/). Walkthrough: [`docs/demo-script.md`](docs/demo-script.md). Mock/replay: [`docs/mock-replay.md`](docs/mock-replay.md).

## Standards

See [`AGENTS.md`](AGENTS.md) and [`CODING_STANDARDS.md`](CODING_STANDARDS.md). This repository is public: never commit secrets, private data, or live credentials.
