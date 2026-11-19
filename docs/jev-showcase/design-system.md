# Jev showcase design system

App-local UI system for `apps/jev-showcase`, an offline-first set of six TypeSafe Jev demos. Keep components in `apps/jev-showcase/src/client`; do not add a shared UI package until another app needs these components. API/domain contracts stay in `packages/shared`, and Jev transport stays in `packages/jev`.

## Product feel

Make a technical decision system feel calm, explainable, and inspectable. Use a warm near-white canvas, deep ink, cool blue-violet as the single brand accent, and restrained green/amber/red for outcomes. Every result explains what was evaluated and why. Avoid implying that an action ran: tool and agent actions are always simulated.

## Tokens

`apps/jev-showcase/tailwind.config.ts` defines Tailwind semantic color and type aliases. Define corresponding CSS custom properties in the app's global stylesheet; switch the values under `.dark`. Components should use semantic aliases (`bg-canvas`, `text-ink`, `border-line`, `text-positive`) rather than hard-coded palette values.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| canvas | `#F6F7FB` | `#10131B` | App background |
| surface | `#FFFFFF` | `#181D28` | Cards and form areas |
| elevated | `#F0F2F8` | `#222938` | Inputs, code panel, selected rows |
| ink | `#182033` | `#F2F4FA` | Primary text |
| muted | `#58647A` | `#A6B0C2` | Secondary text; maintain 4.5:1 for body text |
| line | `#DCE1EB` | `#30394A` | Borders and dividers |
| brand | `#5146D8` | `#A69BFF` | Links, primary actions, focus |
| brand-strong | `#4035BD` | `#C0B8FF` | Hover/pressed accent |
| brand-soft | `#EEEDFF` | `#292644` | Subtle selected state |
| positive | `#16734A` | `#65D6A0` | Allow, resolved, high confidence |
| caution | `#8A5A00` | `#F3C56B` | Review, medium confidence |
| negative | `#B42336` | `#FF8290` | Block, error, low confidence |
| info | `#2463A6` | `#78B8FF` | Informational state |

Use `Inter` for UI and `ui-monospace` for code. Inter is available under the SIL Open Font License; use a system sans fallback if the font is not bundled. No remote font or image request is required. Type roles: display 40/44, title 24/30, heading 18/25, body 15/24, compact 13/20, micro 11/15. Keep paragraph width near 44rem. Use a 4px base spacing scale; common gaps are 8, 12, 16, 24, 32, 48. Cards use 14px radius, major panels 18px, pills fully rounded. Use subtle card shadow and a visible 3px focus ring; do not use shadow alone to indicate state.

## Layout and navigation

At desktop widths use a 248px left navigation rail and a fluid main column capped at 1408px. Top bar carries the product name, current page title and persistent mode badge. Main content uses a two-column demo/results and code layout (roughly 3:2); at widths below 960px stack code below the interactive panel. At mobile width collapse navigation behind an accessible menu and keep controls full width. Home plus six pages: Tool safety, Ticket triage, Content moderation, Decision pipeline, Jev agent, Threshold playground. Each page has a breadcrumb/title, one-sentence purpose, mode state, demo card, result card and neighboring code panel.

## Interaction and accessibility

- All controls have visible labels; placeholders are examples, never labels. Use native buttons, inputs, `select`, and `input[type=range]` where possible.
- Keyboard order follows visual order. Focus is never removed; focus indicators meet 3:1 contrast against adjacent colors. Escape closes transient menus/dialogs; Enter/Space activate controls.
- Announce completed results and errors with `role="status"` or `role="alert"`; avoid announcing every slider tick. Probability is shown numerically as well as graphically, and outcome never relies on color alone.
- Keep body text at 4.5:1 contrast, large text and UI boundaries at 3:1. Verify both themes. Respect `prefers-reduced-motion`; transitions are short and nonessential.
- A live run requires per-run confirmation that synthetic input will be sent to TypeSafe Jev and/or the configured model provider. Mock mode remains default and visibly distinct. Never place server environment values in client code.

## Test IDs

Use stable, semantic `data-testid` values in kebab case: `<page>__<element>[-<qualifier>]`. Page is one of `home`, `tool-safety`, `ticket-triage`, `content-moderation`, `decision-pipeline`, `jev-agent`, `threshold-playground`. Examples: `tool-safety__run-button`, `tool-safety__decision-chip`, `decision-pipeline__receipt-stage-policy`, `jev-agent__trace-jev-check`, `threshold-playground__threshold-slider`, `app__mode-badge`. IDs identify behavior-facing landmarks, not styling wrappers; do not encode random or localized values.

## Build states

Every demo has idle/example, submitting, success, empty (when no result exists), validation error, recoverable API error, and reset-to-example states. Submitting disables duplicate run actions and exposes a text status. Errors stay next to the form/result and preserve the example; never include provider detail, credentials, or submitted private data in error text. See [screens.md](./screens.md) and [components.md](./components.md) for exact page and component contracts.
