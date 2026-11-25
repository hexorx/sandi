"""HTTP/SSE boundary for the Strands + LiteLLM guardrails demonstration."""

from __future__ import annotations

import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from strands import Agent
from strands.models.litellm import LiteLLMModel

from streaming import demo_events


app = FastAPI(title="Sandi Strands guardrails example")


class RunRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    mock: bool = False


async def live_answer(prompt: str) -> str:
    proxy_url = os.environ.get("LITELLM_API_BASE", "http://litellm:4000")
    proxy_key = os.environ.get("LITELLM_API_KEY", "")
    model = LiteLLMModel(
        model_id=os.environ.get("STRANDS_MODEL_ID", "litellm_proxy/local-model"),
        client_args={"api_base": proxy_url, "api_key": proxy_key},
        params={"max_tokens": 300, "temperature": 0.2},
    )
    agent = Agent(model=model)
    fragments = []
    async for item in agent.stream_async(prompt):
        if isinstance(item, dict) and isinstance(item.get("data"), str):
            fragments.append(item["data"])
    return "".join(fragments)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.post("/run")
async def run(request: RunRequest):
    answer_provider = None if request.mock else lambda: live_answer(request.prompt)
    return StreamingResponse(demo_events(request.prompt, request.mock, answer_provider), media_type="text/event-stream", headers={"cache-control": "no-cache", "x-accel-buffering": "no"})
