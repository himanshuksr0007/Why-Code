"""The prepared demo corpus, grounded in real ``encode/httpx`` records.

This is still fixture data: the pipeline must run offline and byte-identically.
The difference from a synthetic fixture is that every evidence URL, author,
date and excerpt here points at a real GitHub record that actually supports the
claim it is attached to. The demo never calls GitHub at runtime.

The retry story is deliberately not the old invented "PR #1525 reverted
retries" story. The real history is stronger:

* connect retries were proposed on the client (PR #1196);
* maintainers moved the behavior to the transport layer;
* the current transport retries are opt-in and only cover connect failures;
* the timeout phases were introduced by separate merged PRs in 2019.

Nothing in this module performs I/O or reads the clock.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.retrieval.models import (
    AnswerConfidence,
    AnswerStatus,
    DecisionCandidate,
    DecisionState,
    EvidenceItem,
    GraphContext,
    RefusalMode,
)
from app.retrieval.question.entity_extractor import EntityIndex, KnownEntity
from app.retrieval.question.models import EntityType

DEMO_REPO = "encode/httpx"

# Decisions are ordered current-first. The in-memory backend uses this order as
# the tie-break for identifiers that govern more than one node.
TRANSPORT_RETRIES = "dec_httpx_retry_transport"
CLIENT_RETRIES = "dec_httpx_retry_client"
TIMEOUT_PHASES = "dec_httpx_timeout_phases"

QUESTION_1 = "Why are retries disabled by default in httpx?"
QUESTION_2 = "Why are simple retries limited to connection failures?"
QUESTION_3 = "Was the retry approach ever revised or reversed?"
QUESTION_4 = "Why does the client use separate connect, read, write, and pool timeouts?"
QUESTION_5 = "Why does httpx use a purple logo?"


@dataclass(frozen=True)
class DemoQuestionSpec:
    question_id: str
    question: str
    focus: str
    expectation: str
    expected_status: AnswerStatus
    expected_decision_id: str | None = None
    expected_refusal_mode: RefusalMode | None = None
    expects_historical: bool = False


DEMO_SCRIPT: tuple[DemoQuestionSpec, ...] = (
    DemoQuestionSpec(
        question_id="q1",
        question=QUESTION_1,
        focus="Active decision, source evidence, people and graph path",
        expectation=(
            "A cited answer explains that retries are opt-in, live on the "
            "transport, and default to zero; it shows the source snapshot, "
            "the supporting PR and the people behind it."
        ),
        expected_status=AnswerStatus.ANSWERED,
        expected_decision_id=TRANSPORT_RETRIES,
    ),
    DemoQuestionSpec(
        question_id="q2",
        question=QUESTION_2,
        focus="Why connect failures are safe to retry and read/write failures are not",
        expectation=(
            "The answer explains that a connect failure means the request "
            "never reached the server, while read and write failures may "
            "already have produced side effects."
        ),
        expected_status=AnswerStatus.ANSWERED,
        expected_decision_id=TRANSPORT_RETRIES,
    ),
    DemoQuestionSpec(
        question_id="q3",
        question=QUESTION_3,
        focus="Supersession: client-level proposal moved to the transport",
        expectation=(
            "The client-level retry proposal is labelled historical, and the "
            "current transport-level decision is presented as current truth."
        ),
        expected_status=AnswerStatus.ANSWERED,
        expected_decision_id=TRANSPORT_RETRIES,
        expects_historical=True,
    ),
    DemoQuestionSpec(
        question_id="q4",
        question=QUESTION_4,
        focus="A different subsystem and config-key path",
        expectation=(
            "The answer explains why the timeout phases are separate and "
            "follows the timeout config key through a different set of "
            "merged pull requests."
        ),
        expected_status=AnswerStatus.ANSWERED,
        expected_decision_id=TIMEOUT_PHASES,
    ),
    DemoQuestionSpec(
        question_id="q5",
        question=QUESTION_5,
        focus="Evidence-bounded refusal",
        expectation=(
            "The system refuses because no code entity or decision trail "
            "supports a question about the logo."
        ),
        expected_status=AnswerStatus.INSUFFICIENT_EVIDENCE,
        expected_refusal_mode=RefusalMode.NO_ENTITY,
    ),
)

SCRIPT_BY_QUESTION = {spec.question: spec for spec in DEMO_SCRIPT}


def build_entity_index() -> EntityIndex:
    """The allowlist the deterministic entity extractor may resolve.

    Aliases are chosen so the prepared questions resolve without a model:
    Q1 matches "retries disabled by default", Q2 matches "connection
    failures", Q3 matches "retry approach", Q4 matches "timeouts", and Q5
    matches nothing at all.
    """

    entities = [
        KnownEntity(
            type=EntityType.CONFIG_KEY,
            identifier="retries",
            aliases=(
                "retries disabled by default",
                "retry defaults",
                "connection failures",
                "connect failures",
                "connect errors",
                "retry",
                "retries",
            ),
            display_name="retries",
            path="httpx/_transports/default.py",
        ),
        KnownEntity(
            type=EntityType.CONFIG_KEY,
            identifier="timeout",
            aliases=(
                "timeouts",
                "pool timeout",
                "connect timeout",
                "read timeout",
                "write timeout",
            ),
            display_name="timeout",
            path="httpx/_config.py",
        ),
        KnownEntity(
            type=EntityType.SYMBOL,
            identifier="httpx._transports.default.HTTPTransport",
            aliases=(
                "HTTPTransport",
                "transport retries",
                "transport layer",
            ),
            display_name="HTTPTransport",
            path="httpx/_transports/default.py",
        ),
        KnownEntity(
            type=EntityType.SYMBOL,
            identifier="httpx._config.Timeout",
            aliases=("Timeout", "timeouts"),
            display_name="Timeout",
            path="httpx/_config.py",
        ),
        KnownEntity(
            type=EntityType.SYMBOL,
            identifier="httpx._client.Client",
            aliases=("client-level retries", "client retry proposal"),
            display_name="Client",
            path="httpx/_client.py",
        ),
        KnownEntity(
            type=EntityType.FILE,
            identifier="httpx/_transports/default.py",
            aliases=("_transports/default.py",),
            path="httpx/_transports/default.py",
        ),
        KnownEntity(
            type=EntityType.FILE,
            identifier="httpx/_config.py",
            aliases=("_config.py",),
            path="httpx/_config.py",
        ),
        KnownEntity(
            type=EntityType.FILE,
            identifier="httpx/_client.py",
            aliases=("_client.py",),
            path="httpx/_client.py",
        ),
        KnownEntity(
            type=EntityType.DECISION,
            identifier=TRANSPORT_RETRIES,
            claim=(
                "Retries are opt-in, disabled by default, and limited to "
                "connection failures on the transport."
            ),
            status="active",
            pr_number=2311,
        ),
        KnownEntity(
            type=EntityType.DECISION,
            identifier=CLIENT_RETRIES,
            claim=(
                "The retry approach was revised: the client proposal moved "
                "to the transport layer."
            ),
            status="superseded",
            pr_number=1196,
        ),
        KnownEntity(
            type=EntityType.DECISION,
            identifier=TIMEOUT_PHASES,
            claim=(
                "Timeouts are split into connect, read, write, and pool "
                "phases because each phase can fail independently."
            ),
            status="active",
            pr_number=104,
        ),
    ]
    return EntityIndex(entities=entities)


def build_contexts() -> dict[str, GraphContext]:
    return {
        TRANSPORT_RETRIES: _transport_retries_context(),
        CLIENT_RETRIES: _client_retries_context(),
        TIMEOUT_PHASES: _timeout_context(),
    }


def _transport_retries_context() -> GraphContext:
    evidence = [
        _evidence(
            "httpx:pr:2311:file:docs/advanced.md",
            decision_id=TRANSPORT_RETRIES,
            kind="changed_file",
            excerpt=(
                "@@ -1093,7 +1093,7 @@ class directly, and pass it to the client instance.\n"
                " >>> client = httpx.Client(transport=transport)\n"
                " ```\n"
                " \n"
                "-Connection retries are also available via this interface.\n"
                "+Connection retries are also available via this interface. "
                "Requests will be retried the given number of times in case "
                "an `httpx.ConnectError` or an `httpx.ConnectTimeout` occurs, "
                "allowing smoother operation under flaky networks. If you need "
                "other forms of retry behaviors, such as handling read/write "
                "errors or reacting to `503 Service Unavailable`, consider "
                "general-purpose tools such as tenacity."
            ),
            author="florimondmanca",
            created_at="2022-07-29T12:21:59Z",
            url="https://github.com/encode/httpx/pull/2311/files",
            pr_number=2311,
            path="docs/advanced.md",
            start_line=1093,
            end_line=1095,
        ),
        _evidence(
            "httpx:code:transports-default",
            decision_id=TRANSPORT_RETRIES,
            kind="code_file",
            excerpt=(
                "class HTTPTransport(BaseTransport):\n"
                "    def __init__(\n"
                "        ...\n"
                "        retries: int = 0,\n"
                "    ) -> None:\n"
                "        ...\n"
                "        self._pool = httpcore.ConnectionPool(\n"
                "            ...\n"
                "            retries=retries,\n"
                "        )"
            ),
            author=None,
            created_at=None,
            url=(
                "https://github.com/encode/httpx/blob/master/"
                "httpx/_transports/default.py#L135-L166"
            ),
            path="httpx/_transports/default.py",
            start_line=135,
            end_line=166,
        ),
        _evidence(
            "httpx:review_comment:482022169",
            decision_id=TRANSPORT_RETRIES,
            kind="review_comment",
            excerpt=(
                "I don't think we need to care about idempotency for connect "
                "retries. If we've not established a connection to the server, "
                "then we're okay to re-issue the request whatever the method."
            ),
            author="lovelydinosaur",
            created_at="2020-09-02T12:16:13Z",
            url=(
                "https://github.com/encode/httpx/pull/1196"
                "#discussion_r482022169"
            ),
            pr_number=1196,
            path="httpx/_client.py",
            start_line=818,
            end_line=818,
        ),
        _evidence(
            "httpx:doc:transports-retries",
            decision_id=TRANSPORT_RETRIES,
            kind="doc_file",
            excerpt=(
                "Connection retries are also available via this interface. "
                "Requests will be retried the given number of times in case "
                "an `httpx.ConnectError` or an `httpx.ConnectTimeout` occurs, "
                "allowing smoother operation under flaky networks. If you need "
                "other forms of retry behaviors, such as handling read/write "
                "errors or reacting to `503 Service Unavailable`, consider "
                "general-purpose tools such as tenacity."
            ),
            author="florimondmanca",
            created_at="2022-07-29T12:21:59Z",
            url=(
                "https://github.com/encode/httpx/blob/master/"
                "docs/advanced/transports.md#L17"
            ),
            path="docs/advanced/transports.md",
            start_line=17,
            end_line=17,
        ),
    ]
    decision = DecisionCandidate(
        decision_id=TRANSPORT_RETRIES,
        claim=(
            "Retries are opt-in and disabled by default; only connection "
            "failures are retried on the transport."
        ),
        rationale=(
            "The default retry count is zero. Automatic retries are not safe "
            "for every request, so callers must enable connection retries "
            "explicitly on HTTPTransport. Read and write failures are left to "
            "general-purpose retry tools because the request may already have "
            "produced side effects."
        ),
        status=DecisionState.ACTIVE,
        confidence=AnswerConfidence.HIGH,
        target_ids=[
            "ConfigKey:retries",
            "Symbol:httpx._transports.default.HTTPTransport",
            "CodeRegion:httpx/_transports/default.py:135-166",
            "File:httpx/_transports/default.py",
        ],
        evidence_ids=[item.evidence_id for item in evidence],
        created_at="2022-07-29T12:21:59Z",
    )
    return GraphContext(
        decision=decision,
        evidence=evidence,
        targets=list(decision.target_ids),
        pull_requests=["PullRequest:#2311"],
        later_decisions=[],
        conflicts=[],
    )


def _client_retries_context() -> GraphContext:
    evidence = [
        _evidence(
            "httpx:pr:1196:file:httpx/_client.py",
            decision_id=CLIENT_RETRIES,
            kind="changed_file",
            excerpt=(
                "@@ -73,6 +80,7 @@ def __init__(\n"
                "         cookies: CookieTypes = None,\n"
                "         timeout: TimeoutTypes = DEFAULT_TIMEOUT_CONFIG,\n"
                "         max_redirects: int = DEFAULT_MAX_REDIRECTS,\n"
                "+        retries: int = DEFAULT_RETRIES,\n"
                "         base_url: URLTypes = \"\",\n"
                "         trust_env: bool = True,\n"
                "     ):"
            ),
            author="florimondmanca",
            created_at="2020-08-19",
            url="https://github.com/encode/httpx/pull/1196/files",
            pr_number=1196,
            path="httpx/_client.py",
            start_line=73,
            end_line=86,
        ),
        _evidence(
            "httpx:issue_comment:690148589",
            decision_id=CLIENT_RETRIES,
            kind="issue_comment",
            excerpt=(
                "I think we really do want this on the transport layer, "
                "wrapping as close to the connection as possible."
            ),
            author="lovelydinosaur",
            created_at="2020-09-10T10:45:13Z",
            url=(
                "https://github.com/encode/httpx/pull/1196"
                "#issuecomment-690148589"
            ),
            pr_number=1196,
        ),
        _evidence(
            "httpx:issue_comment:706500230",
            decision_id=CLIENT_RETRIES,
            kind="issue_comment",
            excerpt=(
                "Opened https://github.com/encode/httpcore/pull/221 against "
                "HTTPCore, closing this one for now!"
            ),
            author="florimondmanca",
            created_at="2020-10-10T06:56:10Z",
            url=(
                "https://github.com/encode/httpx/pull/1196"
                "#issuecomment-706500230"
            ),
            pr_number=1196,
        ),
        _evidence(
            "httpx:pr:1196",
            decision_id=CLIENT_RETRIES,
            kind="pull_request",
            excerpt=(
                "Adds off-by-default \"retry for connect errors\" behavior, "
                "used as `httpx.Client(..., retries=<int>)`. Makes sure that "
                "only `ConnectError`/`ConnectTimeout` are retried."
            ),
            author="florimondmanca",
            created_at="2020-08-19",
            url="https://github.com/encode/httpx/pull/1196",
            pr_number=1196,
        ),
    ]
    decision = DecisionCandidate(
        decision_id=CLIENT_RETRIES,
        claim=(
            "The retry approach was revised: the client proposal moved to "
            "the transport layer."
        ),
        rationale=(
            "The original proposal added an opt-in argument to the client. A "
            "review concluded that wrapping belongs on the transport layer, "
            "so the proposal was closed in favor of httpcore. The current "
            "decision keeps the behavior on HTTPTransport instead."
        ),
        status=DecisionState.SUPERSEDED,
        confidence=AnswerConfidence.MEDIUM,
        target_ids=[
            "ConfigKey:client.retries",
            "Symbol:httpx._client.Client",
            "CodeRegion:httpx/_client.py:80-95",
            "File:httpx/_client.py",
        ],
        evidence_ids=[item.evidence_id for item in evidence],
        superseded_by=TRANSPORT_RETRIES,
        created_at="2020-08-19",
    )
    return GraphContext(
        decision=decision,
        evidence=evidence,
        targets=list(decision.target_ids),
        pull_requests=["PullRequest:#1196"],
        later_decisions=[TRANSPORT_RETRIES],
        conflicts=[],
    )


def _timeout_context() -> GraphContext:
    evidence = [
        _evidence(
            "httpx:pr:7:file:httpcore/pool.py",
            decision_id=TIMEOUT_PHASES,
            kind="changed_file",
            excerpt=(
                "@@ -16,18 +16,23 @@\n"
                " from .datastructures import URL, Request, Response\n"
                "+from .exceptions import PoolTimeout\n"
                " \n"
                " class ConnectionSemaphore:\n"
                "-    def __init__(self, max_connections: int = None):\n"
                "+    def __init__(self, max_connections: int = None, timeout: float = None):\n"
                "+        self.timeout = timeout\n"
                " \n"
                "     async def acquire(self) -> None:\n"
                "         if hasattr(self, \"semaphore\"):\n"
                "-            await self.semaphore.acquire()\n"
                "+            try:\n"
                "+                await asyncio.wait_for(self.semaphore.acquire(), self.timeout)\n"
                "+            except asyncio.TimeoutError:\n"
                "+                raise PoolTimeout()"
            ),
            author="lovelydinosaur",
            created_at="2019-04-17T16:38:35Z",
            url="https://github.com/encode/httpx/pull/7/files",
            pr_number=7,
            path="httpcore/pool.py",
            start_line=16,
            end_line=40,
        ),
        _evidence(
            "httpx:pr:104:file:http3/concurrency.py",
            decision_id=TIMEOUT_PHASES,
            kind="changed_file",
            excerpt=(
                "@@ -49,6 +49,38 @@ def _fixed_write(self, data: bytes) -> None:\n"
                "+class TimeoutFlag:\n"
                "+    \"\"\"\n"
                "+    A timeout flag holds a state of either read-timeout or write-timeout mode.\n"
                "+    We use this so that we can attempt both reads and writes "
                "concurrently, while\n"
                "+    only enforcing timeouts in one direction.\n"
                "+    During a request/response cycle we start in write-timeout mode.\n"
                "+    Once we've sent a request fully, or once we start seeing a response,\n"
                "+    then we switch to read-timeout mode instead.\n"
                "+    \"\"\""
            ),
            author="lovelydinosaur",
            created_at="2019-06-25T11:54:14Z",
            url="https://github.com/encode/httpx/pull/104/files",
            pr_number=104,
            path="http3/concurrency.py",
            start_line=49,
            end_line=86,
        ),
        _evidence(
            "httpx:pr:476:file:docs/advanced.md",
            decision_id=TIMEOUT_PHASES,
            kind="changed_file",
            excerpt=(
                "@@ -162,3 +162,76 @@ client = httpx.Client(proxies=proxy)\n"
                "+## Timeout fine-tuning\n"
                "+HTTPX offers various request timeout management options. Three "
                "types of timeouts are available: **connect** timeouts,\n"
                "+**write** timeouts and **read** timeouts.\n"
                "+* The **connect timeout** specifies the maximum amount of time to "
                "wait until a connection to the requested host is established.\n"
                "+* The **write timeout** specifies the maximum duration to wait for "
                "a chunk of data to be sent (for example, a chunk of the request body).\n"
                "+* The **read timeout** specifies the maximum duration to wait for "
                "a chunk of data to be received (for example, a chunk of the response body)."
            ),
            author="mwoss",
            created_at="2019-10-16T16:27:46Z",
            url="https://github.com/encode/httpx/pull/476/files",
            pr_number=476,
            path="docs/advanced.md",
            start_line=162,
            end_line=238,
        ),
        _evidence(
            "httpx:review_comment:334299780",
            decision_id=TIMEOUT_PHASES,
            kind="review_comment",
            excerpt=(
                "The connect timeout specifies the maximum amount of time to "
                "wait until a connection to the requested host is established. "
                "If HTTPX is unable to connect within this time frame, a "
                "`ConnectTimeout` exception is raised."
            ),
            author="florimondmanca",
            created_at="2019-10-13T22:18:12Z",
            url=(
                "https://github.com/encode/httpx/pull/476"
                "#discussion_r334299780"
            ),
            pr_number=476,
            path="docs/advanced.md",
            start_line=171,
            end_line=171,
        ),
        _evidence(
            "httpx:code:timeout-config",
            decision_id=TIMEOUT_PHASES,
            kind="code_file",
            excerpt=(
                "class Timeout:\n"
                "    def __init__(\n"
                "        ...\n"
                "        connect: None | float | UnsetType = UNSET,\n"
                "        read: None | float | UnsetType = UNSET,\n"
                "        write: None | float | UnsetType = UNSET,\n"
                "        pool: None | float | UnsetType = UNSET,\n"
                "    ) -> None:"
            ),
            author=None,
            created_at=None,
            url=(
                "https://github.com/encode/httpx/blob/master/"
                "httpx/_config.py#L72-L110"
            ),
            path="httpx/_config.py",
            start_line=72,
            end_line=110,
        ),
        _evidence(
            "httpx:doc:timeouts",
            decision_id=TIMEOUT_PHASES,
            kind="doc_file",
            excerpt=(
                "There are four different types of timeouts that may occur. "
                "These are connect, read, write, and pool timeouts."
            ),
            author="florimondmanca",
            created_at="2019-10-16T16:27:46Z",
            url=(
                "https://github.com/encode/httpx/blob/master/"
                "docs/advanced/timeouts.md#L45"
            ),
            path="docs/advanced/timeouts.md",
            start_line=45,
            end_line=45,
        ),
    ]
    decision = DecisionCandidate(
        decision_id=TIMEOUT_PHASES,
        claim=(
            "Timeouts are split into connect, read, write, and pool phases "
            "because each phase can fail independently."
        ),
        rationale=(
            "A single timeout hides whether the client failed to connect, "
            "could not send the request, waited for the response, or waited "
            "for a pooled connection. Separate fields let callers distinguish "
            "those failures."
        ),
        status=DecisionState.ACTIVE,
        confidence=AnswerConfidence.HIGH,
        target_ids=[
            "ConfigKey:timeout",
            "Symbol:httpx._config.Timeout",
            "CodeRegion:httpx/_config.py:72-110",
            "File:httpx/_config.py",
        ],
        evidence_ids=[item.evidence_id for item in evidence],
        created_at="2019-10-16T16:27:46Z",
    )
    return GraphContext(
        decision=decision,
        evidence=evidence,
        targets=list(decision.target_ids),
        pull_requests=["PullRequest:#104"],
        later_decisions=[],
        conflicts=[],
    )


def _evidence(
    evidence_id: str,
    *,
    decision_id: str,
    kind: str,
    excerpt: str,
    author: str | None,
    created_at: str | None,
    url: str | None,
    pr_number: int | None = None,
    issue_number: int | None = None,
    commit_sha: str | None = None,
    path: str | None = None,
    start_line: int | None = None,
    end_line: int | None = None,
) -> EvidenceItem:
    return EvidenceItem(
        evidence_id=evidence_id,
        kind=kind,
        excerpt=excerpt,
        url=url,
        decision_id=decision_id,
        pr_number=pr_number,
        issue_number=issue_number,
        commit_sha=commit_sha,
        author=author,
        created_at=created_at,
        path=path,
        start_line=start_line,
        end_line=end_line,
    )


__all__ = [
    "CLIENT_RETRIES",
    "DEMO_REPO",
    "DEMO_SCRIPT",
    "QUESTION_1",
    "QUESTION_2",
    "QUESTION_3",
    "QUESTION_4",
    "QUESTION_5",
    "SCRIPT_BY_QUESTION",
    "TIMEOUT_PHASES",
    "TRANSPORT_RETRIES",
    "DemoQuestionSpec",
    "build_contexts",
    "build_entity_index",
]
