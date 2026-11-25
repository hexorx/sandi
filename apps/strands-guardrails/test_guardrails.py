import unittest

from guardrails import blocked, inspect
from streaming import demo_events


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


if __name__ == "__main__":
    unittest.main()
