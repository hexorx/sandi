# Jev Showcase design system

The Jev Showcase UI is a compact decision workbench: a visitor can understand the decision, inspect the evidence, and see the code that produced it. Keep the interface quiet and legible; use color to communicate state only when paired with text or an icon.

## Page frame

- A 64px top bar holds the Sandi mark, current use case, persistent `MOCK`/`LIVE` badge, and theme control.
- A 240px desktop rail lists Home and the six demos in their numbered order. Below 1024px it becomes a labeled select menu; below 640px it moves into a compact horizontal scroll region with visible focus.
- Main content is centered at 1440px maximum width with 24px desktop gutters and 16px mobile gutters.
- Use a two-column demo layout at 1100px and above: interaction/result at 60%, readable code at 40%. Stack at smaller widths with the code panel after the result.
- Page heading has an eyebrow, title, one-sentence explanation, and an optional action. Keep the content order stable as columns stack.

## Tokens

The machine-readable Tailwind mapping is in [tokens.md](./tokens.md). The palettes are designed for both modes; semantic colors are never the only signal. Use the system font stack so the app works offline and needs no downloaded assets.

## Components

- **App shell and nav:** landmarks are `header`, `nav`, and `main`. Current navigation links use `aria-current="page"`.
- **Mode badge:** text `MOCK` or `LIVE`, with a small circle; green is reserved for live and slate for mock. Always render from server mode metadata.
- **Probability bar:** label, percentage text, and a native `<progress>` element (or `role="meter"` with accessible name, min/max/now). Use a fixed 0–100 scale; never imply precision beyond the displayed whole percent.
- **Gauge:** pair the visual arc with a visible numeric value and text label. Provide a non-visual equivalent; do not use color alone.
- **Decision chip:** “ALLOW”, “BLOCK”, “ROUTE”, “REVIEW”, or “SKIPPED”, with an icon/shape and text. Semantic colors: allow/route teal, block red, review amber, skipped neutral.
- **Receipt card:** a definition list for stage, outcome, reason, threshold and timestamp; expandable details show input hash and probabilities. Skipped stages remain visible and say why they were skipped.
- **Code panel:** syntax-colored but high-contrast, selectable text, horizontally scrollable on narrow screens, with a copy button that announces success in a polite live region.
- **Threshold slider:** native range input with a visible current value, keyboard step 1 percentage point, labeled “Block when confidence is below”. Show a static marker for the current decision confidence.
- **Loading:** preserve page layout with labeled skeletons and “Running decision…” in a live region; disable repeat submission while pending.
- **Empty:** explain what action to take, e.g. “Choose a sample scenario to see a decision.”
- **Error:** plain-language summary, request id when available, and retry action. Never show provider response text, headers, or credentials.

## Accessibility and interaction

- Target WCAG 2.2 AA contrast: 4.5:1 for normal text, 3:1 for large text and controls. Use the theme foreground/background pairs from tokens.
- Keyboard order follows visual order; every action works with keyboard. Focus is visible with a 2px accent outline and 2px offset. Do not remove browser focus without replacement.
- Respect `prefers-reduced-motion`; motion is limited to 150ms feedback and disabled when reduced motion is requested.
- Keep body copy at 16px minimum, line-height 1.5. Labels remain visible; placeholder text is not a label.
- E2E selectors use `data-testid="kebab-case"` only for stable test hooks. Prefer role/name locators in tests; test IDs are not accessibility labels.
- Announce asynchronous result/error changes through `aria-live="polite"`; use `role="alert"` for blocking errors.
- On narrow screens, no information is available only by hover; tables and code can scroll horizontally with a visible affordance.

## Sample data rules

Use synthetic examples only. Names, tickets, messages, and snippets in [screens.md](./screens.md) are invented for the demo. No customer data or provider credentials belong in UI fixtures, logs, docs, or screenshots.
