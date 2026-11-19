# Jev showcase component specifications

Components stay app-local under `apps/jev-showcase/src/client`. Prefer semantic HTML and small props; presentational components receive already validated data and do not call API or read environment variables.

| Component | Contract and behavior | Example test IDs |
| --- | --- | --- |
| `AppShell` | Desktop nav rail, mobile menu, top bar and main landmark. Nav links home and six use cases; current route uses `aria-current="page"`. | `app__navigation`, `app__mobile-menu`, `app__main` |
| `ModeBadge` | Always visible in shell. Props `mode: "mock" | "live"`; label MOCK/LIVE plus icon/text and distinct semantic style. Live style must remain identifiable without color. | `app__mode-badge` |
| `ProbabilityBar` | Props label, probability 0..1. Show percentage text and a labelled `<progress>` or equivalent with bounded value; not color-only. Sort order follows domain output unless explicitly requested. | `<page>__probability-<name>` |
| `DecisionChip` | Props action, optional reason. Allow=positive, review= caution, block=negative, skipped=muted; always show readable action text. | `<page>__decision-chip` |
| `ReceiptCard` | One immutable stage receipt. Show stage/action/reason/threshold/time/hash; render probabilities if Jev ran, explicitly “Not evaluated” for intentional skip. | `decision-pipeline__receipt-stage-<stage>` |
| `CodePanel` | Heading “Example TypeScript”; readable, syntax-neutral code in `<pre><code>`, copy action optional and keyboard accessible. No secret, raw credential, generated bundle, or provider headers. On small screens comes after result. | `<page>__code-panel`, `<page>__copy-code` |
| `ThresholdSlider` | Native range input, associated label and adjacent numeric output. Keyboard arrows adjust by 0.01, Home/End to bounds. Commit runs only on change/submit per page behavior. | `threshold-playground__threshold-slider`, `threshold-playground__threshold-value` |
| `AsyncState` | Shared loading, empty and error patterns with visible text and appropriate status/alert role. Error may expose retry callback, never provider details. | `<page>__loading`, `<page>__empty`, `<page>__error` |
| `DemoForm` | Page-specific labeled fields, reset example and submit. Invalid fields have `aria-invalid` and described error; submit state prevents duplicates. | `<page>__form`, `<page>__run-button`, `<page>__reset-button` |

## Probability and threshold rules

Accept numeric probability only after schema validation. UI maps values to a 0–100 percentage and may round to the nearest integer for text; preserve full precision for decision logic. Use a minimum visible bar width only if the numeric label still communicates the actual value. Threshold comparison is visible in the playground; keep `probabilities` fixed while threshold changes.

## Data-testid convention

Use `<page>__<element>[-<qualifier>]`, with kebab-case values and the exact page keys documented in `design-system.md`. Stable examples: `tool-safety__tool-name`, `ticket-triage__queue-result`, `content-moderation__policy-input`, `decision-pipeline__receipt-stage-permission`, `jev-agent__trace-jev-check`, `threshold-playground__threshold-slider`. Do not select by CSS class or use test IDs as styling hooks.
