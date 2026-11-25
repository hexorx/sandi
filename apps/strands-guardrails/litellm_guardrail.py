"""LiteLLM proxy input guardrail. Uses only local deterministic patterns."""

from fastapi import HTTPException
from litellm.integrations.custom_logger import CustomLogger

from guardrails import blocked, inspect
from guardrail_streaming import GuardrailBlocked, buffer_guarded_stream


class LocalPatternGuardrail(CustomLogger):
    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        messages = data.get("messages", [])
        prompt = " ".join(
            str(message.get("content", "")) for message in messages if isinstance(message, dict)
        )
        results = inspect(prompt)
        if blocked(results):
            names = ", ".join(item["name"] for item in results if item["decision"] == "block")
            raise HTTPException(status_code=400, detail={"guardrail": "local-pattern-guardrail", "decision": "block", "details": names})
        return data

    async def async_post_call_streaming_iterator_hook(
        self, user_api_key_dict, response, request_data: dict
    ):
        """Buffer and inspect the full LiteLLM stream before releasing any chunks."""
        try:
            async for chunk in buffer_guarded_stream(response):
                yield chunk
        except GuardrailBlocked as error:
            raise HTTPException(
                status_code=400,
                detail={
                    "guardrail": "local-pattern-guardrail",
                    "decision": "block",
                    "guardrails": error.results,
                },
            ) from error


proxy_handler_instance = LocalPatternGuardrail()
