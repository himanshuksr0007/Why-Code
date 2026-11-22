"""Question-intent detection: keyword rules plus few-shot DistilBERT.

Why-Code answers several kinds of question ("why is it like this?", "who
owns this?", "where does X happen?"). Knowing which kind was asked lets the
answer prompt (``app.retrieval.prompt``) pick a layout that reads well for
that question instead of one generic wall of text.

How a question is classified:

1. **Keyword rules** run first. When they find a clear signal ("who …",
   "where is …", "instead of …") that answer is used: on our labelled set
   they are right 21 times in 24 and cost nothing.
2. **DistilBERT** handles everything the rules cannot settle — questions
   phrased without trigger words. The question is embedded with DistilBERT
   (mean-pooled last hidden state of ``typeform/distilbert-base-uncased-mnli``
   by default) and compared by cosine similarity with a few labelled example
   questions per intent (``EXAMPLES``); the nearest examples vote. This
   few-shot approach needs no training run, and the examples are plain data
   anyone can extend.

Measured on hand-labelled httpx questions (none of them in ``EXAMPLES``):

* first 24 questions, before any rule tuning: keywords alone 21/24,
  DistilBERT alone 18/24, this hybrid 22/24. Zero-shot NLI classification
  with the same model scored 12/24 and was rejected.
* 12 held-out questions written after the rules were tuned: hybrid 10/12,
  keywords alone 9/12.
* ~35 ms per DistilBERT call on CPU; the model loads once per process.

DistilBERT is optional (``pip install -e '.[nlp]'``). Without it, or when
``WHYCODE_NLP_ENABLED=0``, the keyword result is returned. The intent only
shapes *presentation*; it never decides what is true, which evidence is
fetched, or whether an answer is refused.
"""

from __future__ import annotations

import logging
import math
import os
import re
import threading
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from functools import lru_cache

logger = logging.getLogger("whycode.nlp")

DEFAULT_MODEL = "typeform/distilbert-base-uncased-mnli"


class QuestionIntent(StrEnum):
    RATIONALE = "rationale"  # why is it like this?
    HISTORY = "history"  # what changed, when, was it reverted?
    OWNERSHIP = "ownership"  # who decided / who owns / who to ask
    BEHAVIOUR = "behaviour"  # how does it work / what does it do
    LOCATION = "location"  # where is X implemented / which file
    COMPARISON = "comparison"  # why A instead of B / trade-offs
    GENERAL = "general"  # anything else


@dataclass(frozen=True)
class IntentResult:
    intent: QuestionIntent
    confidence: float
    backend: str  # "distilbert" | "keywords"
    scores: dict[str, float]


# Keyword answers at or above this share of rule hits are trusted outright.
KEYWORD_TRUST = 0.5
# Nearest examples that vote, and the vote share below which the model's
# answer is too split to use (the question is then GENERAL).
TOP_K = 3
MIN_CONFIDENCE = 0.5

# Few-shot examples for DistilBERT. Generic on purpose (no httpx names), so
# they describe the *kind* of question rather than one repository.
EXAMPLES: dict[QuestionIntent, tuple[str, ...]] = {
    QuestionIntent.RATIONALE: (
        "Why is this function written this way?",
        "What was the motivation for this design?",
        "Why does the code do this?",
        "What is the reasoning behind disabling caching?",
        "Why is this setting off by default?",
        "What problem does this module solve?",
    ),
    QuestionIntent.HISTORY: (
        "When was this feature added?",
        "What changed in this file recently?",
        "Has this behaviour been reverted before?",
        "How did this API change between versions?",
        "Was this decision later superseded?",
        "What did this code look like originally?",
    ),
    QuestionIntent.OWNERSHIP: (
        "Who wrote this code?",
        "Who is the maintainer of this package?",
        "Which developer approved this change?",
        "Who can I talk to about the parser?",
        "Who made the decision to remove this?",
        "Which people worked on the scheduler?",
    ),
    QuestionIntent.BEHAVIOUR: (
        "How does the cache invalidation work?",
        "What happens when a request times out?",
        "Explain the request lifecycle.",
        "What does this class do?",
        "How is the response body decoded?",
        "Walk me through the login flow.",
    ),
    QuestionIntent.LOCATION: (
        "Where is the router defined?",
        "Which file contains the database models?",
        "In what module is logging configured?",
        "Where can I find the retry implementation?",
        "Where does input validation happen?",
        "Which directory holds the tests for the CLI?",
    ),
    QuestionIntent.COMPARISON: (
        "Why use Postgres instead of MySQL?",
        "Why was library A chosen over library B?",
        "What alternatives were considered for the queue?",
        "Why JSON rather than protobuf?",
        "What are the trade-offs of the sync API versus async?",
        "Why not use the standard library for this?",
    ),
}


