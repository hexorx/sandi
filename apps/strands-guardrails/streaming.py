"""Dependency-free SSE framing and local guardrail execution for offline tests."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Awaitable, Callable

from guardrails import blocked, inspect


def event(name: str, data: dict) -> bytes:
    return f"event: {name}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n".encode()


async def demo_events(
    prompt: str,
    mock: bool,
    get_answer: Callable[[], Awaitable[str]] | None = None,
) -> AsyncIterator[bytes]:
    input_results = inspect(prompt)
    if blocked(input_results):
        yield event("guardrail", {"stage": "input", "guardrails": input_results, "decision": "block"})
        yield event("done", {"blocked": True})
        return

    if mock:
        answer = "The sample request passed local checks. Here is a short, safe response."
    elif get_answer is not None:
        answer = await get_answer()
    else:
        raise RuntimeError("A live answer provider is required unless mock mode is enabled.")

    output_results = inspect(answer)
    if not blocked(output_results):
        for offset in range(0, len(answer), 32):
            yield event("token", {"text": answer[offset : offset + 32]})
    yield event("guardrail", {"stage": "output", "guardrails": output_results, "decision": "block" if blocked(output_results) else "allow"})
    yield event("done", {"blocked": blocked(output_results)})
