"""Deterministic synthesis for the prepared demo questions.

The demo does not call an LLM, but it does not bypass the answer contract
either: it receives the same :class:`EvidencePack` as the production
synthesizer, emits an ordinary :class:`AnswerDraft` with ``[E#]`` citations,
and the service still runs :class:`CitationValidator` over the result.

Sentences are written to be short and defensible. Specific details (PR
numbers, file names) appear only in sentences that cite evidence carrying
them, so the validator's fabricated-detail check remains meaningful.
"""

from __future__ import annotations

from collections.abc import Sequence

from app.retrieval.config import RetrievalConfig
from app.retrieval.context.evidence_packer import EvidencePack
from app.retrieval.demo.data import (
    QUESTION_1,
    QUESTION_2,
    QUESTION_3,
    QUESTION_4,
)
from app.retrieval.models import (
    AnswerConfidence,
    AnswerDraft,
    AnswerStatus,
    QuestionUnderstanding,
)

TransportFile = "httpx:pr:2311:file:docs/advanced.md"
TransportCode = "httpx:code:transports-default"
TransportReview = "httpx:review_comment:482022169"
TransportDoc = "httpx:doc:transports-retries"

ClientFile = "httpx:pr:1196:file:httpx/_client.py"
ClientPR = "httpx:pr:1196"
ClientTransportComment = "httpx:issue_comment:690148589"
ClientCloseComment = "httpx:issue_comment:706500230"

TimeoutPool = "httpx:pr:7:file:httpcore/pool.py"
TimeoutSplit = "httpx:pr:104:file:http3/concurrency.py"
TimeoutDocsPR = "httpx:pr:476:file:docs/advanced.md"
TimeoutReview = "httpx:review_comment:334299780"
TimeoutCode = "httpx:code:timeout-config"
TimeoutDoc = "httpx:doc:timeouts"

_INSUFFICIENT = (
    "I cannot find a defensible decision trail for this in the ingested "
    "repository history."
)


class DemoSynthesizer:
    def __init__(self, config: RetrievalConfig | None = None) -> None:
        self.config = config or RetrievalConfig()

    def synthesize(
        self,
        *,
        pack: EvidencePack,
        understanding: QuestionUnderstanding,
        strict: bool = False,
    ) -> AnswerDraft:
        del strict
        if not pack.decisions or not pack.evidence:
            return AnswerDraft(
                answer_status=AnswerStatus.INSUFFICIENT_EVIDENCE,
                answer=_INSUFFICIENT,
                citations=[],
                caveats=[],
                confidence=AnswerConfidence.NONE,
            )

        question = " ".join(understanding.question.casefold().split())
        if question == QUESTION_1.casefold():
            draft = _q1(pack)
        elif question == QUESTION_2.casefold():
            draft = _q2(pack)
        elif question == QUESTION_3.casefold():
            draft = _q3(pack)
        elif question == QUESTION_4.casefold():
            draft = _q4(pack)
        else:
            draft = None
        return draft or _generic(pack)


def _q1(pack: EvidencePack) -> AnswerDraft | None:
    return _compose(
        pack,
        [
            (
                "Retries are opt-in and disabled by default on the transport.",
                (TransportFile, TransportCode),
            ),
            (
                "The current source snapshot in "
                "`httpx/_transports/default.py` shows that HTTPTransport "
                "passes its retries value to the connection pool, with a "
                "default of zero.",
                (TransportCode, TransportFile),
            ),
            (
                "The documentation describes connection retries as an "
                "advanced transport option, not as automatic client behavior.",
                (TransportDoc, TransportFile),
            ),
            (
                "Only connect errors are retried; read and write failures are "
                "left to general-purpose retry tools.",
                (TransportDoc, TransportReview),
            ),
        ],
    )


def _q2(pack: EvidencePack) -> AnswerDraft | None:
    return _compose(
        pack,
        [
            (
                "A connect failure is safe to retry because the request never "
                "reached the server.",
                (TransportReview,),
            ),
            (
                "The original review on `httpx/_client.py` records that "
                "reasoning.",
                (TransportReview,),
            ),
            (
                "A read or write failure may already have produced side "
                "effects, so HTTPX does not retry a potentially "
                "non-idempotent request automatically.",
                (TransportDoc, TransportReview),
            ),
            (
                "The current code exposes retries on HTTPTransport and "
                "defaults the count to zero.",
                (TransportCode, TransportFile),
            ),
            (
                "Callers who need read or write retries are pointed at "
                "general-purpose tools.",
                (TransportDoc,),
            ),
        ],
    )