# --- keyword rules ------------------------------------------------------------

_KEYWORD_RULES: tuple[tuple[QuestionIntent, tuple[str, ...]], ...] = (
    (
        QuestionIntent.COMPARISON,
        (r"\binstead of\b", r"\brather than\b", r"\bvs\.?\b", r"\bversus\b",
         # "why A over B" / "chosen over": "over" as a preference, not "over time"
         r"\b(why|chosen|chose|choose|picked?|prefer(red)?)\b.*\bover\b(?!\s+time)",
         r"\btrade-?offs?\b", r"\balternatives?\b"),
    ),
    (
        QuestionIntent.OWNERSHIP,
        (r"^\s*who\b", r"\bwho (owns|decided|wrote|added|reviewed|maintains)\b",
         r"\bmaintainers?\b", r"\bowners?\b", r"\bwhom?\b.*\bask\b",
         r"\bwhich (person|people|developers?|engineers?|team)\b"),
    ),
    (
        QuestionIntent.HISTORY,
        (r"(?<!happens )\bwhen\b", r"\bchanged?\b", r"\brevert(ed)?\b", r"\bhistory\b",
         r"\bused to\b", r"\bno longer\b", r"\bsuperseded\b", r"\boriginally\b",
         r"\bevolv(e|ed|ing)\b", r"\bover time\b"),
    ),
    (
        QuestionIntent.LOCATION,
        (r"^\s*where\b", r"\bwhich file\b", r"\bwhere (is|are|does)\b",
         r"\bimplemented\b", r"\bdefined\b", r"\blocated\b"),
    ),
    (
        QuestionIntent.BEHAVIOUR,
        (r"^\s*how\b", r"\bwhat does\b", r"\bhow does\b", r"\bexplain\b",
         r"\bwork(s|ing)?\b", r"\bwhat happens\b"),
    ),
    (QuestionIntent.RATIONALE, (r"\bwhy\b", r"\breason\b", r"\bpurpose\b", r"\brationale\b")),
)


def classify_with_keywords(question: str) -> IntentResult:
    """Deterministic rules. The family with the most hits wins; rule order
    breaks ties (comparison and ownership are the most specific)."""

    text = question.casefold()
    hits = {
        intent.value: float(sum(1 for pattern in patterns if re.search(pattern, text)))
        for intent, patterns in _KEYWORD_RULES
    }
    best_value = max(hits.values(), default=0.0)
    if best_value <= 0:
        return IntentResult(QuestionIntent.GENERAL, 0.0, "keywords", hits)
    total = sum(hits.values())
    for intent, _ in _KEYWORD_RULES:
        if hits[intent.value] == best_value:
            return IntentResult(intent, round(best_value / total, 3), "keywords", hits)
    raise AssertionError("unreachable")


# --- DistilBERT ---------------------------------------------------------------

# Turns texts into embedding vectors (one list of floats per text).
Encoder = Callable[[Sequence[str]], list[list[float]]]


def _normalise(vector: Sequence[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vector)) or 1.0
    return [x / norm for x in vector]


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=True))


