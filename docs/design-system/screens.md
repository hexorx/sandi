# Jev Showcase screens and states

Each screen uses the shared frame in [README.md](./README.md): heading, persistent mode badge, demo panel, outcome, and readable code. Use case IDs remain stable in routes and API calls: `tool-safety`, `ticket-triage`, `content-moderation`, `decision-receipts`, `strands-agent`, `threshold-playground`.

## Home — Decision demos

**Layout:** Intro at left (“Decisions you can inspect.” / “Six small demos show how Jev evaluates a situation before software acts.”), mode badge and “Explore demos” action. Below, a two-column grid of six linked cards; each card has number, title, one-sentence value, and outcome type. A short footer says “Mock mode uses deterministic synthetic examples. No API key required.”

**Sample cards:** Tool-call safety / allow or block; Support-ticket triage / team and urgency; Content moderation / allow or review; Decision receipts / every step accounted for; Agent checks / Jev before an action; Confidence playground / tune a threshold.

**States:** initial shows all six cards; loading skeleton only while mode metadata is fetched; error keeps navigation and offers “Retry status”; empty card grid should never occur (show an inline explanation and retry).

## 1. Tool-call safety gate — `tool-safety`

**Layout:** Left demo form shows a proposed tool call with editable sample `send_invoice({ invoiceId: "INV-2048", amount: 4800 })`, a short policy summary, and “Evaluate tool call”. Right result card shows decision chip, confidence bars, and reason. Code panel contains the Jev question and a clearly labeled guarded call.

**Synthetic result:** BLOCK · 94% policy violation · “The amount exceeds the review limit for an unverified recipient.” Secondary safe probability 6%.

**States:** initial preloads the synthetic call but no result; loading labels the button “Evaluating…”; success renders allow/block and probabilities; error retains input and offers retry; empty after clearing input says “Add a tool call to evaluate.”

## 2. Support-ticket triage — `ticket-triage`

**Layout:** Ticket summary form with subject, message, and customer tier; result shows route team, urgency chip, and confidence. Code panel shows a short routing rule and structured choice.

**Synthetic result:** “Cannot access my team workspace” → Identity Support · High priority · 88% confidence. Explanation: “Multiple teammates are blocked from signing in.”

**States:** initial loads a synthetic ticket; loading keeps ticket visible; success shows destination and confidence; error preserves ticket; empty prompts “Select a sample ticket or enter a subject and message.”

## 3. Content moderation — `content-moderation`

**Layout:** Sample post text and policy categories on the left, decision and per-category probabilities on the right. Provide “Evaluate content” and a text-count hint.

**Synthetic result:** “Join us Saturday for the neighborhood cleanup!” → ALLOW · 97% safe. Categories: harassment 2%, self-harm 1%, spam 3%.

**States:** initial has synthetic text; loading marks the result area; success shows allow/review/block with category scores; error retains text; empty prompt says “Add text to check against the selected policies.”

## 4. Decision receipts — `decision-receipts`

**Layout:** Pipeline timeline at top with four stages. A receipt list below expands each stage into a definition list. Code panel shows the pipeline and receipt shape.

**Synthetic result:** “Vendor payout” pipeline: identity CHECKED (ALLOW, 99%); amount CHECKED (REVIEW, 74% vs 80% threshold); sanctions SKIPPED (“Held for manual amount review”); payout BLOCKED (prior review required). Each stage includes reason; the skip has no fabricated probability.

**States:** initial explains that every stage is recorded; loading uses four stable timeline placeholders; success lists evaluated and skipped stages; error offers retry without clearing the scenario; empty says “Run a scenario to create its decision receipts.”

## 5. Strands agent consults Jev — `strands-agent`

**Layout:** A synthetic request and mock action are paired with an ordered event log: agent asks Jev, Jev returns a decision, the action is allowed or blocked, agent summarizes. Code panel isolates the Jev-check tool and scripted mock adapter.

**Synthetic result:** Request “Archive project cedar-17” → ALLOW · 91%; action “Archive queued (mock)” and summary “The request met the configured retention policy.” The action is explicitly labeled mock.

**States:** initial explains the scripted, offline agent loop; loading reveals events as they complete and announces progress; success shows final answer and action; error identifies the safe step that failed and offers retry; empty prompts “Enter a request to start the agent.”

## 6. Confidence and threshold playground — `threshold-playground`

**Layout:** Probability bars beside a native threshold slider. A result panel updates immediately as the threshold moves. Code panel shows comparison logic; “Reset sample” restores 80%.

**Synthetic result:** “Suspicious tool call” · risk confidence 74% · threshold 80% → BLOCK. At 70% it changes to ALLOW. The comparison rule is visible: block when risk confidence is at or above threshold.

**States:** initial shows confidence 74%, threshold 80%; slider movement updates value and chip without network access; loading is not used for local recalculation; error appears only if sample data cannot load and offers reset; empty explains “Choose a sample to compare confidence with a threshold.”

## Shared copy and selectors

- Primary action: “Run decision”; pending: “Running…”; retry: “Try again”; result heading: “Decision”.
- Use `data-testid="mode-badge"`, `demo-input`, `run-decision`, `decision-result`, `probability-{name}`, `receipt-{stage}`, and `threshold-slider` when a stable selector is required.
- Every result explains why in one sentence and shows its mode. All scenarios use invented names and IDs.
