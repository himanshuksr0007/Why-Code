from __future__ import annotations

import importlib.util
import logging
import sys
import threading
from collections.abc import Sequence
from typing import Any

import pytest

import app.nlp.intent as intent_module
from app.nlp.intent import (
    DEFAULT_MODEL,
    EXAMPLES,
    KEYWORD_TRUST,
    IntentClassifier,
    QuestionIntent,
    classify_with_keywords,
    default_classifier,
)

AXES = [intent for intent in QuestionIntent if intent is not QuestionIntent.GENERAL]
_EXAMPLE_INTENT = {text: intent for intent, texts in EXAMPLES.items() for text in texts}


class FakeEncoder:
    """Stands in for DistilBERT: one axis per intent.

    Example questions embed on their own intent's axis; a query embeds on
    the axes listed for it in ``queries`` (several axes = an ambiguous one).
    """

    def __init__(self, queries: dict[str, Sequence[QuestionIntent]] | None = None) -> None:
        self.queries = queries or {}
        self.calls: list[list[str]] = []

    def __call__(self, texts: Sequence[str]) -> list[list[float]]:
        self.calls.append(list(texts))
        return [self._vector(text) for text in texts]

    def _vector(self, text: str) -> list[float]:
        on = self.queries.get(text) or [_EXAMPLE_INTENT.get(text, QuestionIntent.RATIONALE)]
        return [1.0 if axis in on else 0.0 for axis in AXES]

    @property
    def query_calls(self) -> list[list[str]]:
        return [call for call in self.calls if len(call) == 1]


# A question with no keyword trigger, so only the model can place it.
UNSETTLED = "Tell me about the cookie jar"


# --- keyword rules -------------------------------------------------------------


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("Why are retries disabled by default?", QuestionIntent.RATIONALE),
        ("Who decided to drop HTTP/1.0 support?", QuestionIntent.OWNERSHIP),
        ("When was the timeout default changed?", QuestionIntent.HISTORY),
        ("Where is connection pooling implemented?", QuestionIntent.LOCATION),
        ("How does the transport layer work?", QuestionIntent.BEHAVIOUR),
        ("Why use anyio instead of asyncio directly?", QuestionIntent.COMPARISON),
        ("hello there", QuestionIntent.GENERAL),
    ],
)
def test_keyword_rules(question: str, expected: QuestionIntent) -> None:
    result = classify_with_keywords(question)
    assert result.intent is expected
    assert result.backend == "keywords"


def test_keyword_scores_cover_every_non_general_intent() -> None:
    result = classify_with_keywords("Why?")
    assert set(result.scores) == {intent.value for intent in AXES}


def test_keyword_confidence_is_share_of_hits() -> None:
    # "why" -> rationale (1); "instead of" -> comparison (1); tie -> comparison
    result = classify_with_keywords("Why X instead of Y?")
    assert result.intent is QuestionIntent.COMPARISON
    assert result.confidence == pytest.approx(0.5)


def test_keyword_rule_order_breaks_ties() -> None:
    result = classify_with_keywords("Who changed it?")
    assert result.scores["ownership"] == result.scores["history"]
    assert result.intent is QuestionIntent.OWNERSHIP


def test_keyword_matching_ignores_case() -> None:
    assert classify_with_keywords("WHERE IS THE POOL?").intent is QuestionIntent.LOCATION


def test_no_keyword_hits_gives_zero_confidence() -> None:
    result = classify_with_keywords("hello there")
    assert result.confidence == 0.0
    assert all(score == 0.0 for score in result.scores.values())


# --- hybrid routing ------------------------------------------------------------


def test_confident_keywords_never_touch_the_model() -> None:
    encoder = FakeEncoder()
    result = IntentClassifier(encoder=encoder).classify("Who owns the pool?")
    assert result.backend == "keywords"
    assert result.intent is QuestionIntent.OWNERSHIP
    assert result.confidence >= KEYWORD_TRUST
    assert encoder.calls == []


def test_unsettled_question_goes_to_distilbert() -> None:
    encoder = FakeEncoder({UNSETTLED: [QuestionIntent.LOCATION]})
    result = IntentClassifier(encoder=encoder).classify(UNSETTLED)
    assert result.backend == "distilbert"
    assert result.intent is QuestionIntent.LOCATION
    assert result.confidence == pytest.approx(1.0)
    assert sum(result.scores.values()) == pytest.approx(1.0, abs=1e-3)


