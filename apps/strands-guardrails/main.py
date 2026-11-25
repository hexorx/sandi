"""HTTP/SSE boundary for the Strands + LiteLLM guardrails demonstration."""

from __future__ import annotations

import os
import json
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from strands import Agent
from strands.models.litellm import LiteLLMModel

from guardrail_streaming import VERDICT_MARKER
from streaming import GuardedAnswer, ProxyGuardrailBlocked, demo_events


app = FastAPI(title="Sandi Strands guardrails example")


class RunRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    mock: bool = False


def _proxy_verdict(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        verdict = value.get("guardrail_verdict")
        if isinstance(verdict, dict):
            return verdict
        data = value.get("data")
        if isinstance(data, str) and VERDICT_MARKER in data:
            candidate = _proxy_verdict(data.split(VERDICT_MARKER, 1)[1])
            if candidate is not None:
                return candidate
        for key in ("chunk", "event", "response", "body", "detail", "error", "message"):
            candidate = _proxy_verdict(value.get(key))
            if candidate is not None:
                return candidate
    elif isinstance(value, str):
        try:
            return _proxy_verdict(json.loads(value))
        except (json.JSONDecodeError, TypeError):
            return None
    else:
        model_dump = getattr(value, "model_dump", None)
        if callable(model_dump):
            return _proxy_verdict(model_dump())
        attributes = getattr(value, "__dict__", None)
        if isinstance(attributes, dict):
            return _proxy_verdict(attributes)
    return None


def _without_verdict_marker(text: str) -> tuple[str, dict[str, Any] | None]:
    if VERDICT_MARKER not in text:
        return text, None
    answer, encoded_verdict = text.split(VERDICT_MARKER, 1)
    return answer, _proxy_verdict(encoded_verdict)


async def live_answer(prompt: str) -> GuardedAnswer:
    proxy_url = os.environ.get("LITELLM_API_BASE", "http://litellm:4000")
    proxy_key = os.environ.get("LITELLM_API_KEY", "")
    model = LiteLLMModel(
        model_id=os.environ.get("STRANDS_MODEL_ID", "litellm_proxy/local-model"),
        client_args={"api_base": proxy_url, "api_key": proxy_key},
        params={"max_tokens": 300, "temperature": 0.2},
    )
    agent = Agent(model=model)
    fragments = []
    verdict = None
    try:
        async for item in agent.stream_async(prompt):
            if isinstance(item, dict) and isinstance(item.get("data"), str):
                answer_fragment, embedded_verdict = _without_verdict_marker(item["data"])
                if answer_fragment:
                    fragments.append(answer_fragment)
                verdict = embedded_verdict or verdict
            verdict = _proxy_verdict(item) or verdict
    except Exception as error:
        blocked_verdict = _proxy_verdict(getattr(error, "body", None))
        if blocked_verdict is None:
            blocked_verdict = _proxy_verdict(getattr(error, "detail", None))
        if blocked_verdict is None:
            blocked_verdict = _proxy_verdict(getattr(error, "message", None))
        if blocked_verdict is not None and blocked_verdict.get("decision") == "block":
            raise ProxyGuardrailBlocked(blocked_verdict) from error
        raise
    if verdict is None:
        raise RuntimeError("The Strands LiteLLM stream did not expose its proxy guardrail verdict.")
    return GuardedAnswer("".join(fragments), verdict)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.post("/run")
async def run(request: RunRequest):
    answer_provider = None if request.mock else lambda: live_answer(request.prompt)
    return StreamingResponse(demo_events(request.prompt, request.mock, answer_provider), media_type="text/event-stream", headers={"cache-control": "no-cache", "x-accel-buffering": "no"})
