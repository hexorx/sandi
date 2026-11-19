# Jev showcase screen specifications

Shared shell, theme and accessibility requirements are in [design-system.md](./design-system.md); component behavior and test IDs are in [components.md](./components.md). All sample content below is synthetic. The persistent mode badge comes from server mode metadata. Code examples show request shape and decision logic only, never keys or network implementation details.

## Home

**Purpose/copy:** “See how decisions become safer and easier to explain.” Supporting text: “Six small, replayable examples. Every action is simulated.” Hero contains a `MOCK` badge and primary “Explore demos” link. Below, a two-column card grid lists all six use cases with a one-line outcome and “Open demo”; a bottom strip explains mock/live mode.

**Example data:** six cards labeled Tool-call safety, Support triage, Content moderation, Decision receipts, Jev agent, Confidence playground. Default mode `MOCK`.

**States:** initial shell and cards render without API access; mode-loading badge says “Checking mode”; mode failure fails closed and displays `MOCK` with a non-blocking “Mode information unavailable” note; empty registry shows “No demos available yet”; navigation failure stays on home and offers retry. Code panel is omitted on home.

## Tool-call safety gate

**Copy:** “Check a tool call before it can happen.” Form has tool name (`send_email`), JSON argument editor (`{"to":"alex@example.test","subject":"Build complete"}`), reset and “Evaluate safety”. Explicit note: “The proposed tool is never executed.” Result card shows “ALLOW” or “BLOCK”, short reason, allow/block probabilities, and a small probability bar. Code panel beside it shows a `noul` question and a conditional allow/block branch.

**States:** example is prefilled; loading says “Checking the proposed call…”; success renders outcome and probabilities; empty says “Run the example to see the safety decision”; validation error marks invalid JSON and keeps input; API error says “Decision unavailable. Try again.” Reset restores the synthetic call.

## Support-ticket triage and routing

**Copy:** “Give each ticket a clear next stop.” Form fields subject (“Can't access my workspace”), body (“Login succeeds, then the dashboard returns an error. Started after today's update.”), optional priority hint (“Customer blocked”), and “Triage ticket”. Result shows queue `technical_support`, urgency `high`, confidence values and a plain-language reason. Code panel demonstrates a `choice` queue and score/priority evaluation.

**States:** prefilled synthetic ticket; loading “Finding the best queue…”; success shows route/urgency and probabilities; empty invites running; validation error identifies missing subject/body; API error is recoverable with retry; reset restores the sample.

## Content moderation

**Copy:** “Apply a policy consistently, with a reason.” Display policy “Block targeted harassment and direct threats. Allow ordinary criticism.” Example text: “I disagree with this release; please fix the export bug.” Button “Review content”. Result chip `ALLOW`, probability distribution for allow/review/block, and reason “Criticism of a product; no targeted abuse or threat.” Code panel shows a `choice` question with options and criteria.

**States:** prefilled neutral example; loading “Reviewing against the displayed policy…”; success shows decision, probabilities and reason; empty says no review yet; validation requires text and policy; API error with retry; reset restores neutral sample. Use a neutral placeholder string if example data changes—never use real user content.

## Decision pipeline and receipts

**Copy:** “See every gate, including the ones skipped.” Input “New workspace member requests export”, threshold `0.80`, and “Run pipeline”. Result shows final action and ordered receipt timeline. Sample: `identity` allow at 0.98; `permission` block at 0.94; `data-scope` skipped because permission stopped the pipeline. Every receipt exposes timestamp, short input hash, stage, action, threshold, probability when evaluated, and reason. Code panel shows ordered gates and skip handling.

**States:** empty timeline before run; loading “Evaluating pipeline stages…”; success contains all evaluated/skipped stages; empty receipts gets “No stages recorded”; invalid threshold/input is identified inline; API error offers retry and preserves inputs; reset restores the synthetic request and threshold. A skipped stage says why Jev was not called and has no probability block.

## Jev consulting agent

**Copy:** “Let an agent ask before it acts.” Task: “Prepare a customer workspace export.” Proposed action: “Create an export link for the current workspace.” Prominent note: “The action is simulated; no link is created.” Result trace shows `Agent request → Jev safety check → simulated decision → agent response`; include allow/block probability and response. Code panel shows the Jev-check tool and that the simulated action occurs only after allow.

**States:** idle shows sample task; loading shows “Agent is checking its proposed action…” and the trace step order; success includes Jev tool result before the final response; empty says run to see the tool trace; validation requires task/action; API error retains form with retry; reset restores example. Agent mode without a live model uses deterministic scripted output and never constructs a model provider.

## Confidence and threshold playground

**Copy:** “Move the threshold. Keep the evidence fixed.” Fixed synthetic case: “A request asks to email a workspace export to an address outside the organization.” Show stable probabilities: block `0.91`, allow `0.09`. Slider 0–1 by 0.01, default 0.80, with explicit numeric value. Result shows selected action, threshold comparison and probability bars; sample threshold 0.80 selects block. Code panel displays unchanged confidence and threshold rule.

**States:** stable initial distribution and default threshold; slider interaction updates the decision locally without another Jev call; empty fallback uses “Run scenario” if result is not loaded; invalid value is clamped/rejected by schema and surfaced; API error offers retry. Reset returns to 0.80. Expose slider value via label and text; do not announce every drag tick.

## Responsive composition

On desktop each demo's form/result column is left and code panel is right. On narrow screens the code panel follows the result; the result should not be pushed below a long code block. Receipt timeline scrolls vertically, never horizontally. Long JSON and hashes wrap or scroll inside their own region without making the whole page overflow.