def test_examples_are_embedded_once_and_reused() -> None:
    encoder = FakeEncoder({UNSETTLED: [QuestionIntent.BEHAVIOUR]})
    classifier = IntentClassifier(encoder=encoder)
    classifier.classify(UNSETTLED)
    classifier.classify(UNSETTLED)
    batches = [call for call in encoder.calls if len(call) > 1]
    assert len(batches) == 1
    assert len(batches[0]) == sum(len(texts) for texts in EXAMPLES.values())
    assert len(encoder.query_calls) == 2


def test_split_vote_becomes_general() -> None:
    # One example per intent: an ambiguous query ties three intents, so no
    # intent reaches the minimum vote share.
    examples = {intent: (f"example {intent.value}",) for intent in AXES}
    ambiguous = [QuestionIntent.RATIONALE, QuestionIntent.HISTORY, QuestionIntent.LOCATION]

    def encode(texts: Sequence[str]) -> list[list[float]]:
        out = []
        for text in texts:
            on = ambiguous if text == UNSETTLED else [QuestionIntent(text.split()[1])]
            out.append([1.0 if axis in on else 0.0 for axis in AXES])
        return out

    result = IntentClassifier(encoder=encode, examples=examples).classify(UNSETTLED)
    assert result.backend == "distilbert"
    assert result.intent is QuestionIntent.GENERAL


# --- input handling -------------------------------------------------------------


@pytest.mark.parametrize("question", ["", "   ", "\n\t"])
def test_blank_question_is_general_and_skips_the_model(question: str) -> None:
    encoder = FakeEncoder()
    result = IntentClassifier(encoder=encoder).classify(question)
    assert result.intent is QuestionIntent.GENERAL
    assert result.confidence == 0.0
    assert result.scores == {}
    assert encoder.calls == []


def test_question_is_stripped_before_the_model_sees_it() -> None:
    encoder = FakeEncoder({UNSETTLED: [QuestionIntent.HISTORY]})
    IntentClassifier(encoder=encoder).classify(f"  {UNSETTLED}  \n")
    assert encoder.query_calls == [[UNSETTLED]]


# --- degrading ---------------------------------------------------------------------


def test_encoder_error_at_query_time_degrades_to_keywords() -> None:
    encoder = FakeEncoder()
    classifier = IntentClassifier(encoder=encoder)
    classifier._ready()  # build the example index while the encoder works

    def broken(texts: Sequence[str]) -> list[list[float]]:
        raise RuntimeError("model crashed")

    classifier._encoder = broken
    result = classifier.classify(UNSETTLED)
    assert result.backend == "keywords"
    assert result.intent is QuestionIntent.GENERAL


def test_malformed_encoder_output_degrades_to_keywords() -> None:
    classifier = IntentClassifier(encoder=FakeEncoder())
    classifier._ready()
    classifier._encoder = lambda texts: [[1.0, 2.0]]  # wrong dimensionality
    assert classifier.classify(UNSETTLED).backend == "keywords"


def test_disabled_classifier_never_loads_a_model(monkeypatch: pytest.MonkeyPatch) -> None:
    def explode(model: str) -> Any:
        raise AssertionError("must not load")

    monkeypatch.setattr(intent_module, "build_distilbert_encoder", explode)
    classifier = IntentClassifier(enabled=False)
    assert classifier.backend == "keywords"
    assert classifier.classify(UNSETTLED).backend == "keywords"


def test_injected_encoder_wins_even_when_disabled() -> None:
    encoder = FakeEncoder({UNSETTLED: [QuestionIntent.HISTORY]})
    classifier = IntentClassifier(enabled=False, encoder=encoder)
    assert classifier.backend == "distilbert"
    assert classifier.classify(UNSETTLED).backend == "distilbert"


# --- lazy model loading ---------------------------------------------------------------


def test_model_loads_lazily_once_with_configured_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    built: list[str] = []
    encoder = FakeEncoder({UNSETTLED: [QuestionIntent.RATIONALE]})

    def factory(model: str) -> FakeEncoder:
        built.append(model)
        return encoder

    monkeypatch.setattr(intent_module, "build_distilbert_encoder", factory)
    classifier = IntentClassifier(model="some/model", enabled=True)
    assert built == []  # nothing loaded at construction
    classifier.classify("Who owns it?")  # settled by keywords: still nothing loaded
    assert built == []

    classifier.classify(UNSETTLED)
    classifier.classify(UNSETTLED)
    assert built == ["some/model"]
    assert classifier.backend == "distilbert"