def build_distilbert_encoder(model: str) -> Encoder:
    """Mean-pooled DistilBERT sentence embeddings (CPU, no gradients)."""

    import torch  # type: ignore[import-not-found]
    from transformers import AutoModel, AutoTokenizer  # type: ignore[import-not-found]
    from transformers.utils import logging as hf_logging  # type: ignore[import-not-found]

    # Loading an encoder from a classification checkpoint reports the unused
    # classifier head; that is expected, not an error.
    hf_logging.set_verbosity_error()
    tokenizer = AutoTokenizer.from_pretrained(model)
    network = AutoModel.from_pretrained(model).eval()

    def encode(texts: Sequence[str]) -> list[list[float]]:
        batch = tokenizer(list(texts), padding=True, truncation=True, return_tensors="pt")
        with torch.no_grad():
            hidden = network(**batch).last_hidden_state
        mask = batch["attention_mask"].unsqueeze(-1).float()
        pooled = (hidden * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
        return [list(map(float, row)) for row in pooled]

    return encode


class IntentClassifier:
    """Keyword rules first; few-shot DistilBERT for what they cannot settle.

    ``encoder`` may be injected (tests, or a pre-warmed instance); otherwise
    DistilBERT is loaded lazily on first need and shared by the process. A
    load failure is logged once and the keyword result is used from then
    on, so a missing model can never take the answer service down.
    """

    def __init__(
        self,
        *,
        model: str | None = None,
        enabled: bool | None = None,
        encoder: Encoder | None = None,
        examples: Mapping[QuestionIntent, Sequence[str]] | None = None,
    ) -> None:
        self.model = model or os.environ.get("WHYCODE_NLP_MODEL", DEFAULT_MODEL)
        self.enabled = _env_enabled() if enabled is None else enabled
        self.examples = examples or EXAMPLES
        self._encoder = encoder
        self._index: list[tuple[QuestionIntent, list[float]]] | None = None
        self._failed = False
        self._lock = threading.Lock()

    @property
    def backend(self) -> str:
        """Which backend handles questions the keyword rules cannot settle."""

        return "distilbert" if self._ready() is not None else "keywords"

    def classify(self, question: str) -> IntentResult:
        question = question.strip()
        if not question:
            return IntentResult(QuestionIntent.GENERAL, 0.0, "keywords", {})
        keywords = classify_with_keywords(question)
        if keywords.intent is not QuestionIntent.GENERAL and keywords.confidence >= KEYWORD_TRUST:
            return keywords
        ready = self._ready()
        if ready is None:
            return keywords
        encoder, index = ready
        try:
            return self._nearest(encoder, index, question)
        except Exception as exc:  # noqa: BLE001 - presentation only; degrade
            logger.warning("DistilBERT intent classification failed: %s", exc)
            return keywords

    def _nearest(
        self,
        encoder: Encoder,
        index: list[tuple[QuestionIntent, list[float]]],
        question: str,
    ) -> IntentResult:
        (vector,) = encoder([question])
        query = _normalise(vector)
        ranked = sorted(
            ((_cosine(query, example), intent) for intent, example in index),
            key=lambda pair: pair[0],
            reverse=True,
        )
        votes: dict[str, float] = {}
        for similarity, intent in ranked[:TOP_K]:
            votes[intent.value] = votes.get(intent.value, 0.0) + max(similarity, 0.0)
        total = sum(votes.values()) or 1.0
        scores = {name: round(value / total, 4) for name, value in votes.items()}
        winner, share = max(scores.items(), key=lambda item: item[1])
        intent = QuestionIntent(winner) if share >= MIN_CONFIDENCE else QuestionIntent.GENERAL
        return IntentResult(intent, share, "distilbert", scores)

    def _ready(self) -> tuple[Encoder, list[tuple[QuestionIntent, list[float]]]] | None:
        if self._encoder is None and (not self.enabled or self._failed):
            return None
        with self._lock:
            if self._index is not None and self._encoder is not None:
                return self._encoder, self._index
            if self._failed:
                return None
            try:
                if self._encoder is None:
                    self._encoder = build_distilbert_encoder(self.model)
                    logger.info("Loaded DistilBERT intent model %s", self.model)
                labels = [i for i, texts in self.examples.items() for _ in texts]
                texts = [t for ts in self.examples.values() for t in ts]
                vectors = self._encoder(texts)
                self._index = [
                    (label, _normalise(vec)) for label, vec in zip(labels, vectors, strict=True)
                ]
            except Exception as exc:  # noqa: BLE001 - optional dependency
                self._failed = True
                logger.warning(
                    "DistilBERT unavailable (%s); using keyword intent rules. "
                    "Install with: pip install -e '.[nlp]'",
                    exc,
                )
                return None
            return self._encoder, self._index


def _env_enabled() -> bool:
    """``WHYCODE_NLP_ENABLED``: 1/true forces on, 0/false off. Unset means
    on when ``transformers`` is installed (it only is via the nlp extra)."""

    raw = os.environ.get("WHYCODE_NLP_ENABLED", "").strip().casefold()
    if raw in {"0", "false", "no", "off"}:
        return False
    if raw in {"1", "true", "yes", "on"}:
        return True
    import importlib.util

    return importlib.util.find_spec("transformers") is not None


@lru_cache(maxsize=1)
def default_classifier() -> IntentClassifier:
    """The process-wide classifier, so the model loads at most once."""

    return IntentClassifier()


__all__ = [
    "DEFAULT_MODEL",
    "EXAMPLES",
    "IntentClassifier",
    "IntentResult",
    "QuestionIntent",
    "build_distilbert_encoder",
    "classify_with_keywords",
    "default_classifier",
]
