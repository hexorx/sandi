"""Dependency-free SSE framing and local guardrail execution for offline tests."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from guardrails import blocked, inspect


@dataclass(frozen=True)
class GuardedAnswer:
    text: str
    verdict: dict[str, Any]


class ProxyGuardrailBlocked(Exception):
    def __init__(self, verdict: dict[str, Any]):
        self.verdict = verdict
        super().__init__("The LiteLLM proxy blocked this request.")


def event(name: str, data: dict) -> bytes:
    return f"event: {name}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n".encode()


async def demo_events(
    prompt: str,
    mock: bool,
    get_answer: Callable[[], Awaitable[str | GuardedAnswer]] | None = None,
) -> AsyncIterator[bytes]:
    if mock:
        input_results = inspect(prompt)
        if blocked(input_results):
            yield event("guardrail", {"stage": "input", "guardrails": input_results, "decision": "block"})
            yield event("done", {"blocked": True})
            return
        answer = "The sample request passed local checks. Here is a short, safe response."
    elif get_answer is not None:
        try:
            answer_result = await get_answer()
        except ProxyGuardrailBlocked as error:
            yield event("guardrail", {"stage": "input", **error.verdict})
            yield event("done", {"blocked": True})
            return
        if not isinstance(answer_result, GuardedAnswer):
            raise RuntimeError("A live answer must include its LiteLLM proxy guardrail verdict.")
        answer = answer_result.text
        output_verdict = answer_result.verdict
        results = output_verdict.get("guardrails", [])
        decision = output_verdict.get("decision")
        if decision not in ("allow", "block") or not isinstance(results, list):
            raise RuntimeError("The LiteLLM proxy returned an invalid guardrail verdict.")
        if decision == "allow":
            for offset in range(0, len(answer), 32):
                yield event("token", {"text": answer[offset : offset + 32]})
        yield event("guardrail", {"stage": "output", "guardrails": results, "decision": decision})
        yield event("done", {"blocked": decision == "block"})
        return
    else:
        raise RuntimeError("A live answer provider is required unless mock mode is enabled.")

    output_results = inspect(answer)
    if not blocked(output_results):
        for offset in range(0, len(answer), 32):
            yield event("token", {"text": answer[offset : offset + 32]})
    yield event("guardrail", {"stage": "output", "guardrails": output_results, "decision": "block" if blocked(output_results) else "allow"})
    yield event("done", {"blocked": blocked(output_results)})
