"""Plan-mode contracts.

A plan is built from a finished answer's own retrieval: decisions the
graph already holds become ``done`` steps citing real evidence, the rest
is scaffolding that names the surfaced modules, and the graph is the
answer's real graph path rooted at the goal. These tests pin that the
plan never invents evidence and that why-mode responses stay plan-free.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import create_demo_app
from app.retrieval.api.schemas import AskRequest
from app.retrieval.demo.data import DEMO_REPO, QUESTION_1
from app.retrieval.models import (
    AnswerConfidence,
    AnswerStatus,
    AskMode,
    AskResponse,
    DecisionState,
    DecisionView,
    EvidenceView,
)
from app.retrieval.plan import build_plan


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    app = create_demo_app()
    with TestClient(app) as test_client:
        yield test_client


def _answered_response() -> AskResponse:
    return AskResponse(
        answer_status=AnswerStatus.ANSWERED,
        answer="Retries are opt-in.",
        confidence=AnswerConfidence.HIGH,
        decision_ids=["dec_retry"],
        evidence=[
            EvidenceView(
                evidence_id="httpx:pr:1525:file:httpx/_config.py",
                kind="changed_file",
                path="httpx/_config.py",
                excerpt="Transport retry defaults.",
            ),
            EvidenceView(
                evidence_id="httpx:pr:1525",
                kind="pull_request",
                excerpt="The retry pull request.",
            ),
        ],
        citations=["httpx:pr:1525:file:httpx/_config.py"],
        graph_path=[
            "ConfigKey:trust_env",
            "ChangedFile:httpx/_config.py",
            "PullRequest:1525",
            "Decision:dec_httpx_retry_default_off",
            "Evidence:httpx:pr:1525:file:httpx/_config.py",
        ],
        decisions=[
            DecisionView(
                decision_id="dec_httpx_retry_default_off",
                claim="Retries are disabled by default",
                rationale="Transports are explicit about side effects.",
                status=DecisionState.ACTIVE,
                confidence=AnswerConfidence.HIGH,
                target_ids=["ConfigKey:trust_env"],
                evidence_ids=["httpx:pr:1525:file:httpx/_config.py"],
            )
        ],
    )


def test_plan_marks_retrieved_decisions_done_with_their_evidence() -> None:
    plan = build_plan("How do I add automatic retries?", _answered_response())

    done = [step for step in plan.steps if step.status == "done"]
    assert len(done) == 1
    assert "Retries are disabled by default" in done[0].title
    assert done[0].evidence_ids == ["httpx:pr:1525:file:httpx/_config.py"]

    needed = [step for step in plan.steps if step.status == "needed"]
    assert needed, "a plan must say what is still to build"
    # Every evidence id the plan cites exists in the answer's evidence.
    known = {"httpx:pr:1525:file:httpx/_config.py", "httpx:pr:1525"}
    for step in plan.steps:
        assert set(step.evidence_ids) <= known


def test_plan_graph_is_the_real_path_rooted_at_the_goal() -> None:
    plan = build_plan("How do I add automatic retries?", _answered_response())

    assert plan.graph.nodes[0].kind == "feature"
    kinds = [node.kind for node in plan.graph.nodes]
    assert kinds == [
        "feature",
        "config",
        "file",
        "pr",
        "decision",
        "evidence",
    ]
    rels = {(edge.source, edge.target): edge.rel_type for edge in plan.graph.edges}
    assert rels[("n2", "n3")] == "decided in"
    assert rels[("n3", "n4")] == "supported by"
    assert ("goal", "n3") in rels  # the goal builds on the decision
    # Every edge endpoint is a real node.
    ids = {node.id for node in plan.graph.nodes}
    for edge in plan.graph.edges:
        assert edge.source in ids and edge.target in ids


def test_plan_for_a_refusal_is_honest_about_the_missing_base() -> None:
    response = AskResponse(
        answer_status=AnswerStatus.INSUFFICIENT_EVIDENCE,
        answer="No defensible evidence.",
        confidence=AnswerConfidence.NONE,
    )
    plan = build_plan("How do I add HTTP/3 retries?", response)

    assert all(step.status == "needed" for step in plan.steps)
    assert plan.steps[0].title == "Establish the evidence base"
    assert [node.kind for node in plan.graph.nodes] == ["feature"]


def test_ask_request_mode_defaults_to_why_and_validates() -> None:
    assert AskRequest(question="Why?").mode is AskMode.WHY
    assert AskRequest(question="Plan it", mode="plan").mode is AskMode.PLAN
    assert AskRequest(question="Plan it", mode="plan").parameters().mode is AskMode.PLAN
    with pytest.raises(ValueError):
        AskRequest(question="Plan it", mode="yolo")


def test_http_plan_mode_returns_a_plan_and_why_mode_does_not(
    client: TestClient,
) -> None:
    planned = client.post(
        "/api/v1/ask",
        json={"question": QUESTION_1, "repo": DEMO_REPO, "mode": "plan"},
    )
    assert planned.status_code == 200
    plan = planned.json()["plan"]
    assert plan is not None
    assert plan["goal"] == QUESTION_1
    assert any(step["status"] == "done" for step in plan["steps"])
    assert plan["graph"]["nodes"][0]["kind"] == "feature"
    assert len(plan["graph"]["edges"]) >= 2

    plain = client.post(
        "/api/v1/ask",
        json={"question": QUESTION_1, "repo": DEMO_REPO},
    )
    assert plain.status_code == 200
    assert plain.json()["plan"] is None
