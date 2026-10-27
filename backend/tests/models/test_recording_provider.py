"""RecordingProvider sums the usage the wrapped provider reports."""

from __future__ import annotations

from typing import Any

from app.intent.llm.provider import RecordingProvider


class _FakeProvider:
    def __init__(self, usages: list[dict[str, Any] | None]) -> None:
        self._usages = usages
        self.last_usage: dict[str, Any] | None = None

    def complete(self, *, system: str, user: str, schema: dict, schema_name: str) -> str:
        self.last_usage = self._usages.pop(0)
        return "{}"


def test_totals_sum_across_calls() -> None:
    recorder = RecordingProvider(
        _FakeProvider(
            [
                {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
                {"prompt_tokens": 3, "completion_tokens": 2, "total_tokens": 5},
            ]
        )
    )
    recorder.complete(system="s", user="u", schema={}, schema_name="x")
    recorder.complete(system="s", user="u", schema={}, schema_name="x")
    assert recorder.totals() == {
        "prompt_tokens": 13,
        "completion_tokens": 7,
        "total_tokens": 20,
        "calls": 2,
    }


def test_missing_usage_counts_the_call_but_no_tokens() -> None:
    recorder = RecordingProvider(_FakeProvider([None]))
    recorder.complete(system="s", user="u", schema={}, schema_name="x")
    assert recorder.totals() == {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "calls": 1,
    }


def test_total_falls_back_to_prompt_plus_completion() -> None:
    recorder = RecordingProvider(
        _FakeProvider([{"prompt_tokens": 7, "completion_tokens": 3}])
    )
    recorder.complete(system="s", user="u", schema={}, schema_name="x")
    assert recorder.totals()["total_tokens"] == 10
