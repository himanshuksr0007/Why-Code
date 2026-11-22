"""PR citations in a live answer must carry the real GitHub author.

The contributor card in the UI is built from the evidence of the answer
itself, so a cited PR's evidence view has to carry the author's login,
avatar and the PR's title/date — taken from the PR data fetched for the
question (or one direct fetch), never from the model's text. When
GitHub does not answer, the author stays unknown rather than invented.
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
    "user": {
        "login": "lovelydinosaur",
        "avatar_url": "https://avatars.githubusercontent.com/u/1791837?v=4",
    },
}

PR_900 = {
    "number": 900,
    "title": "Tighten connection pool defaults",
    "state": "closed",
    "body": "",
    "created_at": "2026-02-01T10:00:00Z",
    "html_url": "https://github.com/encode/httpx/pull/900",
    "user": {
        "login": "florimondmanca",
        "avatar_url": "https://avatars.githubusercontent.com/u/17470392?v=4",
    },
}


class FakeGitHub:
    """The slice of the GitHub client answer_question uses."""

    def __init__(self, search_results, details=None):
        self._search_results = search_results
        self._details = details or {}
        self.detail_calls = []

    def repo_info(self, repo):
        return {"description": "HTTP client", "default_branch": "master"}

    def search_issues_prs(self, repo, query, limit=4):
        return self._search_results

    def tree_files(self, repo):
        return ["httpx/_client.py", "httpx/_config.py"]

    def file_content(self, repo, path):
        return "class Client:\n    pass\n"

    def pr_detail(self, repo, number):
        self.detail_calls.append(number)
        return self._details.get(number)


class FakeGenerator:
    def complete(self, *, system, user, schema, schema_name):
        return json.dumps(
            {
                "answer_status": "answered",
                "answer": "Because the PR changed the default.",
                "citations": [
                    "PR #784: Drop environment proxies by default",
                    "httpx/_client.py: Client lifecycle",
                ],
                "decisions": [],
                "graph_path": [],
                "caveats": [],
                "confidence": "high",
            }
        )


def make_service(fake_gh: FakeGitHub) -> LiveService:
    service = LiveService(github_token="<redacted>")
    service.gh = fake_gh
    return service


def ask(service: LiveService):
    return service.answer_question(
        AskParameters(question="Why does the client ignore env proxies?", repo="encode/httpx"),
        generator=FakeGenerator(),
    )


def pr_evidence(response):
    return next(ev for ev in response.evidence if ev.kind == "pull_request")


def test_cited_pr_carries_the_real_author_from_search_results():
    response = ask(make_service(FakeGitHub([PR_784])))
    ev = pr_evidence(response)
    assert ev.author == "lovelydinosaur"
    assert ev.author_avatar_url == "https://avatars.githubusercontent.com/u/1791837?v=4"
    assert ev.title == "Drop environment proxies by default"
    assert ev.created_at == "2026-01-04T10:00:00Z"
    assert ev.url == "https://github.com/encode/httpx/pull/784"
    assert ev.pr_number == 784


def test_cited_pr_outside_search_results_is_fetched_directly():
    gh = FakeGitHub([], details={784: PR_784})
    response = ask(make_service(gh))
    ev = pr_evidence(response)
    assert gh.detail_calls == [784]
    assert ev.author == "lovelydinosaur"
    assert ev.author_avatar_url is not None


def test_unfetchable_pr_keeps_an_honest_unknown_author():
    response = ask(make_service(FakeGitHub([])))
    ev = pr_evidence(response)
    assert ev.author == "maintainers"
    assert ev.author_avatar_url is None
    assert ev.title is None


LATEST_COMMIT = {
    "sha": "c1erk9",
    "commit": {"author": {"name": "Tom Christie", "date": "2026-01-20T09:30:00Z"}},
    "author": {
        "login": "tomchristie",
        "avatar_url": "https://avatars.githubusercontent.com/u/647359?v=4",
    },
}


class FakeGitHubWithCommits(FakeGitHub):
    """Adds the per-file latest-commit lookup the author enrichment uses."""

    def __init__(self, search_results, details=None, latest=None):
        super().__init__(search_results, details)
        self._latest = latest
        self.latest_calls = []

    def file_latest_commit(self, repo, path):
        self.latest_calls.append(path)
        return self._latest


def file_evidence(response):
    return next(ev for ev in response.evidence if ev.path == "httpx/_client.py")


def test_cited_file_gains_the_author_of_its_latest_commit():
    gh = FakeGitHubWithCommits([PR_784], latest=LATEST_COMMIT)
    response = ask(make_service(gh))
    ev = file_evidence(response)
    assert ev.author == "tomchristie"
    assert ev.author_avatar_url == "https://avatars.githubusercontent.com/u/647359?v=4"
    assert ev.commit_sha == "c1erk9"
    assert ev.created_at == "2026-01-20T09:30:00Z"


def test_file_author_stays_placeholder_when_github_does_not_answer():
    gh = FakeGitHubWithCommits([PR_784], latest=None)
    response = ask(make_service(gh))
    ev = file_evidence(response)
    assert ev.author == "maintainers"
    assert ev.author_avatar_url is None
