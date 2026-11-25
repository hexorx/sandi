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

## Strands + LiteLLM guardrails example (local)

The showcase includes `/strands-guardrails`. To run the Python Strands sidecar and LiteLLM proxy with the existing Jev app, configure a local Ollama endpoint and a private proxy key in the ignored `.env` file, then start the stack:

```sh
cp .env.example .env
# Set LITELLM_MASTER_KEY to a locally generated value and OLLAMA_BASE_URL to your local Ollama server.
docker compose --env-file .env -f compose.guardrails.yaml up --build
```

The compose stack binds the existing showcase port to `127.0.0.1` by default; set `SHOWCASE_BIND_ADDRESS` to a LAN or tailnet interface address when running it on drone. The Python service and LiteLLM proxy stay on the private compose network. LiteLLM loads one global callback from `litellm.config.yaml`; its local email, phone, and unsafe-request policy applies to all chat completion calls through the proxy. It blocks matching input before calling the model and buffers streamed output until screening finishes.

For streamed chat completions, the final OpenAI-compatible chunk carries a `guardrail_verdict` extension: `{guardrail_name, decision, details, guardrails}`. The same JSON verdict is also carried in a `\x1eSANDI_GUARDRAIL:` content marker so agent SDKs that discard unknown chunk fields can forward it. Clients should remove and parse that marker rather than show it as model text. Allowed responses include their text followed by an `allow` verdict. A blocked output includes only the `block` verdict chunk, so no blocked text is released. Input blocks return HTTP 400 with the same verdict fields in the error `detail`, because no model stream is started. For example, point an OpenAI-compatible client at `http://localhost:4000/v1` using the local `LITELLM_MASTER_KEY`, request `stream: true`, and inspect `chunk.guardrail_verdict` while iterating the stream.

The Sandi SSE endpoint retains `token`, `guardrail`, and `done` event names for its UI. The checkbox runs a deterministic offline mock without calling the model; live calls use the LiteLLM proxy policy. Model output is held until screened.

The LiteLLM service mounts its config and the two guardrail Python modules as individual files under `/app`, preserving the image's `/app/docker/prod_entrypoint.sh`.

SSE event names are `token`, `guardrail`, and `done`. `guardrail` carries `{stage, decision, guardrails:[{name, decision, details}]}`. Model output is withheld until screened.

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

To enable live mode locally: set `JEV_MODE=live` and provide `TYPESAFE_API_KEY` privately in your shell or a git-ignored `.env` (never commit the value; `.env.example` lists names only). Then start the showcase:

```sh
export JEV_MODE=live
# Set TYPESAFE_API_KEY in this shell or load it from a local .env — do not paste the value into docs or commits.
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
