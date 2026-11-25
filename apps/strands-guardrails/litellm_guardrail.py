"""LiteLLM proxy input guardrail. Uses only local deterministic patterns."""

from fastapi import HTTPException
from litellm.integrations.custom_logger import CustomLogger

from guardrails import blocked, inspect
from guardrail_streaming import stream_with_verdict


class LocalPatternGuardrail(CustomLogger):
    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        messages = data.get("messages", [])
        prompt = " ".join(
            str(message.get("content", "")) for message in messages if isinstance(message, dict)
        )
        results = inspect(prompt)
        if blocked(results):
            raise HTTPException(
                status_code=400,
                detail={
                    "guardrail_name": "local-pattern-guardrail",
                    "decision": "block",
                    "details": "; ".join(
                        f"{item['name']}: {item['details']}"
                        for item in results if item["decision"] == "block"
                    ),
                    "guardrails": results,
                },
            )
        return data

    async def async_post_call_streaming_iterator_hook(
        self, user_api_key_dict, response, request_data: dict
    ):
        """Buffer output and append an allow/block verdict inside the response stream."""
        async for chunk in stream_with_verdict(response):
            yield chunk


proxy_handler_instance = LocalPatternGuardrail()