def test_concurrent_first_use_loads_the_model_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    built: list[int] = []
    gate = threading.Event()

    def factory(model: str) -> FakeEncoder:
        gate.wait(timeout=1)
        built.append(1)
        return FakeEncoder()

    monkeypatch.setattr(intent_module, "build_distilbert_encoder", factory)
    classifier = IntentClassifier(enabled=True)
    threads = [threading.Thread(target=classifier.classify, args=(UNSETTLED,)) for _ in range(8)]
    for thread in threads:
        thread.start()
    gate.set()
    for thread in threads:
        thread.join()
    assert len(built) == 1


def test_load_failure_falls_back_and_is_not_retried(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    attempts: list[int] = []

    def factory(model: str) -> Any:
        attempts.append(1)
        raise OSError("model not found")

    monkeypatch.setattr(intent_module, "build_distilbert_encoder", factory)
    classifier = IntentClassifier(enabled=True)
    with caplog.at_level(logging.WARNING, logger="whycode.nlp"):
        first = classifier.classify(UNSETTLED)
        second = classifier.classify("Tell me more")
    assert first.backend == second.backend == "keywords"
    assert classifier.backend == "keywords"
    assert len(attempts) == 1
    assert sum("DistilBERT unavailable" in r.message for r in caplog.records) == 1


def test_missing_libraries_fall_back_to_keywords(monkeypatch: pytest.MonkeyPatch) -> None:
    # A None entry in sys.modules makes the import raise.
    monkeypatch.setitem(sys.modules, "torch", None)
    monkeypatch.setitem(sys.modules, "transformers", None)
    classifier = IntentClassifier(enabled=True)
    assert classifier.classify(UNSETTLED).backend == "keywords"
    assert classifier.classify("When was this changed?").intent is QuestionIntent.HISTORY


# --- configuration --------------------------------------------------------------------


def test_env_switch_disables(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WHYCODE_NLP_ENABLED", "0")
    assert IntentClassifier().enabled is False


@pytest.mark.parametrize("raw", ["0", "false", "No", " OFF "])
def test_env_values_that_disable(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    monkeypatch.setenv("WHYCODE_NLP_ENABLED", raw)
    assert IntentClassifier().enabled is False


@pytest.mark.parametrize("raw", ["1", "true", "YES", "on"])
def test_env_values_that_enable(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    monkeypatch.setenv("WHYCODE_NLP_ENABLED", raw)
    assert IntentClassifier().enabled is True


@pytest.mark.parametrize("installed", [True, False])
def test_unset_env_follows_whether_transformers_is_installed(
    monkeypatch: pytest.MonkeyPatch, installed: bool
) -> None:
    monkeypatch.delenv("WHYCODE_NLP_ENABLED", raising=False)
    monkeypatch.setattr(
        importlib.util, "find_spec", lambda name: object() if installed else None
    )
    assert IntentClassifier().enabled is installed


def test_explicit_enabled_overrides_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WHYCODE_NLP_ENABLED", "0")
    assert IntentClassifier(enabled=True).enabled is True


def test_model_name_comes_from_env_then_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("WHYCODE_NLP_MODEL", raising=False)
    assert IntentClassifier(enabled=False).model == DEFAULT_MODEL
    monkeypatch.setenv("WHYCODE_NLP_MODEL", "org/other-model")
    assert IntentClassifier(enabled=False).model == "org/other-model"
    assert IntentClassifier(model="explicit/model", enabled=False).model == "explicit/model"


def test_default_classifier_is_shared() -> None:
    default_classifier.cache_clear()
    try:
        assert default_classifier() is default_classifier()
    finally:
        default_classifier.cache_clear()


def test_every_intent_except_general_has_distinct_examples() -> None:
    assert set(EXAMPLES) == set(AXES)
    texts = [text for texts in EXAMPLES.values() for text in texts]
    assert len(texts) == len(set(texts))
    assert all(len(EXAMPLES[intent]) >= 3 for intent in AXES)
