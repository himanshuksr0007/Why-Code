"""Structure-graph tests: intent detection, tree building from
retrieved paths, and the demo /ask wiring."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_demo_app
from app.retrieval.models import (
    AnswerConfidence,
    AnswerStatus,
    AskResponse,
    EvidenceView,
)
from app.retrieval.structure import build_structure_graph, is_structure_question

REPO = "encode/httpx"


def test_intent_detection() -> None:
    assert is_structure_question("What is the structure of this repo?")
    assert is_structure_question("Show me the file tree")
    assert is_structure_question("How is the codebase organized?")
    assert is_structure_question("Give me the directory layout")
    assert not is_structure_question("Why are retries disabled by default?")
    assert not is_structure_question("Who decided the timeout default?")


def _response_with_paths(paths: list[str]) -> AskResponse:
    return AskResponse(
        answer_status=AnswerStatus.ANSWERED,
        answer="grounded",
        confidence=AnswerConfidence.HIGH,
        evidence=[
            EvidenceView(evidence_id=f"E{i}", kind="code", path=path)
            for i, path in enumerate(paths)
        ],
    )


def test_tree_building_nests_folders() -> None:
    graph = build_structure_graph(
        "himanshuksr0007/Why-Code",
        _response_with_paths(
            ["backend/app/main.py", "backend/app/retrieval/plan.py", "frontend/src/app/page.tsx"]
        ),
    )
    assert graph is not None
    labels = {node.id: (node.label, node.kind) for node in graph.nodes}
    assert labels["repo:root"][1] == "repo"
    assert labels["path:backend"] == ("backend/", "folder")
    assert labels["path:backend/app"] == ("app/", "folder")
    assert labels["path:backend/app/main.py"] == ("main.py", "file")
    assert labels["path:frontend/src/app/page.tsx"] == ("page.tsx", "file")
    edges = {(e.source, e.target) for e in graph.edges}
    assert ("repo:root", "path:backend") in edges
    assert ("path:backend", "path:backend/app") in edges
    assert ("path:backend/app", "path:backend/app/main.py") in edges
    assert all(e.rel_type == "contains" for e in graph.edges)


def test_tree_needs_two_paths() -> None:
    assert build_structure_graph(REPO, _response_with_paths(["only/one.py"])) is None
    assert build_structure_graph(REPO, _response_with_paths([])) is None


def test_demo_structure_question_gets_tree() -> None:
    client = TestClient(create_demo_app())
    response = client.post(
        "/api/v1/ask",
        json={
            "question": "What is the structure of this repository?",
            "repo": REPO,
            "include_graph_path": True,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    structure = payload["structure"]
    assert structure is not None
    labels = [node["label"] for node in structure["nodes"]]
    assert "httpx/" in labels
    assert "_config.py" in labels
    assert any(node["kind"] == "repo" for node in structure["nodes"])


def test_demo_ordinary_question_has_no_structure() -> None:
    client = TestClient(create_demo_app())
    response = client.post(
        "/api/v1/ask",
        json={"question": "Why are retries disabled by default in httpx?", "repo": REPO},
    )
    assert response.status_code == 200
    assert response.json()["structure"] is None
