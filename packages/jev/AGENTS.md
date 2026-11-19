# @sandi/jev package guidance

- Keep mock and replay paths fully offline and deterministic.
- Keep live transport behind the client factory and injected `fetch`.
- Never log credentials, authorization headers, request state, or raw upstream errors.
- Use synthetic demo inputs only in fixtures. Do not record arbitrary user state.
- Keep the model pinned to `jev-1.14.0`; validate the wire response at the adapter boundary.
- Run package tests, typecheck, lint, and build with `TYPESAFE_API_KEY` unset.
