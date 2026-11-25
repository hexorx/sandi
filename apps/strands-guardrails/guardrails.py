"""Local, deterministic guardrails used by the Strands showcase."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class GuardrailResult:
    name: str
    decision: str
    details: str


RULES: tuple[tuple[str, re.Pattern[str], str], ...] = (
    ("email detector", re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b"), "Email address detected"),
    ("phone detector", re.compile(r"\b(?:\+?\d[\d .()-]{7,}\d)\b"), "Phone number detected"),
    ("unsafe request filter", re.compile(r"\b(?:steal|build a bomb|make malware|exfiltrate)\b", re.I), "Potentially harmful request detected"),
)


def inspect(text: str) -> list[dict[str, str]]:
    """Return a per-guardrail verdict; any match blocks the request/response."""
    results = [
        asdict(GuardrailResult(name, "block", f"{details} at character {match.start()}."))
        if (match := pattern.search(text))
        else asdict(GuardrailResult(name, "allow", "No matching pattern detected."))
        for name, pattern, details in RULES
    ]
    return results


def blocked(results: list[dict[str, str]]) -> bool:
    return any(result["decision"] == "block" for result in results)
