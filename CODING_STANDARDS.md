# Coding standards

- TypeScript is strict. Avoid `any`; use `unknown` at untrusted boundaries and validate external input before use. Keep types near their consumers and export only stable package APIs.
- Use descriptive names and consistent casing: `PascalCase` for components/types, `camelCase` for values/functions, and `kebab-case` for file names. Prefer small modules with one clear job.
- Examples are product content: keep code and UI readable, with direct names and short functions. Handle errors explicitly; return safe, actionable errors at API boundaries and never expose provider details or credentials.
- Test behavior with Vitest. Use Testing Library for UI behavior and Playwright for end-to-end flows. Keep tests deterministic, synthetic, and offline; force mock mode and fail if a live adapter is reached. Never require an API key in tests or CI.
- Use conventional commits and focused PRs. PRs include a summary, checks and results, risks/rollback, mock-mode confirmation, and confirmation that no secrets or private data were added.
- Review checklist: types and validation are sound; errors are handled; tests cover changed behavior; lint/typecheck/build pass; mock mode remains deterministic; no network or secret access leaked into tests/browser; documentation stays current.
- The repository is public. Read credentials only from server-side environment variables. Never commit, log, paste, or fixture secrets or private data. Keep `.env` ignored; `.env.example` lists variable names with empty or safe placeholder values only. Replay fixtures contain synthetic data and no headers or credentials.
