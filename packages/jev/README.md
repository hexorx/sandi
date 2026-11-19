# @sandi/jev

Typed TypeSafe Jev requests for `jev-1.14.0`. Mock mode is the default and makes no network calls.

```ts
import { choice, createJevClient, noul, request, score } from "@sandi/jev";

const jev = createJevClient(); // deterministic, offline mock
const input = request("Synthetic tool call: read account status", {
  allowed: noul("Should this read-only tool call be allowed?"),
  route: choice("Which demo queue fits?", { support: "Support", billing: "Billing" }),
  urgency: score("How urgent is the request?", ["low", "medium", "high"] as const),
});
const result = await jev.evaluate(input);
console.log(jev.mode, result.route?.probabilities);
```

`createJevClient({ mode: "replay", fixtures })` looks up fixtures by SHA-256 of canonical request JSON and throws `FixtureNotFoundError` on a miss. `createJevClient({ mode: "live", apiKey })` opts into HTTP explicitly. The API key is supplied by the server environment as `TYPESAFE_API_KEY`; never pass it to browser code. An injected `fetch` and runtime flags let tests exercise transport without network access. Tests and CI should omit the key and use mock or replay mode.

The mock computes one positive weight per answer key from SHA-256 of the canonical request, question name, and answer key, then normalizes those weights to probabilities. The output is stable for the same request and always covers every declared option or level.

The response validator currently expects a normalized map from question names to `{ value, probabilities }`, as documented by the showcase architecture. The provider's exact envelope has not been confirmed by a live smoke call yet; wire decoding is isolated in `src/validation.ts` so it can be adapted without changing callers.

To record a fixed synthetic demo fixture manually, build the package, set `TYPESAFE_API_KEY` in the shell, then run `pnpm --filter @sandi/jev record-fixture -- synthetic-tool-gate`. The recorder accepts only that named scenario, stores only its fixed request and validated response, and never writes headers or credentials.
