"""PR miner: reasons come from PR text, precision rules hold, and PR
evidence merges into the record the commit miner makes for the same change."""

from __future__ import annotations

import json

import httpx
import pytest
import respx

from app.ledger.git import Commit
from app.ledger.miners import mine_commits
from app.ledger.models import Source, Verification
from app.ledger.pr_miner import (
    GRAPHQL_URL,
    PullRequestSource,
    mine_pull_requests,
    pr_number,
    reason_sentences,
    sentences,
)
from app.ledger.store import LedgerStore

REPO = "acme/http"
TRACKED = {"http/_config.py", "http/_client.py", "tests/test_config.py", "docs/index.md"}


def _commit(subject: str, files: list[str], body: str = "", sha: str = "a" * 40) -> Commit:
    return Commit(sha=sha, author="dev", date="2026-01-02T00:00:00+00:00",
                  subject=subject, body=body, files=files)


def _pr(number: int, title: str, body: str, **extra) -> dict:
    return {"number": number, "title": title, "body": body, "merged": True,
            "url": f"https://github.com/{REPO}/pull/{number}", "author": {"login": "dev"},
            "comments": {"nodes": []}, "reviews": {"nodes": []},
            "reviewThreads": {"nodes": []}, "closingIssuesReferences": {"nodes": []}, **extra}


TEMPLATE_BODY = """<!-- Thanks for contributing! -->
# Summary

I made zstd an optional extra to mimic the same option in urllib3.

```python
pip install http[zstd]
```

> quoted reply that says because of something else

# Checklist

- [x] I understand that this PR may be closed because reasons.
- [x] I've added a test.
"""


def test_pr_number_from_squash_and_merge_subjects() -> None:
    assert pr_number(_commit("Add zstd (#3139)", [])) == 3139
    assert pr_number(_commit("Merge pull request #12 from a/b", [])) == 12
    assert pr_number(_commit("Fixed #123 -- a Trac ticket", [])) is None


def test_template_checklist_code_and_quotes_are_removed() -> None:
    text = " ".join(sentences(TEMPLATE_BODY))
    assert "mimic the same option in urllib3" in text
    assert "Thanks for contributing" not in text
    assert "pip install" not in text
    assert "quoted reply" not in text
    assert "may be closed" not in text
    assert reason_sentences(TEMPLATE_BODY) == [
        "I made zstd an optional extra to mimic the same option in urllib3."
    ]


def test_reason_found_in_description_becomes_verified_evidence() -> None:
    commit = _commit("Add zstd decoding (#3139)", ["http/_config.py", "tests/test_config.py"])
    [d] = mine_pull_requests([commit], {3139: _pr(3139, "Add zstd decoding", TEMPLATE_BODY)},
                             REPO, TRACKED)
    assert d.source is Source.PULL_REQUEST
    assert d.scope == ["http/_config.py"]  # tests are never scope
    assert "mimic the same option in urllib3" in d.rationale
    pr_ev = [e for e in d.evidence if e.kind == "pull_request"]
    assert pr_ev[0].pr_number == 3139
    assert pr_ev[0].verification is Verification.VERIFIED
    assert any(e.kind == "commit" and e.commit_sha == commit.sha for e in d.evidence)


def test_no_reason_no_decision() -> None:
    commit = _commit("Tweak config (#5)", ["http/_config.py"])
    assert mine_pull_requests([commit], {5: _pr(5, "Tweak config", "Tweaks the config.")},
                              REPO, TRACKED) == []


def test_docs_only_change_is_skipped() -> None:
    commit = _commit("Sponsor placement (#7)", ["docs/index.md"])
    body = "We need a consistent approach to sponsors because of the redesign."
    assert mine_pull_requests([commit], {7: _pr(7, "Sponsor placement", body)}, REPO, TRACKED) == []


def test_mechanical_change_needs_a_strong_reason() -> None:
    commit = _commit("Move helpers to _client (#9)", ["http/_client.py"])
    weak = "Fixes the lint script due to the following error in CI output here."
    assert mine_pull_requests([commit], {9: _pr(9, "Move helpers to _client", weak)},
                              REPO, TRACKED) == []
    strong = "Moved them because they are only used by the client and nowhere else."
    assert len(mine_pull_requests([commit], {9: _pr(9, "Move helpers to _client", strong)},
                                  REPO, TRACKED)) == 1


def test_bot_prs_and_unmerged_prs_are_skipped() -> None:
    commit = _commit("Bump thing (#11)", ["http/_client.py"])
    body = "Upgrade to avoid a known vulnerability in the old release."
    bot = _pr(11, "Upgrade thing", body, author={"login": "dependabot[bot]"})
    assert mine_pull_requests([commit], {11: bot}, REPO, TRACKED) == []
    commit2 = _commit("Upgrade thing (#12)", ["http/_client.py"])
    open_pr = _pr(12, "Upgrade thing", body, merged=False)
    assert mine_pull_requests([commit2], {12: open_pr}, REPO, TRACKED) == []


