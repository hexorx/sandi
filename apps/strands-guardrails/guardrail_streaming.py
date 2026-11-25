"""Buffer LiteLLM streams and append a structured guardrail verdict chunk."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from guardrails import blocked, inspect


VERDICT_MARKER = "\x1eSANDI_GUARDRAIL:"


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


def _chunk_dict(chunk: Any) -> dict[str, Any]:
    if isinstance(chunk, dict):
        return dict(chunk)
    model_dump = getattr(chunk, "model_dump", None)
    if callable(model_dump):
        return model_dump(exclude_none=False)
    return vars(chunk)


def verdict_chunk(chunks: list[Any], results: list[dict[str, str]]) -> dict[str, Any]:
    """Create the documented LiteLLM stream extension carrying the policy verdict."""
    last = chunks[-1] if chunks else {}
    choices = _field(last, "choices", []) or []
    indices = [_field(choice, "index", index) for index, choice in enumerate(choices)] or [0]
    decision = "block" if blocked(results) else "allow"
    verdict = {
        "guardrail_name": "local-pattern-guardrail",
        "decision": decision,
        "details": "; ".join(
            item["details"] for item in results if item["decision"] == decision
        ),
        "guardrails": results,
    }
    verdict_data = json.dumps(verdict, separators=(",", ":"))
    return {
        "id": _field(last, "id", "guardrail-verdict"),
        "object": _field(last, "object", "chat.completion.chunk"),
        "created": _field(last, "created", 0),
        "model": _field(last, "model", ""),
        "choices": [
            {
                "index": index,
                "delta": {"content": f"{VERDICT_MARKER}{verdict_data}"},
                "finish_reason": "content_filter" if decision == "block" else "stop",
            }
            for index in indices
        ],
        "guardrail_verdict": verdict,
    }


async def stream_with_verdict(response: AsyncIterator[Any]) -> AsyncIterator[Any]:
    """Hold all text until inspection completes, then emit text and a verdict chunk."""
    chunks = [chunk async for chunk in response]
    results = inspect("".join(_chunk_text(chunk) for chunk in chunks))
    verdict = verdict_chunk(chunks, results)
    if blocked(results):
        yield verdict
        return
    if not chunks:
        yield verdict
        return
    for chunk in chunks[:-1]:
        yield chunk
    final_chunk = _chunk_dict(chunks[-1])
    for choice in final_chunk.get("choices", []):
        if choice.get("finish_reason") is None:
            choice["finish_reason"] = "stop"
    final_chunk["guardrail_verdict"] = verdict["guardrail_verdict"]
    yield final_chunk
