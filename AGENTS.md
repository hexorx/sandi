# Working in Sandi

- Use the pinned pnpm version through Corepack. Install with `corepack pnpm install --frozen-lockfile`; run `corepack pnpm lint`, `typecheck`, `test`, and `build` from the root.
- Follow `CODING_STANDARDS.md`. Use a test-first loop: add a failing test, implement the change, then rerun the focused test and relevant checks.
- Work on a focused branch and use conventional commits. Open a small PR; never push directly to `main`.
- Mock/replay mode is the default. Tests and CI must work offline with `TYPESAFE_API_KEY` unset. Never make live Jev or model calls in tests.
- This is a public repository. Keep secrets and private data out of code, logs, fixtures, screenshots, commits, and PRs. Use environment variables for local secrets; commit only variable names in `.env.example` and keep `.env` ignored.
- To verify offline, unset `TYPESAFE_API_KEY` and run the four root checks. Tests must use deterministic local data and must not require network access.
