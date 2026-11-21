"""PR citations in a live answer must carry the real GitHub author.

The contributor card in the UI is built from the evidence of the answer
itself, so the evidence pool's PR view has to carry the author's login,
avatar and the PR's title/date — taken from the PR data fetched for the
question, never from the model's text. And under the evidence-bound
answering flow, a citation that does not resolve to the fetched pool
refuses the answer instead of borrowing an author from anywhere else.
"""

import json

import pytest

from app.retrieval.live_service import LiveService
from app.retrieval.models import AskParameters


@pytest.fixture(autouse=True)
def _no_proxy_env(monkeypatch: pytest.MonkeyPatch) -> None:
    # httpx.Client reads proxy variables from the environment at
    # construction; the sandbox's proxy address is not a valid URL
    # for it. Same fixture as test_live_people_stats.py.
    for name in (
        "http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
        "ALL_PROXY", "all_proxy", "no_proxy", "NO_PROXY",
    ):
        monkeypatch.delenv(name, raising=False)


PR_784 = {
    "number": 784,
    "title": "Drop environment proxies by default",
    "state": "closed",
    "body": "trust_env now defaults to False.",
    "created_at": "2026-01-04T10:00:00Z",
    "html_url": "https://github.com/encode/httpx/pull/784",
    "pull_request": {"url": "https://api.github.com/repos/encode/httpx/pulls/784"},
    "user": {
        "login": "lovelydinosaur",
        "avatar_url": "https://avatars.githubusercontent.com/u/1791837?v=4",
    },
}


class FakeGitHub:
    """The slice of the GitHub client answer_question uses."""

    def __init__(self, search_results):
        self._search_results = search_results

    def repo_info(self, repo):
        return {"description": "HTTP client", "default_branch": "master"}

    def search_issues_prs(self, repo, query, limit=4):
        return self._search_results

    def tree_files(self, repo):
        return ["httpx/_client.py", "httpx/_config.py"]

    def file_content(self, repo, path):
        return "class Client:\n    pass\n"


class FakeGenerator:
    def __init__(self, citations):
        self._citations = citations

    def complete(self, *, system, user, schema, schema_name):
        return json.dumps(
            {
                "answer_status": "answered",
                "answer": "Because the PR changed the default.",
                "citations": self._citations,
                "caveats": [],
            }
        )


BOTH_CITATIONS = [
    "PR #784: Drop environment proxies by default",
    "httpx/_client.py: Client lifecycle",
]


def make_service(fake_gh: FakeGitHub) -> LiveService:
    service = LiveService(github_token="<redacted>")
    service.gh = fake_gh
    return service


def ask(service: LiveService, citations=BOTH_CITATIONS):
    return service.answer_question(
        AskParameters(question="Why does the client ignore env proxies?", repo="encode/httpx"),
        generator=FakeGenerator(citations),
    )


def test_cited_pr_carries_the_real_author_from_the_fetched_pool():
    response = ask(make_service(FakeGitHub([PR_784])))
    ev = next(ev for ev in response.evidence if ev.kind == "pull_request")
    assert ev.author == "lovelydinosaur"
    assert ev.author_avatar_url == "https://avatars.githubusercontent.com/u/1791837?v=4"
    assert ev.title == "Drop environment proxies by default"
    assert ev.created_at == "2026-01-04T10:00:00Z"
    assert ev.url == "https://github.com/encode/httpx/pull/784"
    assert ev.pr_number == 784


def test_unfetched_pr_citation_is_dropped_not_invented():
    # The generator cites PR #784 but the search fetched nothing: the
    # citation resolves to no pool evidence, so it is dropped — the
    # answer stands on the file citation alone, with no PR evidence
    # and no author borrowed from a side fetch or invented.
    response = ask(make_service(FakeGitHub([])))
    assert all(ev.kind != "pull_request" for ev in response.evidence)
    assert all(ev.author != "lovelydinosaur" for ev in response.evidence)
    assert response.citation_valid is False


def test_answer_citing_only_unfetched_evidence_refuses():
    # When nothing the draft cited was actually fetched, the whole
    # answer is refused rather than shown ungrounded.
    response = ask(
        make_service(FakeGitHub([])),
        citations=["PR #784: Drop environment proxies by default"],
    )
    assert response.answer_status.value == "insufficient_evidence"
    assert response.evidence == []
