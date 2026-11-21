"""People stats honesty under GitHub search rate limits.

Production logs (2026-11-21) showed GitHub refusing every /search/*
call (403) while core REST calls succeeded — and person profiles
answering with wrong totals anyway: a refused lookup fell back to 0
or to the size of a fetched sample, presented as an exact total.

The contract now:
- search results are cached for a short TTL (the search budget is
  30 requests/minute; repeat views must not re-ask);
- a refused search call pauses ALL search calls for a cooldown, so a
  rate-limit window is not kept saturated by retries;
- a total GitHub did not answer is None (unknown) end to end, and
  never a fabricated 0 or sample size.
"""

from __future__ import annotations

import httpx
import pytest

from app.retrieval.live_service import LiveGitHubClient, LiveService

REPO = "encode/httpx"
LOGIN = "mnd999"


@pytest.fixture(autouse=True)
def _no_proxy_env(monkeypatch: pytest.MonkeyPatch) -> None:
    # httpx.Client reads proxy variables from the environment at
    # construction; ambient sandbox values must not leak into the
    # client under test (same guard as tests/models/test_models_api).
    for name in (
        "http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
        "ALL_PROXY", "all_proxy", "no_proxy", "NO_PROXY",
    ):
        monkeypatch.delenv(name, raising=False)


def _client(handler) -> LiveGitHubClient:
    gh = LiveGitHubClient("test-token")
    gh._client = httpx.Client(
        base_url="https://api.github.com",
        transport=httpx.MockTransport(handler),
    )
    return gh


def test_search_total_is_cached_within_the_ttl() -> None:
    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        return httpx.Response(200, json={"total_count": 42, "items": []})

    gh = _client(handler)
    assert gh.search_total(REPO, f"type:pr author:{LOGIN}") == 42
    assert gh.search_total(REPO, f"type:pr author:{LOGIN}") == 42
    assert len(requests) == 1


def test_a_refused_search_pauses_all_search_calls() -> None:
    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request.url.path)
        if request.url.path.startswith("/search/"):
            return httpx.Response(403, json={"message": "rate limited"})
        return httpx.Response(200, json={"login": LOGIN})

    gh = _client(handler)
    assert gh.search_total(REPO, f"type:pr author:{LOGIN}") is None
    assert len(requests) == 1
    # Different search, same story — and crucially, no new request is
    # fired while the cooldown runs.
    assert gh.search_total(REPO, f"type:pr reviewed-by:{LOGIN}") is None
    assert gh.search_commits_total(REPO, LOGIN) is None
    assert gh.search_items(REPO, f"commenter:{LOGIN}") == []
    assert len(requests) == 1
    # Core (non-search) calls are a separate budget and keep working.
    assert gh.user(LOGIN) == {"login": LOGIN}
    assert len(requests) == 2


class _StubGitHub:
    """The LiveService-facing GitHub surface, with search down."""

    def __init__(self, totals: dict[str, int | None]) -> None:
        self._totals = totals

    def contributors(self, repo: str, limit: int = 25) -> list[dict]:
        return [
            {"login": LOGIN, "id": 7, "avatar_url": "", "contributions": 60}
        ]

    def user(self, login: str) -> dict:
        return {"name": "Mark Dixon", "created_at": "2012-05-20T09:58:01Z"}

    def commits(self, repo: str, author: str | None = None, limit: int = 25) -> list:
        return []

    def pulls(self, repo: str, creator: str | None = None, limit: int = 15) -> list:
        return [
            {
                "number": 14038,
                "title": "Fix security checks",
                "html_url": f"https://github.com/{REPO}/pull/14038",
                "merged_at": None,
            }
        ]

    def search_total(self, repo: str, qualifiers: str) -> int | None:
        if "reviewed-by" in qualifiers:
            return self._totals["reviews"]
        if "commenter" in qualifiers:
            return self._totals["comments"]
        return self._totals["prs"]

    def search_commits_total(self, repo: str, login: str) -> int | None:
        return self._totals["commits"]

    def search_items(self, repo: str, qualifiers: str, limit: int = 10) -> list:
        return []


def _service(totals: dict[str, int | None]) -> LiveService:
    service = LiveService("test-token")
    service.gh = _StubGitHub(totals)  # type: ignore[assignment]
    return service


def test_profile_totals_are_none_when_search_does_not_answer() -> None:
    service = _service(
        {"prs": None, "reviews": None, "comments": None, "commits": None}
    )
    profile = service.get_person_profile(REPO, LOGIN)
    # Never a fabricated 0, never the sample size (the stub fetched
    # exactly one PR; 1 would be the old silent understatement).
    assert profile["authored_pull_requests"] is None
    assert profile["reviews"] is None
    assert profile["comments"] is None
    assert profile["commits"] is None
    # The fetched data itself is unaffected.
    assert [p["number"] for p in profile["authored"]] == [14038]


def test_profile_totals_pass_through_when_search_answers() -> None:
    service = _service({"prs": 545, "reviews": 455, "comments": 930, "commits": 712})
    profile = service.get_person_profile(REPO, LOGIN)
    assert profile["authored_pull_requests"] == 545
    assert profile["reviews"] == 455
    assert profile["comments"] == 930
    assert profile["commits"] == 712


def test_people_list_marks_unknown_stats_as_none() -> None:
    service = _service(
        {"prs": None, "reviews": None, "comments": None, "commits": None}
    )
    (person,) = service.get_people(REPO)
    assert person["authored_pull_requests"] is None
    assert person["reviews"] is None
    assert person["comments"] is None
    # The contributors API's own count is real data and stays.
    assert person["commits"] == 60
