# App package guidance template

- Follow the repository root `AGENTS.md` and `CODING_STANDARDS.md`.
- Document this app's run, lint, typecheck, test, and build commands here.
- Keep browser and server boundaries clear. Read secrets only on the server; default to deterministic mock/replay behavior.
- Tests and CI must run offline, with mock mode forced and no credentials.