def _q3(pack: EvidencePack) -> AnswerDraft | None:
    return _compose(
        pack,
        [
            (
                "The retry approach was revised: client-level connect retries "
                "were proposed, then moved to the transport layer.",
                (ClientPR, ClientTransportComment),
            ),
            (
                "PR #1196 added an opt-in retries argument to Client.",
                (ClientFile, ClientPR),
            ),
            (
                "A review concluded that retries belong on the transport "
                "layer, closer to the connection.",
                (ClientTransportComment,),
            ),
            (
                "The client-level proposal was closed in favor of an httpcore "
                "change.",
                (ClientCloseComment,),
            ),
            (
                "The current implementation keeps retries on HTTPTransport, "
                "where the default is zero.",
                (TransportCode, TransportFile),
            ),
            (
                "The current documentation limits transport retries to connect "
                "errors.",
                (TransportDoc, TransportFile),
            ),
            (
                "That makes the transport-level decision current and the "
                "client-level decision historical.",
                (ClientTransportComment, TransportFile),
            ),
        ],
    )


def _q4(pack: EvidencePack) -> AnswerDraft | None:
    return _compose(
        pack,
        [
            (
                "The timeout split lives in `httpx/_config.py`, where the "
                "current Timeout class has one field per phase.",
                (TimeoutCode,),
            ),
            (
                "The client uses separate connect, read, write, and pool "
                "timeouts because each phase can fail independently.",
                (TimeoutCode, TimeoutDocsPR),
            ),
            (
                "A connect timeout means the connection to the host was never "
                "established.",
                (TimeoutReview,),
            ),
            (
                "A write timeout means sending request data stalled, and a "
                "read timeout means receiving response data stalled.",
                (TimeoutDocsPR, TimeoutDoc),
            ),
            (
                "A pool timeout means the client waited too long for a free "
                "connection.",
                (TimeoutPool, TimeoutDoc),
            ),
            (
                "The documentation lists connect, read, write, and pool "
                "timeouts as distinct failure modes.",
                (TimeoutDoc, TimeoutDocsPR),
            ),
        ],
    )


def _compose(
    pack: EvidencePack,
    parts: Sequence[tuple[str, Sequence[str]]],
) -> AnswerDraft | None:
    sentences: list[str] = []
    citations: list[str] = []
    for sentence, evidence_ids in parts:
        aliases: list[str] = []
        for evidence_id in evidence_ids:
            alias = pack.alias_for(evidence_id)
            if alias is None or alias in aliases:
                continue
            aliases.append(alias)
        if not aliases:
            continue
        citations.extend(alias for alias in aliases if alias not in citations)
        rendered = " ".join(f"[{alias}]" for alias in aliases)
        sentences.append(_with_citations(sentence, rendered))
    if not sentences:
        return None
    return AnswerDraft(
        answer_status=AnswerStatus.ANSWERED,
        answer=" ".join(sentences),
        citations=citations,
        caveats=[],
        confidence=(
            AnswerConfidence.HIGH
            if len(citations) >= 2
            else AnswerConfidence.MEDIUM
        ),
    )


def _with_citations(sentence: str, rendered: str) -> str:
    """Keep citations inside the sentence they support.

    The validator splits on sentence boundaries. Appending ``[E1]`` after the
    final period would attach it to the next sentence instead.
    """

    text = sentence.strip()
    if text.endswith((".", "!", "?")):
        return f"{text[:-1]} {rendered}{text[-1]}"
    return f"{text} {rendered}"


def _generic(pack: EvidencePack) -> AnswerDraft:
    """A conservative answer for a supported but unprepped question.

    The prepared demo route only accepts the script, so this is a safety net
    rather than a second demo path. It states no detail the pack cannot
    support.
    """

    item = pack.evidence[0]
    alias = pack.alias_for(item.evidence_id)
    if alias is None:
        return AnswerDraft(
            answer_status=AnswerStatus.INSUFFICIENT_EVIDENCE,
            answer=_INSUFFICIENT,
            citations=[],
            caveats=[],
            confidence=AnswerConfidence.NONE,
        )
    label = item.kind.replace("_", " ")
    return AnswerDraft(
        answer_status=AnswerStatus.ANSWERED,
        answer=(
            "The graph record is supported by selected "
            f"{label} evidence [{alias}]."
        ),
        citations=[alias],
        caveats=["The demo has a prepared answer only for the scripted questions."],
        confidence=AnswerConfidence.MEDIUM,
    )


__all__ = ["DemoSynthesizer"]
