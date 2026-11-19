# Strands decider on drone: feasibility

**Decision: GO for the application architecture and a limited live Qwen3 4B pilot; production/live decider activation remains gated on representative evaluation and application integration.** The existing application ADR selects TypeScript Strands in the Node server. Ollama was reachable and the TypeScript Strands tool loop passed a small live sample. Mock mode remains the offline default.

## 1. Deployment fit

The proposed Node service is a modest application workload, but this spike did not benchmark deployment capacity or sustained resource use. A local model adds a separate inference workload, so its suitability depends on the chosen runtime and deployment environment. GPU access and other infrastructure changes are outside this evaluation.

## 2. Python versus TypeScript Strands

Both Strands SDKs support agent invocation, streaming, structured output, custom tools, and MCP. The current provider matrix lists Bedrock, Anthropic and OpenAI for both, while Python additionally lists Ollama and several other integrations. Python would add a second runtime and a service/contract boundary. TypeScript fits the existing Vite + Node application, its shared Zod contracts, and ADR 0001's server-side Strands design. Use `@strands-agents/sdk` in the Node server and isolate it behind the use-case-5 adapter.

Python installation is `strands-agents` with optional provider extras (for example, `[bedrock]`); it brings a Python environment and provider dependencies. TypeScript uses `@strands-agents/sdk` and only the selected provider's peer dependency. Exact image sizes depend on the base image, lockfile and provider, and were not measured in this read-only spike. Both SDKs are actively maintained in the Strands monorepo; pin the package version and validate upgrades. The TypeScript SDK currently lacks a first-party Ollama integration, which matters if local Ollama is later chosen.

## 3. Model choices and configuration

The SDK comparison showed that TypeScript fits the existing application architecture, while Python would add a second runtime and service boundary. The TypeScript SDK does not list Ollama as a first-party provider, but its OpenAI-compatible model interface worked with the local endpoint used in the follow-up experiments. Provider configuration should remain optional and server-side. The ADR’s deterministic scripted adapter remains the default and must not construct a network provider in mock mode.

## 4. Latency and cost estimate

These are planning ranges, not measurements: a Jev request plus one hosted-model turn is likely on the order of 1–5 seconds under ordinary network conditions. A tool-use loop with a second model turn could be roughly 3–15 seconds end-to-end, with provider latency and queueing the largest unknowns. The ADR's 10-second request deadline means the server should propagate cancellation and cap the agent loop; multi-turn work may need to return a timeout rather than hold the request open.

Cost per decision cannot be responsibly priced without an approved provider/model and token profile. Estimate it as `(input tokens × input rate + output tokens × output rate) / 1,000,000`, multiplied by the number of model turns, plus Jev's applicable terms. No pricing lookup, API call, purchase, or spend was performed. Mock decisions cost nothing.

## 5. Fit with jev-showcase deployment

Use the application’s Node deployment, with Strands invoked in-process on the server. This avoids a Python sidecar and a second schema boundary. Keep provider configuration optional and live mode explicitly disabled until the local model adapter is integrated and validated.

## 6. Security and operational boundaries

Configure any provider secrets through the deployment’s runtime secret mechanism. Never put secret values in the repository, image, browser bundle, logs, fixtures, screenshots, or issue/PR text. Keep secrets server-side and redact provider errors and request details. Tests and CI stay offline in mock mode and fail if a live adapter is reached. This spike did not make infrastructure changes or expose an endpoint publicly.

## Recommendation

Proceed with the ADR's TypeScript Strands adapter and offline scripted model in the Node app. Treat deployment capacity and a limited LAN-local Qwen3 4B pilot as **GO**. This small sample does not establish accuracy on representative decisions or reliability under repeated use, so keep production live mode disabled pending broader evaluation and app-level integration. Do not add a Python sidecar or enable local CPU inference for this use case. Keep the endpoint private to the LAN; no paid provider or new credential is needed for the tested local path.

## Follow-up: live local model smoke test (Nov 19, 2026)

After the original assessment, a LAN-only Ollama endpoint became available, serving `hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M`. One harmless two-turn `/api/chat` tool-use exchange succeeded with `options.num_ctx` set to 8192:

1. The model requested `lookup_status(item_id="demo-42")` exactly once.
2. The caller returned the fixed local stub result `demo-42 status: ready`; the model replied that the item was ready.

The first model response took 1.58 seconds (24 generated tokens); the final response took 0.82 seconds (15 generated tokens), about 2.40 seconds total across both requests. This confirms live model reachability, structured tool-call output, and a final response for this simple case. It was a direct Ollama API smoke test: it did **not** exercise Strands, drone deployment, sustained load, or application-level timeouts. Keep mock mode as the test/CI default and do not expose the endpoint publicly. Next validation is an app-level adapter test that preserves those boundaries.

## Follow-up: live Strands decider sample (Nov 19, 2026)

The live run used the Strands SDK’s OpenAI-compatible chat model with a local endpoint and only synthetic prompts plus a local stub tool. No application traffic or paid APIs were involved.

| Decision | Result | Strands invocation latency |
| --- | --- | ---: |
| Classify “My package has not arrived yet” as billing, shipping, or account | `shipping` (expected) | 417 ms |
| Decide whether 8/100 is below 10% | `Yes` (expected) | 488 ms |
| Look up synthetic order `4821` with `lookup_order` | Called once with `order_id: "4821"`; returned packed, ETA 2 days | 2,293 ms |

All three calls completed without model/request failures. The tool name, argument, and result were correct. The tool-use case took longer because it included the model/tool/model loop. This small synthetic sample does not measure accuracy on production traffic or consistency across repeated runs. The initial local harness setup needed Strands' optional `openai` peer dependency; after adding it in run scratch, all calls succeeded.

**Model recommendation:** keep Qwen3 4B as the first local candidate; this sample does not justify stepping up to Qwen3 8B. Before enabling a live decider, evaluate a larger labeled set with representative and ambiguous decisions, malformed tool arguments, and repeatability checks against explicit acceptance thresholds. If 4B misses those thresholds, compare Qwen3 8B on the same set. Keep mock mode as the default and supply the live endpoint through runtime configuration.

## References

- [Strands feature availability](https://strandsagents.com/docs/)
- [Strands model providers and SDK matrix](https://strandsagents.com/docs/user-guide/sdk/model-providers/)
- [Strands TypeScript package and agent loop](https://github.com/strands-agents/harness-sdk)
- [Sandi ADR 0001](../adr/0001-jev-showcase-architecture.md)
