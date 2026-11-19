# Example app

- Follow the root `AGENTS.md` and `CODING_STANDARDS.md`.
- Run locally with `corepack pnpm --filter @sandi/example dev`; build and verify from the root with `corepack pnpm typecheck`, `test`, and `build`.
- Keep app-specific behavior in this app and shared contracts in `@sandi/shared`. Tests use local deterministic data only; do not add network calls or secrets.
