# Demo script · Jev Showcase (~10 minutes)

Audience: engineer or product viewer who has never seen Sandi. Stay in **mock mode** unless you explicitly need live.

## Before you start (2 min)

1. From repo root, with no key in the environment:

   ```sh
   corepack pnpm install --frozen-lockfile
   env -u TYPESAFE_API_KEY corepack pnpm --filter @sandi/jev-showcase dev
   ```

2. Open the app URL. Confirm the header badge says **MOCK**.
3. Optional talking point: [docs/mock-replay.md](mock-replay.md) — mock is deterministic and offline; live is opt-in via `JEV_MODE` + `TYPESAFE_API_KEY` (names only in public talk tracks).

## Walkthrough order

### 1. Home + triage (2 min) — `/` → Support ticket triage

- Click **Support ticket triage** (or scroll to `#support-triage`).
- Keep the sample ticket or paste a short synthetic one.
- Click **Triage ticket**. Point at category / urgency / queue and confidence chips.
- Talking points: three Jev questions (`choice` + `score` + `choice`); **65%** floor sends work to human-review.
- Show the adjacent source panel (`triage.ts`).

### 2. Tool-call safety (1.5 min) — `/tool-safety`

- Pick a **safe** sample (e.g. read account status), then a **dangerous** one (`rm -rf /`).
- Compare allow vs block vs review.
- Talking points: `noul` + `choice`; **0.7** review threshold; gate before tools run.

### 3. Content moderation (1.5 min) — `/content-moderation`

- Submit a mild synthetic post against the default policy, then a clearly violating one if useful.
- Show approve / flag / remove and policy scores.
- Talking point: outcome confidence below **65%** forces flag/review.

### 4. Decision receipts (1.5 min) — `/decision-pipeline`

- Run a clean item, then one containing `ambiguous` or `unsafe`.
- Expand receipts: safety → quality → routing; call out **skipped** stages with reasons.
- Talking point: every gate (including skips) is auditable.

### 5. Jev consulting agent (1.5 min) — `/jev-agent`

- Enter a benign task/action, run, show the step timeline (`task` → `plan` → `jev-check` → simulated action or refuse).
- Talking points: Strands tool `jev_gated_action`; default **0.8** yes-confidence; scripted agent offline (Ollama only if local env is set).

### 6. Confidence playground (1 min) — `/#confidence-playground`

- Switch scenarios; move allow/block sliders; show escalate band and sample outcome summary.
- Talking point: thresholds are product policy — evidence can stay fixed while cutoffs change.

### 7. PII/PHI guardrails (1 min) — `/pii-phi-guardrails`

- Use the synthetic sample with labeled patterns (or a short invented string). Toggle **strict** vs **redact-medium**.
- Talking points: local detector (not Jev); never demo with real PHI; redact vs block as policy.

## Closing

- Point viewers at [docs/demos/](demos/) for writeups and [README.md](../README.md) for offline setup.
- Remind: tests and e2e run with `TYPESAFE_API_KEY` unset (`corepack pnpm test`, `corepack pnpm e2e`).

## Switching to live mode safely (if asked)

1. Do **not** paste keys into chat, slides, or the repo.
2. Locally: set `JEV_MODE=live` and `TYPESAFE_API_KEY` in the shell or `.env` (git-ignored).
3. Restart the server; confirm **LIVE** badge.
4. Prefer a short private verify, then return to mock for the group demo.
