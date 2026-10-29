"""The live changes feed must carry real commit data.

Regression coverage for the fabricated-stats bug: the feed used to
report +15/-5 for every commit and link every card to "PR #0". Now
the line stats and file come from the GitHub commit detail, a commit
whose message references a PR links to that pull request, and a
direct commit carries number 0 with the commit URL kept separate.
"""

from app.retrieval.live_service import LiveService

SHA_A = "a" * 40
SHA_B = "b" * 40


class FakeGitHub:
    def __init__(self) -> None:
        self.detail_calls = 0

    def commits(self, repo, author=None, limit=25):
        return [
            {
                "sha": SHA_A,
                "commit": {
                    "message": "Merge pull request #42 from feature/x\n\nbody",
                    "author": {"name": "Dev One", "date": "2026-01-01T00:00:00Z"},
                },
                "author": {"login": "devone", "avatar_url": ""},
            },
            {
                "sha": SHA_B,
                "commit": {
                    "message": "fix: pin snappy-java version",
                    "author": {"name": "Dev Two", "date": "2026-01-02T00:00:00Z"},
                },
                "author": {"login": "devtwo", "avatar_url": ""},
            },
        ]

    def commit_detail(self, repo, sha):
        self.detail_calls += 1
        if sha == SHA_A:
            return {
                "stats": {"additions": 120, "deletions": 30, "total": 150},
                "files": [
                    {"filename": "src/core.py", "status": "modified", "additions": 90, "deletions": 20},
                    {"filename": "src/util.py", "status": "added", "additions": 30, "deletions": 10},
                ],
            }
        return None  # GitHub did not answer for the second commit


def make_service() -> LiveService:
    service = LiveService(github_token="test-token")
    service.gh = FakeGitHub()
    return service


def test_changes_use_real_commit_stats_and_files():
    changes = make_service().get_changes("owner/repo", limit=2)
    first = changes[0]
    assert first["additions"] == 120
    assert first["deletions"] == 30
    assert first["path"] == "src/core.py"
    assert first["change_kind"] == "modified"
    assert first["files_changed"] == 2
    assert first["commit_sha"] == SHA_A
    assert first["commit_url"] == f"https://github.com/owner/repo/commit/{SHA_A}"


def test_referenced_pr_links_to_the_pull_request():
    changes = make_service().get_changes("owner/repo", limit=2)
    assert changes[0]["pr"]["number"] == 42
    assert changes[0]["pr"]["url"] == "https://github.com/owner/repo/pull/42"


def test_direct_commit_has_no_fabricated_stats_or_pr():
    changes = make_service().get_changes("owner/repo", limit=2)
    second = changes[1]
    assert second["pr"]["number"] == 0
    assert second["additions"] == 0
    assert second["deletions"] == 0
    assert second["files_changed"] is None
    assert second["commit_url"].endswith(f"/commit/{SHA_B}")


def test_commit_detail_is_cached():
    service = make_service()
    service.get_changes("owner/repo", limit=2)
    service.get_changes("owner/repo", limit=2)
    assert service.gh.detail_calls == 2
