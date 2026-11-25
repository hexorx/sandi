import json
import unittest

from guardrails import blocked, inspect
from guardrail_streaming import VERDICT_MARKER
from litellm_guardrail import LocalPatternGuardrail
from main import _proxy_verdict, _without_verdict_marker
from streaming import GuardedAnswer, ProxyGuardrailBlocked, demo_events


class GuardrailTests(unittest.TestCase):
    def test_pii_detector_blocks_and_reports_details(self):
        results = inspect("Contact me at demo@example.test")
        self.assertTrue(blocked(results))
        self.assertIn("character", next(item["details"] for item in results if item["decision"] == "block"))

    def test_safe_text_is_allowed_by_each_guardrail(self):
        self.assertFalse(blocked(inspect("Please summarize this fictional note.")))


class LiteLLMGuardrailTests(unittest.IsolatedAsyncioTestCase):
    async def test_custom_pre_call_hook_allows_safe_prompt(self):
        callback = LocalPatternGuardrail()

        result = await callback.async_pre_call_hook(None, None, {
            "messages": [{"role": "user", "content": "Summarize this fictional note."}],
        }, "completion")

        self.assertEqual(result["messages"][0]["content"], "Summarize this fictional note.")

    async def test_custom_pre_call_hook_blocks_email_prompt(self):
        callback = LocalPatternGuardrail()

        with self.assertRaises(Exception) as raised:
            await callback.async_pre_call_hook(None, None, {
                "messages": [{"role": "user", "content": "Contact demo@example.test"}],
            }, "completion")

        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("email detector", str(raised.exception.detail))

    async def test_stream_hook_emits_allow_verdict_after_safe_chunks(self):
        callback = LocalPatternGuardrail()
        chunks = [
            {"id": "stream-1", "choices": [{"index": 0, "delta": {"content": "Safe answer."}, "finish_reason": None}]},
        ]

        async def response():
            for chunk in chunks:
                yield chunk

        result = [item async for item in callback.async_post_call_streaming_iterator_hook(None, response(), {})]

        self.assertEqual(result[0]["choices"][0]["delta"]["content"], "Safe answer.")
        self.assertEqual(result[-1]["choices"][0]["finish_reason"], "stop")
        verdict = result[-1]["guardrail_verdict"]
        self.assertEqual(verdict["decision"], "allow")
        self.assertEqual(verdict["guardrails"][0]["name"], "email detector")

    async def test_stream_hook_withholds_blocked_chunks_and_emits_verdict(self):
        callback = LocalPatternGuardrail()
        secret = "The fictional contact is demo@example.test."

        async def response():
            yield {"id": "stream-2", "choices": [{"index": 0, "delta": {"content": secret}, "finish_reason": None}]}

        result = [item async for item in callback.async_post_call_streaming_iterator_hook(None, response(), {})]

        self.assertEqual(len(result), 1)
        self.assertNotIn(secret, str(result))
        self.assertEqual(result[0]["choices"][0]["finish_reason"], "content_filter")
        verdict = result[0]["guardrail_verdict"]
        self.assertEqual(verdict["decision"], "block")
        self.assertEqual(verdict["guardrails"][0]["name"], "email detector")
        marker = result[0]["choices"][0]["delta"]["content"]
        self.assertTrue(marker.startswith(VERDICT_MARKER))
        self.assertEqual(json.loads(marker[len(VERDICT_MARKER):]), verdict)


class ProxyVerdictAdapterTests(unittest.TestCase):
    def test_strands_marker_is_removed_from_answer_and_adapted(self):
        verdict = {"guardrail_name": "local-pattern-guardrail", "decision": "allow", "guardrails": []}
        text = f"Safe answer.{VERDICT_MARKER}{json.dumps(verdict)}"

        answer, received_verdict = _without_verdict_marker(text)

        self.assertEqual(answer, "Safe answer.")
        self.assertEqual(received_verdict, verdict)

    def test_input_error_detail_is_the_proxy_verdict(self):
        verdict = {
            "guardrail_name": "local-pattern-guardrail",
            "decision": "block",
            "details": "Email detector blocked input.",
            "guardrails": [],
        }

        self.assertEqual(_proxy_verdict({"detail": verdict}), verdict)


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

    async def test_blocked_output_emits_details_without_leaking_tokens(self):
        async def answer_with_email():
            return GuardedAnswer(
                "The fictional contact is demo@example.test.",
                {
                    "guardrail_name": "local-pattern-guardrail",
                    "decision": "block",
                    "details": "Email address detected.",
                    "guardrails": [{
                        "name": "email detector", "decision": "block", "details": "Email address detected.",
                    }],
                },
            )

        events = [chunk.decode() async for chunk in demo_events(
            "Write a fictional memo.", mock=False, get_answer=answer_with_email,
        )]

        self.assertFalse(any("event: token" in chunk for chunk in events))
        verdict = next(chunk for chunk in events if "event: guardrail" in chunk)
        self.assertIn('"stage":"output"', verdict)
        self.assertIn('"name":"email detector","decision":"block"', verdict)
        self.assertNotIn("demo@example.test", "".join(events))

    async def test_live_input_block_adapts_proxy_verdict_without_local_reinspection(self):
        verdict = {
            "guardrail_name": "local-pattern-guardrail",
            "decision": "block",
            "details": "Email detector blocked input.",
            "guardrails": [{
                "name": "email detector", "decision": "block", "details": "Email detector blocked input.",
            }],
        }

        async def blocked_by_proxy():
            raise ProxyGuardrailBlocked(verdict)

        events = [chunk.decode() async for chunk in demo_events(
            "This prompt passes local inspection.", mock=False, get_answer=blocked_by_proxy,
        )]

        self.assertFalse(any("event: token" in chunk for chunk in events))
        self.assertIn('"stage":"input"', events[0])
        self.assertIn('"decision":"block"', events[0])


if __name__ == "__main__":
    unittest.main()
