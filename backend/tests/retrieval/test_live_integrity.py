"""Integrity contract of the live answer path.

The model proposes text and aliases; it never supplies evidence, decisions,
graph paths, confidence or citation validity. Those are derived here from
what Why-Code actually fetched.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from app.ledger import LedgerStore
from app.ledger.indexer import index_repository
from app.retrieval.live_service import LiveService
from app.retrieval.models import AnswerConfidence, AnswerStatus, AskParameters

REPO = "acme/widget"


class FakeGitHub:
    def __init__(self) -> None:
        self.files = {
            "README.md": "# widget\nA widget client.",
            "widget/client.py": "class Client:\n    retries = 0  # no retries\n",
        }

    def repo_info(self, repo: str) -> dict[str, Any]:
        return {"description": "Widgets", "default_branch": "main"}

    def search_issues_prs(self, repo: str, query: str, limit: int = 5) -> list[dict[str, Any]]:
        return [
            {
                "number": 42,
                "title": "Disable retries by default",
                "body": "Retries duplicated non-idempotent requests.",
                "pull_request": {},
                "user": {"login": "alice"},
                "html_url": f"https://github.com/{repo}/pull/42",
            }
        ]

    def tree_files(self, repo: str) -> list[str]:
        return list(self.files)

    def file_content(self, repo: str, path: str) -> str | None:
        return self.files.get(path)


class FakeGenerator:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self.last_usage = None
        self.prompts: list[str] = []

    def complete(self, *, system: str, user: str, schema: dict, schema_name: str) -> str:
        self.prompts.append(user)
        return json.dumps(self.payload)


def _service(
    payload: dict[str, Any], ledger: LedgerStore | None = None
) -> tuple[LiveService, FakeGenerator]:
    generator = FakeGenerator(payload)
    service = LiveService(generator=generator)
    service.gh = FakeGitHub()  # type: ignore[assignment]
    service.ledger = ledger
    return service, generator


def _ask(service: LiveService):
    return service.answer_question(AskParameters(question="Why are retries disabled?", repo=REPO))


def _alias(prompt: str, label: str) -> str:
    for line in prompt.splitlines():
        if line.startswith("[E") and label in line:
            return line[1 : line.index("]")]
    raise AssertionError(f"{label} not in pool")


def test_citations_resolve_only_to_fetched_evidence() -> None:
    service, gen = _service({})
    # First call to learn the aliases the pool assigns.
    gen.payload = {"answer_status": "answered", "answer": "x", "citations": [], "caveats": []}
    _ask(service)
    pr = _alias(gen.prompts[0], "PR #42")
    src = _alias(gen.prompts[0], "widget/client.py")
    gen.payload = {
        "answer_status": "answered",
        "answer": f"Retries are off [{src}]. They duplicated requests [{pr}].",
        "citations": [src, pr],
        "caveats": [],
    }
    response = _ask(service)
    assert response.answer_status is AnswerStatus.ANSWERED
    assert response.citation_valid is True
    assert {e.path or e.pr_number for e in response.evidence} == {"widget/client.py", 42}
    pr_view = next(e for e in response.evidence if e.pr_number == 42)
    assert pr_view.author == "alice"  # real author, never a placeholder
    assert response.decisions == []  # no ledger: no decisions, never generated ones
    assert response.confidence is AnswerConfidence.MEDIUM


def test_invented_citation_is_dropped_and_lowers_confidence() -> None:
    service, gen = _service({})
    gen.payload = {"answer_status": "answered", "answer": "x", "citations": [], "caveats": []}
    _ask(service)
    src = _alias(gen.prompts[0], "widget/client.py")
    gen.payload = {
        "answer_status": "answered",
        "answer": f"Retries are off [{src}]. See [E99].",
        "citations": [src, "E99", "secret/file.py: made up"],
        "caveats": [],
    }
    response = _ask(service)
    assert response.citation_valid is False
    assert response.confidence is AnswerConfidence.LOW
    assert all(e.path != "secret/file.py" for e in response.evidence)
    assert any("E99" in c for c in response.caveats)


def test_grouped_and_labelled_citations_resolve() -> None:
    service, gen = _service({})
    gen.payload = {"answer_status": "answered", "answer": "x", "citations": [], "caveats": []}
    _ask(service)
    pr = _alias(gen.prompts[0], "PR #42")
    src = _alias(gen.prompts[0], "widget/client.py")
    # Inline "[E1, E2]" with no citations list: previously refused.
    gen.payload = {
        "answer_status": "answered",
        "answer": f"Retries are off because they duplicated requests [{src}, {pr}].",
        "citations": [],
        "caveats": [],
    }
    response = _ask(service)
    assert response.answer_status is AnswerStatus.ANSWERED
    assert {e.path or e.pr_number for e in response.evidence} == {"widget/client.py", 42}
    # "E1: path" in the citations list resolves by its alias.
    gen.payload = {
        "answer_status": "answered",
        "answer": "Retries are off.",
        "citations": [f"{src}: widget/client.py"],
        "caveats": [],
    }
    response = _ask(service)
    assert response.answer_status is AnswerStatus.ANSWERED
    assert response.citation_valid is True


def test_answer_with_no_resolvable_citation_is_refused() -> None:
    service, _ = _service(
        {
            "answer_status": "answered",
            "answer": "Because of reasons [E42].",
            "citations": ["httpx/_client.py: invented"],
            "caveats": [],
        }
    )
    response = _ask(service)
    assert response.answer_status is AnswerStatus.INSUFFICIENT_EVIDENCE
    assert response.evidence == []
    assert response.confidence is AnswerConfidence.NONE
    assert "reasons" not in response.answer


def test_model_cannot_supply_decisions_or_graph_path() -> None:
    service, gen = _service({})
    gen.payload = {"answer_status": "answered", "answer": "x", "citations": [], "caveats": []}
    _ask(service)
    src = _alias(gen.prompts[0], "widget/client.py")
    gen.payload = {
        "answer_status": "answered",
        "answer": f"Retries are off [{src}].",
        "citations": [src],
        "caveats": [],
        "decisions": [{"decision_id": "dec_fake", "title": "Invented"}],
        "graph_path": ["Decision:dec_fake"],
    }
    response = _ask(service)
    assert response.decisions == []
    assert "Decision:dec_fake" not in response.graph_path
    assert response.graph_path == ["File:widget/client.py"]


def _git(root: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)


@pytest.fixture
def indexed_ledger(tmp_path: Path) -> LedgerStore:
    root = tmp_path / "widget"
    (root / "widget").mkdir(parents=True)
    (root / "widget/client.py").write_text(
        "class Client:\n"
        "    # WHY: retries are off by default because retrying POSTs duplicated orders.\n"
        "    retries = 0\n"
    )
    _git(root, "init", "-q")
    _git(root, "-c", "user.name=t", "-c", "user.email=t@e", "add", ".")
    _git(root, "-c", "user.name=t", "-c", "user.email=t@e", "commit", "-qm", "init")
    store = LedgerStore()
    index_repository(root, store, repo=REPO)
    return store


def test_ledger_decisions_join_the_pool_with_verified_evidence(indexed_ledger: LedgerStore) -> None:
    service, gen = _service({}, ledger=indexed_ledger)
    gen.payload = {"answer_status": "answered", "answer": "x", "citations": [], "caveats": []}
    _ask(service)
    prompt = gen.prompts[0]
    assert "RECORDED DECISIONS" in prompt
    assert "background" in prompt
    pr = _alias(prompt, "PR #42")
    ledger_alias = [
        line[1 : line.index("]")] for line in prompt.splitlines() if line.startswith("[E")
    ][-1]
    gen.payload = {
        "answer_status": "answered",
        "answer": (
            f"Retries are off by default [{ledger_alias}]. "
            f"Retrying duplicated requests [{pr}]."
        ),
        "citations": [ledger_alias, pr],
        "decision_refs": ["D1"],
        "caveats": [],
    }
    response = _ask(service)
    assert response.answer_status is AnswerStatus.ANSWERED
    assert len(response.decisions) == 1
    decision = response.decisions[0]
    assert decision.decision_id.startswith("dec_")
    assert any(g.startswith("Decision:") for g in response.graph_path)
    assert response.confidence is AnswerConfidence.HIGH
