import unittest

from guardrails import blocked, inspect
from guardrail_streaming import GuardrailBlocked, buffer_guarded_stream
from streaming import demo_events

try:
    from litellm_guardrail import LocalPatternGuardrail
except ModuleNotFoundError as error:
    if error.name not in {"fastapi", "litellm"}:
        raise
    LocalPatternGuardrail = None


class GuardrailTests(unittest.TestCase):
    def test_pii_detector_blocks_and_reports_details(self):
        results = inspect("Contact me at demo@example.test")
        self.assertTrue(blocked(results))
        self.assertIn("character", next(item["details"] for item in results if item["decision"] == "block"))

    def test_safe_text_is_allowed_by_each_guardrail(self):
        self.assertFalse(blocked(inspect("Please summarize this fictional note.")))


class StreamingTests(unittest.IsolatedAsyncioTestCase):
    async def test_stream_emits_tokens_and_final_guardrail_result(self):
        events = [chunk.decode() async for chunk in demo_events("Summarize this note.", mock=True)]
        self.assertTrue(any("event: token" in chunk for chunk in events))
        verdict = next(chunk for chunk in events if "event: guardrail" in chunk)
        self.assertIn('"decision":"allow"', verdict)
        self.assertIn('"name":"unsafe request filter"', verdict)

    async def test_blocked_path_emits_guardrail_result_and_no_token(self):
        events = [chunk.decode() async for chunk in demo_events("Email demo@example.test", mock=True)]
        self.assertFalse(any("event: token" in chunk for chunk in events))
        verdict = next(chunk for chunk in events if "event: guardrail" in chunk)
        self.assertIn('"decision":"block"', verdict)

    async def test_litellm_stream_hook_releases_allowed_chunks_after_inspection(self):
        chunks = [
            {"choices": [{"delta": {"content": "A safe "}}]},
            {"choices": [{"delta": {"content": "answer."}}]},
        ]

        async def response():
            for chunk in chunks:
                yield chunk

        emitted = [chunk async for chunk in buffer_guarded_stream(response())]
        self.assertEqual(emitted, chunks)

    async def test_litellm_stream_hook_does_not_release_blocked_output(self):
        chunks = [
            {"choices": [{"delta": {"content": "Contact demo@example.test"}}]},
        ]
        released = []

        async def response():
            for chunk in chunks:
                yield chunk

        with self.assertRaises(GuardrailBlocked) as error:
            async for chunk in buffer_guarded_stream(response()):
                released.append(chunk)

        self.assertEqual(released, [])
        self.assertEqual(error.exception.results[0]["decision"], "block")


@unittest.skipIf(LocalPatternGuardrail is None, "LiteLLM dependencies are installed in the demo container")
class LiteLLMCallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_callback_releases_allowed_chunks(self):
        chunks = [{"choices": [{"delta": {"content": "A safe response."}}]}]

        async def response():
            for chunk in chunks:
                yield chunk

        callback = LocalPatternGuardrail()
        emitted = [
            chunk
            async for chunk in callback.async_post_call_streaming_iterator_hook(
                user_api_key_dict=None, response=response(), request_data={}
            )
        ]
        self.assertEqual(emitted, chunks)

    async def test_callback_returns_guardrail_details_without_releasing_blocked_chunks(self):
        chunks = [{"choices": [{"delta": {"content": "Contact demo@example.test"}}]}]
        released = []

        async def response():
            for chunk in chunks:
                yield chunk

        callback = LocalPatternGuardrail()
        with self.assertRaises(Exception) as error:
            async for chunk in callback.async_post_call_streaming_iterator_hook(
                user_api_key_dict=None, response=response(), request_data={}
            ):
                released.append(chunk)

        self.assertEqual(released, [])
        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail["decision"], "block")
        self.assertTrue(error.exception.detail["guardrails"])


if __name__ == "__main__":
    unittest.main()
