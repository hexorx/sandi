"""Buffer a LiteLLM stream until local output guardrails have inspected it."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from guardrails import blocked, inspect


class GuardrailBlocked(Exception):
    def __init__(self, results: list[dict[str, str]]):
        self.results = results
        super().__init__("The streamed response was blocked by a local guardrail.")


def _field(value: Any, key: str, default: Any = None) -> Any:
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _chunk_text(chunk: Any) -> str:
    text = []
    for choice in _field(chunk, "choices", []) or []:
        delta = _field(choice, "delta")
        content = _field(delta, "content") if delta is not None else None
        if isinstance(content, str):
            text.append(content)
    return "".join(text)


async def buffer_guarded_stream(response: AsyncIterator[Any]) -> AsyncIterator[Any]:
    """Release original chunks only after the complete response passes inspection."""
    chunks = [chunk async for chunk in response]
    results = inspect("".join(_chunk_text(chunk) for chunk in chunks))
    if blocked(results):
        raise GuardrailBlocked(results)
    for chunk in chunks:
        yield chunk
