# Shared package

- Follow the root `AGENTS.md` and `CODING_STANDARDS.md`.
- Keep this package framework-independent. Export supported contracts from `src/index.ts`; avoid importing from apps or reaching into another package's source.
- Run focused checks with `corepack pnpm --filter @sandi/shared typecheck` and `test`. Keep runtime validation and inferred types together where practical.
