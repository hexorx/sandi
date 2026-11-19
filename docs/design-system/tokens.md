# Design tokens

These tokens are the UI source of truth for `apps/jev-showcase`. Keep both themes aligned and express status through labels/icons as well as color. All values are CSS-ready. Spacing and radius values use rems; shadows use CSS values.

## Color palettes

| Token | Light | Dark | Use |
|---|---|---|---|
| canvas | `#f5f7fa` | `#10151d` | App background |
| surface | `#ffffff` | `#19212c` | Cards, nav |
| surface-raised | `#ffffff` | `#222d3a` | Menus, focused panels |
| foreground | `#17212b` | `#f1f5f9` | Main text |
| muted | `#536273` | `#b5c1cf` | Secondary text |
| subtle | `#68788a` | `#9aa9ba` | Helper text |
| border | `#d5dee8` | `#344253` | Dividers, outlines |
| accent | `#087e8b` | `#55d3dc` | Links, primary actions |
| accent-strong | `#075f69` | `#a1f0f2` | Hover/focus accent |
| allow | `#087e70` | `#5ce0bd` | Allow/route |
| block | `#b42335` | `#ff8992` | Block |
| review | `#8a5700` | `#ffca68` | Review/warning |
| neutral | `#536273` | `#b5c1cf` | Skipped/mock |
| code-bg | `#111b27` | `#0b1017` | Code surface |
| code-fg | `#e5edf5` | `#e5edf5` | Code text |

## Type scale

System stack: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; code: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.

| Name | Size / line height | Weight | Use |
|---|---:|---:|---|
| display | 2.5rem / 1.1 | 700 | Home hero |
| h1 | 2rem / 1.2 | 700 | Page title |
| h2 | 1.375rem / 1.3 | 650 | Section title |
| h3 | 1.125rem / 1.35 | 600 | Card title |
| body | 1rem / 1.5 | 400 | Body and form labels |
| small | 0.875rem / 1.45 | 400 | Metadata |
| overline | 0.75rem / 1.4 | 700 | Eyebrow, uppercase |
| code | 0.875rem / 1.6 | 400 | Code |

## Spacing, radius, shadows

Spacing scale: `0.25rem, 0.5rem, 0.75rem, 1rem, 1.5rem, 2rem, 3rem, 4rem` (Tailwind `1–16`).

| Token | Value | Use |
|---|---:|---|
| radius-sm | 0.375rem | Inputs, chips |
| radius-md | 0.625rem | Cards |
| radius-lg | 1rem | Large panels |
| radius-pill | 9999px | Badges |
| shadow-sm | `0 1px 2px rgb(16 24 40 / 0.08)` | Cards |
| shadow-md | `0 8px 24px rgb(16 24 40 / 0.12)` | Popovers |
| focus-ring | `0 0 0 2px var(--canvas), 0 0 0 4px var(--accent)` | Keyboard focus |

## Tailwind mapping

Map theme colors to CSS custom properties (e.g. `canvas: 'var(--canvas)'`) so a single `data-theme="light|dark"` on the document root changes the palette. Suggested keys: `colors.canvas`, `surface`, `foreground`, `muted`, `border`, `accent`, `allow`, `block`, `review`, `neutral`, `code`; `fontFamily.sans`, `fontFamily.mono`; `fontSize.display|h1|h2|h3|body|small|overline|code`; `borderRadius.sm|md|lg|pill`; `boxShadow.sm|md`. Keep focus styling in CSS so it can use the active theme values.
