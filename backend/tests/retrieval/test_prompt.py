from __future__ import annotations

import pytest

from app.nlp.intent import IntentResult, QuestionIntent
from app.retrieval.prompt import (
    ANSWER_SCHEMA,
    EVIDENCE_RULES,
    LAYOUTS,
    SYSTEM_PROMPT,
    build_answer_prompt,
)

CONTEXT = "EVIDENCE (cite only these aliases):\n[E1] httpx/_config.py\nretries = 0\n"


def _intent(kind: QuestionIntent) -> IntentResult:
    return IntentResult(kind, 0.9, "keywords", {})


@pytest.mark.parametrize("kind", list(QuestionIntent))
def test_every_intent_has_a_layout_and_keeps_evidence_rules(kind: QuestionIntent) -> None:
    prompt = build_answer_prompt(
        question="  Why are retries off?  ", context_block=CONTEXT, intent=_intent(kind)
    )
    assert prompt.system == SYSTEM_PROMPT
    assert prompt.schema is ANSWER_SCHEMA
    assert prompt.user.startswith(CONTEXT.rstrip())
    assert "Question: Why are retries off?" in prompt.user
    for section in LAYOUTS[kind].sections:
        assert section in prompt.user
    for rule in EVIDENCE_RULES:
        assert rule in prompt.user


def test_evidence_rules_come_after_the_friendly_layout() -> None:
    user = build_answer_prompt(
        question="q", context_block=CONTEXT, intent=_intent(QuestionIntent.RATIONALE)
    ).user
    assert user.index("Organise 'answer'") < user.index("Evidence rules (these override")


def test_layouts_differ_by_intent() -> None:
    who = build_answer_prompt(
        question="q", context_block=CONTEXT, intent=_intent(QuestionIntent.OWNERSHIP)
    ).user
    where = build_answer_prompt(
        question="q", context_block=CONTEXT, intent=_intent(QuestionIntent.LOCATION)
    ).user
    assert "**Who to ask:**" in who and "**Who to ask:**" not in where
    assert "**Start reading at:**" in where


def test_schema_contract_unchanged() -> None:
    assert ANSWER_SCHEMA["required"] == ["answer_status", "answer", "citations", "caveats"]
    assert ANSWER_SCHEMA["properties"]["answer_status"]["enum"] == [
        "answered",
        "insufficient_evidence",
    ]