def test_review_comments_are_used_when_the_description_is_silent() -> None:
    commit = _commit("Use compact JSON (#20)", ["http/_client.py"])
    pr = _pr(20, "Use compact JSON", "Changes the JSON encoder settings.",
             reviewThreads={"nodes": [{"comments": {"nodes": [
                 {"body": "We should use compact separators for smaller request bodies.",
                  "url": "https://github.com/acme/http/pull/20#r1", "author": {"login": "lead"}},
                 {"body": "Thanks, looks good because tests pass.", "url": None,
                  "author": {"login": "lead"}},
             ]}}]})
    [d] = mine_pull_requests([commit], {20: pr}, REPO, TRACKED)
    quotes = [e.quote for e in d.evidence if e.kind == "pull_request"]
    assert quotes == ["We should use compact separators for smaller request bodies."]
    assert d.evidence[0].author == "lead"
    assert d.confidence == 0.5  # from discussion, not the description


def test_pr_reason_merges_into_the_commit_record(tmp_path) -> None:
    store = LedgerStore(str(tmp_path / "ledger.db"))
    commit = _commit("Deprecate app= in favour of explicit transports (#3050)",
                     ["http/_client.py"], body="* Linting\n* Linting\n* Add CHANGELOG")
    body = "The rationale for this is described in the linked issue comment."
    [from_pr] = mine_pull_requests([commit], {3050: _pr(3050, commit.subject, body)},
                                   REPO, TRACKED)
    [from_commit] = mine_commits([commit], REPO, TRACKED)
    assert from_pr.decision_id == from_commit.decision_id
    # Either order ends as one record whose rationale is the PR's reason.
    store.upsert_mined(from_commit)
    assert store.upsert_mined(from_pr) == "merged"
    stored = store.get(from_pr.decision_id)
    assert stored is not None
    assert stored.rationale.startswith("The rationale for this")
    assert stored.source is Source.PULL_REQUEST
    assert len(store.list_decisions(REPO)) == 1


@respx.mock
def test_fetch_batches_and_caches(tmp_path) -> None:
    calls: list[str] = []

    def reply(request: httpx.Request) -> httpx.Response:
        query = json.loads(request.content)["query"]
        calls.append(query)
        assert request.headers["authorization"] == "Bearer tok"
        return httpx.Response(200, json={"data": {"repository": {
            "p1": _pr(1, "One", "Body one because of a reason here."),
            "p2": None,  # a number that is an issue, not a PR
        }}})

    respx.post(GRAPHQL_URL).mock(side_effect=reply)
    cache = tmp_path / "prs.json"
    source = PullRequestSource("tok", cache_path=cache)
    got = source.fetch(REPO, [1, 2])
    assert set(got) == {1}
    assert len(calls) == 1 and "p1: pullRequest(number: 1)" in calls[0]
    # Second run is served from the cache, misses included.
    again = PullRequestSource("tok", cache_path=cache).fetch(REPO, iter([1, 2]))
    assert set(again) == {1}
    assert len(calls) == 1


@respx.mock
def test_fetch_failure_degrades_to_no_prs(tmp_path) -> None:
    respx.post(GRAPHQL_URL).mock(return_value=httpx.Response(502))
    source = PullRequestSource("tok", cache_path=tmp_path / "prs.json")
    assert source.fetch(REPO, [1]) == {}
    assert source.errors


@pytest.mark.parametrize("slug", ["no-slash", 'evil"/x', "a/b c"])
def test_fetch_rejects_odd_slugs(slug) -> None:
    assert PullRequestSource("tok").fetch(slug, [1]) == {}


def test_description_quotes_are_kept_but_reply_quotes_are_not() -> None:
    body = "> We should use compact separators for smaller bodies.\n\nImplements the issue."
    assert reason_sentences(body, keep_quotes=True) == [
        "We should use compact separators for smaller bodies."
    ]
    assert reason_sentences(body) == []


def test_template_boilerplate_and_struck_text_are_ignored() -> None:
    template = "Typos may be raised as stand-alone pull requests, but otherwise discuss first."
    prs, commits = {}, []
    for n in (1, 2, 3):
        prs[n] = _pr(n, f"Change {n}", template)
        commits.append(_commit(f"Change {n} (#{n})", ["http/_client.py"], sha=str(n) * 40))
    prs[4] = _pr(4, "Change 4", template + "\n\nDone this way to avoid a second request.")
    commits.append(_commit("Change 4 (#4)", ["http/_client.py"], sha="4" * 40))
    mined = mine_pull_requests(commits, prs, REPO, TRACKED)
    assert [d.rationale for d in mined] == ["Done this way to avoid a second request."]
    struck = "~~This was wrong because of X.~~ Kept it simple to avoid extra state."
    assert reason_sentences(struck) == ["Kept it simple to avoid extra state."]
