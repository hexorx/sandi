/**
 * App-local design tokens for the Jev showcase.
 * Keep presentation tokens here; domain and API types belong in packages/shared.
 * Components should consume semantic colors so light/dark mode stays consistent.
 */
const config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        elevated: "rgb(var(--color-elevated) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--color-brand) / <alpha-value>)",
          strong: "rgb(var(--color-brand-strong) / <alpha-value>)",
          soft: "rgb(var(--color-brand-soft) / <alpha-value>)",
        },
        positive: "rgb(var(--color-positive) / <alpha-value>)",
        caution: "rgb(var(--color-caution) / <alpha-value>)",
        negative: "rgb(var(--color-negative) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        display: ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.04em", fontWeight: "650" }],
        title: ["1.5rem", { lineHeight: "1.25", letterSpacing: "-0.025em", fontWeight: "650" }],
        heading: ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["0.9375rem", { lineHeight: "1.6" }],
        compact: ["0.8125rem", { lineHeight: "1.5" }],
        micro: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.04em" }],
      },
      spacing: {
        4.5: "1.125rem",
        5.5: "1.375rem",
        18: "4.5rem",
        22: "5.5rem",
      },
      borderRadius: {
        card: "0.875rem",
        panel: "1.125rem",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.04)",
        popover: "0 16px 40px rgb(15 23 42 / 0.16)",
        focus: "0 0 0 3px rgb(var(--color-brand) / 0.28)",
      },
      maxWidth: {
        reading: "44rem",
        workspace: "88rem",
      },
    },
  },
};

export default config;
