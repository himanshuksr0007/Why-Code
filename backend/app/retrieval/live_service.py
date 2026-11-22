"""Live GitHub and AI service for production mode.

Fetches real data from the GitHub REST API using WHYCODE_GITHUB_TOKEN and synthesizes
genuine architectural answers, decisions, and graph paths using the live LLM.
Drops all dummy / pre-made / canned responses.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from collections.abc import Iterator
from typing import Any

import httpx

from app.retrieval.models import (
    AnswerConfidence,
    AnswerStatus,
    AskParameters,
    AskResponse,
    DecisionState,
    DecisionView,
    EvidenceStrength,
    EvidenceView,
    RetrievalTrace,
)

logger = logging.getLogger("whycode.live")

_GITHUB_API_ROOT = "https://api.github.com"


# Search results are cached briefly: totals change slowly, and the
# search budget (30 requests/minute) is far smaller than the core API
# budget, so repeat views must not re-ask GitHub.
_SEARCH_TTL_SECONDS = 600.0
# When GitHub does refuse a search call (403/429), firing more searches
# only prolongs the refusal. All search calls pause for this long (or
# the Retry-After GitHub sends, when it sends one).
_SEARCH_COOLDOWN_SECONDS = 60.0


class LiveGitHubClient:
    """Wrapper around GitHub REST API with caching and error handling."""

    def __init__(self, token: str) -> None:
        self.token = token.strip()
        self._cache: dict[str, Any] = {}
        self._search_cache: dict[str, tuple[float, Any]] = {}
        self._search_blocked_until = 0.0
        self._client = httpx.Client(
            base_url=_GITHUB_API_ROOT,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=20.0,
        )

    def close(self) -> None:
        self._client.close()

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        is_search = path.startswith("/search/")
        cache_key = f"{path}:{json.dumps(params or {}, sort_keys=True)}"
        if is_search:
            now = time.monotonic()
            hit = self._search_cache.get(cache_key)
            if hit is not None and now - hit[0] < _SEARCH_TTL_SECONDS:
                return hit[1]
            if now < self._search_blocked_until:
                # Search budget exhausted: do not fire. Callers treat
                # None as "unknown" and omit the figure rather than
                # printing a wrong one.
                return None
        elif cache_key in self._cache:
            return self._cache[cache_key]
        try:
            resp = self._client.get(path, params=params)
            if resp.status_code == 404:
                return None
            if is_search and resp.status_code in (403, 429):
                wait = _SEARCH_COOLDOWN_SECONDS
                retry_after = resp.headers.get("Retry-After", "")
                try:
                    wait = float(retry_after)
                except ValueError:
                    pass
                wait = min(max(wait, 1.0), 300.0)
                self._search_blocked_until = time.monotonic() + wait
                logger.warning(
                    "GitHub search refused (%s) on %s; pausing search "
                    "calls for %.0fs",
                    resp.status_code,
                    path,
                    wait,
                )
                return None
            resp.raise_for_status()
            data = resp.json()
            if is_search:
                self._search_cache[cache_key] = (time.monotonic(), data)
            else:
                self._cache[cache_key] = data
            return data
        except Exception as exc:
            logger.warning("GitHub API error on %s: %s", path, exc)
            return None

    def repo_info(self, repo: str) -> dict[str, Any] | None:
        return self._get(f"/repos/{repo}")

    def tree_files(self, repo: str) -> list[str]:
        info = self.repo_info(repo)
        if not info:
            return []
        branch = info.get("default_branch", "main")
        tree = self._get(f"/repos/{repo}/git/trees/{branch}", params={"recursive": "1"})
        if not tree or "tree" not in tree:
            return []
        return [
            item["path"]
            for item in tree["tree"]
            if item.get("type") == "blob"
        ]

    def search_issues_prs(self, repo: str, query: str, limit: int = 5) -> list[dict[str, Any]]:
        clean_q = re.sub(r"[^\w\s-]", " ", query).strip()
        words = [w for w in clean_q.split() if len(w) > 2 and w.lower() not in {"the", "and", "why", "what", "how", "this", "that"}][:5]
        search_term = " ".join(words)
        if not search_term:
            search_term = "code"
        q_str = f"repo:{repo} {search_term}"
        res = self._get("/search/issues", params={"q": q_str, "per_page": limit, "sort": "relevance"})
        if not res or "items" not in res:
            return []
        return res["items"]

    def search_total(self, repo: str, qualifiers: str) -> int | None:
        """Exact total for a raw GitHub issue/PR search (qualifiers such as
        ``type:pr author:login``), or None when GitHub does not answer.
        Unlike search_issues_prs this does NOT clean the query — qualifiers
        must reach the API intact."""
        res = self._get(
            "/search/issues",
            params={"q": f"repo:{repo} {qualifiers}", "per_page": 1},
        )
        if not res or "total_count" not in res:
            return None
        return int(res.get("total_count", 0))

    def search_items(self, repo: str, qualifiers: str, limit: int = 10) -> list[dict[str, Any]]:
        """Raw GitHub issue/PR search items for a qualifier string."""
        res = self._get(
            "/search/issues",
            params={"q": f"repo:{repo} {qualifiers}", "per_page": limit},
        )
        if not res or "items" not in res:
            return []
        return res["items"]

    def search_commits_total(self, repo: str, login: str) -> int | None:
        """Exact commit count for an author in a repo (search/commits)."""
        res = self._get(
            "/search/commits",
            params={"q": f"repo:{repo} author:{login}", "per_page": 1},
        )
        if not res or "total_count" not in res:
            return None
        return int(res.get("total_count", 0))

    def contributors(self, repo: str, limit: int = 25) -> list[dict[str, Any]]:
        res = self._get(f"/repos/{repo}/contributors", params={"per_page": limit})
        return res if isinstance(res, list) else []

    def user(self, login: str) -> dict[str, Any] | None:
        return self._get(f"/users/{login}")

    def commits(self, repo: str, author: str | None = None, limit: int = 25) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"per_page": limit}
        if author:
            params["author"] = author
        res = self._get(f"/repos/{repo}/commits", params=params)
        return res if isinstance(res, list) else []

    def commit_detail(self, repo: str, sha: str) -> dict[str, Any] | None:
        return self._get(f"/repos/{repo}/commits/{sha}")

    def pulls(self, repo: str, creator: str | None = None, limit: int = 15) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"state": "all", "per_page": limit}
        if creator:
            params["creator"] = creator
        res = self._get(f"/repos/{repo}/pulls", params=params)
        return res if isinstance(res, list) else []

    def pr_detail(self, repo: str, number: int) -> dict[str, Any] | None:
        return self._get(f"/repos/{repo}/pulls/{number}")

    def pr_files(self, repo: str, number: int) -> list[dict[str, Any]]:
        res = self._get(f"/repos/{repo}/pulls/{number}/files", params={"per_page": 50})
        return res if isinstance(res, list) else []

    def file_content(self, repo: str, path: str) -> str | None:
        import base64
        res = self._get(f"/repos/{repo}/contents/{path}")
        if not res or "content" not in res:
            return None
        encoding = res.get("encoding", "base64")
        if encoding == "base64":
            try:
                return base64.b64decode(res["content"]).decode("utf-8", errors="replace")
            except Exception:
                return None
        return str(res.get("content", ""))


def clean_markdown(text: str) -> str:
    if not text:
        return ""
    # 1. Convert HTML line breaks and paragraph/div tags into proper markdown newlines
    text = re.sub(r"<\s*br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<\s*/p\s*>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<\s*p[^>]*>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<\s*/div\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<\s*div[^>]*>", "\n", text, flags=re.IGNORECASE)

    # 2. Unescape common HTML entities
    text = re.sub(r"&nbsp;", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"&lt;", "<", text, flags=re.IGNORECASE)
    text = re.sub(r"&gt;", ">", text, flags=re.IGNORECASE)
    text = re.sub(r"&amp;", "&", text, flags=re.IGNORECASE)
    text = re.sub(r"&quot;", '"', text, flags=re.IGNORECASE)

    # 3. Ensure headings (#, ##, ###) start on a new line with leading blank line
    text = re.sub(r"([^\n])\s*(#{1,6}\s+[^\n]+)", r"\1\n\n\2\n", text)

    # 4. Wrap common file paths with known extensions in backticks if not already wrapped
    text = re.sub(
        r"(?:^|(?<=[\s(,;]))([a-zA-Z0-9_./-]+\.(?:py|ts|tsx|js|jsx|json|md|rs|go|java|c|cpp|h|toml|yaml|yml|css|html))(?:$|(?=[\s),;]))",
        r"`\1`",
        text,
    )

    # 5. Wrap identifier-like paths or underscore symbols in backticks
    text = re.sub(
        r"(?:^|(?<=[\s(,;]))(_[a-zA-Z0-9_]+(?:\/)?|[a-zA-Z0-9_]+\/_[a-zA-Z0-9_]+\/?)(?:$|(?=[\s),;]))",
        r"`\1`",
        text,
    )

    # 6. Process line by line to organize title headers, nested lists, and subheaders
    lines = text.split("\n")
    processed: list[str] = []
    in_numbered = False

    for i, raw_line in enumerate(lines):
        trimmed = raw_line.strip()
        if not trimmed:
            processed.append("")
            continue

        if (
            i == 0
            and not trimmed.startswith("#")
            and not trimmed.startswith(("-", "*"))
            and not re.match(r"^\d+\.", trimmed)
            and trimmed[-1] not in ".!?:,"
            and len(trimmed) <= 80
            and len(lines) > 1
        ):
            processed.append(f"## {trimmed}")
            continue

        if re.match(r"^\d+\.\s+", trimmed):
            in_numbered = True
            processed.append(trimmed)
            continue

        if re.match(r"^[-*]\s+", trimmed):
            if in_numbered:
                processed.append("   " + trimmed)
            else:
                processed.append(trimmed)
            continue

        if trimmed.startswith("#"):
            in_numbered = False
            processed.append(trimmed)
            continue

        next_non_empty = ""
        for j in range(i + 1, len(lines)):
            if lines[j].strip():
                next_non_empty = lines[j].strip()
                break

        if next_non_empty.startswith(("- ", "* ")):
            if not trimmed.endswith((".", ":")) and len(trimmed) < 80:
                in_numbered = False
                processed.append(f"#### {trimmed}")
                continue

        in_numbered = False
        processed.append(trimmed)

    text = "\n".join(processed)
    # Strip any leading empty headings
    text = re.sub(r"^#{1,6}\s*\n+", "", text)
    # Normalize excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


_RETRIEVAL_STOP_WORDS = {
    "what", "whats", "why", "how", "when", "where", "which", "who", "whom",
    "does", "doesnt", "is", "are", "was", "were", "be", "been", "being",
    "this", "that", "these", "those", "the", "and", "or", "for", "from", "with",
    "about", "into", "through", "during", "before", "after", "above", "below",
    "code", "codebase", "repo", "repository", "project", "used", "uses", "using",
    "solve", "solves", "solving", "problem", "problems", "need", "needs", "needed",
    "structure", "organized", "organization", "architecture", "architectural",
    "work", "works", "working", "help", "helps", "tell", "give", "show", "overview"
}


_SOURCE_SUFFIXES = (
    ".py", ".ts", ".tsx", ".js", ".go", ".rs", ".java", ".kt", ".rb", ".cs", ".swift", ".c", ".cc",
    ".cpp", ".h",
)
_ENTRY_NAMES = (
    "__init__.py", "main.py", "app.py", "client.py", "index.ts", "index.js", "main.go",
    "lib.rs", "main.rs", "mod.rs",
)


def _package_roots(repo: str, files: list[str]) -> list[str]:
    """Likely primary source roots: ``<name>/``, ``src/<name>/``, ``src/``, ``lib/``."""
    name = repo.rsplit("/", 1)[-1].lower()
    candidates = {name, name.replace("-", "_"), name.replace("-", ""), name.removeprefix("py")}
    roots: list[str] = []
    lowered = {f.lower() for f in files}
    for cand in candidates:
        for root in (f"{cand}/", f"src/{cand}/", f"lib/{cand}/"):
            if any(f.startswith(root) for f in lowered) and root not in roots:
                roots.append(root)
    for root in ("src/", "lib/"):
        if not roots and any(f.startswith(root) for f in lowered):
            roots.append(root)
    if not roots and any("/" not in f and f.endswith(_SOURCE_SUFFIXES) for f in lowered):
        roots.append(".")  # sources live at the repository root (common in Go)
    for root in ("pkg/", "cmd/", "internal/"):
        if not roots and any(f.startswith(root) for f in lowered):
            roots.append(root)
    return roots


def _in_package(f_lower: str, packages: list[str]) -> bool:
    return any(("/" not in f_lower) if p == "." else f_lower.startswith(p) for p in packages)


def _is_entrypoint(f_lower: str, packages: list[str]) -> bool:
    return any(
        f_lower.startswith(p) and f_lower[len(p):] in _ENTRY_NAMES for p in packages
    )


def rank_files_for_query(repo: str, question: str, files: list[str]) -> list[str]:
    """Ranks repository files by relevance to the query, heavily prioritizing architectural sources."""
    q_tokens = [w.lower() for w in re.findall(r"[a-zA-Z0-9_]+", question) if len(w) > 2]
    content_tokens = [w for w in q_tokens if w not in _RETRIEVAL_STOP_WORDS]
    q_lower = question.lower()
    is_overview_query = (
        len(content_tokens) == 0
        or any(
            w in q_lower
            for w in [
                "structure",
                "architecture",
                "what is",
                "used for",
                "problem",
                "overview",
                "what does",
                "why do we need",
                "how is it organized",
            ]
        )
    )

    packages = _package_roots(repo, files)
    scored: list[tuple[float, str]] = []
    for f in files:
        f_lower = f.lower()
        score = 0.0

        # Heavy penalties for administrative and non-code documentation files
        if any(ign in f_lower for ign in ["code_of_conduct", "contributing", "license", ".github/", "issue_template"]):
            if not any(t in f_lower for t in content_tokens):
                score -= 100.0
        # Penalties for test fixtures and unit tests
        if "tests/" in f_lower or "test_" in f_lower:
            if not any(t in f_lower for t in content_tokens):
                score -= 30.0

        # Strong boost for primary entrypoints, README and core docs. The
        # package is derived from the repository, so ranking works for any
        # repo rather than one hand-tuned demo target.
        if is_overview_query:
            if f_lower in ("readme.md", "readme.rst", "readme"):
                score += 85.0
            elif f_lower.startswith("docs/") and f_lower.rsplit("/", 1)[-1] in (
                "index.md", "readme.md", "architecture.md", "overview.md", "design.md"
            ):
                score += 50.0
            elif _is_entrypoint(f_lower, packages):
                score += 65.0
            elif _in_package(f_lower, packages) and f_lower.endswith(_SOURCE_SUFFIXES):
                score += 35.0

        # Match content tokens against file path
        for t in content_tokens:
            if t in f_lower:
                score += 25.0
                if f"/{t}." in f_lower or f"_{t}." in f_lower or f"_{t}/" in f_lower:
                    score += 20.0

        # General baseline boost for primary package source files
        if _in_package(f_lower, packages) and f_lower.endswith(_SOURCE_SUFFIXES):
            score += 10.0
        elif f.endswith(".md") and f.startswith("docs/"):
            score += 5.0

        if score > 0:
            scored.append((score, f))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [f for _, f in scored]


class LiveService:
    """Orchestrates live AI answers and data retrieval from GitHub and Neo4j."""

    def __init__(
        self,
        github_token: str | None = None,
        generator: Any = None,
        neo4j_client: Any = None,
    ) -> None:
        token = github_token or os.environ.get("WHYCODE_GITHUB_TOKEN", "")
        self.gh = LiveGitHubClient(token) if token else None
        self.generator = generator
        self.neo4j_client = neo4j_client
        # Optional decision ledger (set by the app factory). When the repo is
        # indexed, recorded decisions and their verified evidence join the
        # evidence pool; decisions are never generated by the model.
        self.ledger: Any = None
        # Question-intent classifier (DistilBERT, keyword fallback). None
        # means the shared process-wide instance; tests inject their own.
        self.intent_classifier: Any = None

    def get_people(self, repo: str) -> list[dict[str, Any]]:
        if not self.gh:
            return []
        contributors = self.gh.contributors(repo, limit=20)
        people: list[dict[str, Any]] = []
        for idx, c in enumerate(contributors):
            login = c.get("login")
            if not login:
                continue
            avatar_url = c.get("avatar_url") or f"https://avatars.githubusercontent.com/u/{c.get('id', 0)}"
            contributions = int(c.get("contributions", 0))
            is_maintainer = idx < 3
            role_tags = ["Maintainer"] if is_maintainer else ["Contributor"]
            # Honest counts only: the PR total is an exact GitHub search
            # total and commits is the contributors API's own count. When
            # search does not answer (rate limit), the PR total is None —
            # unknown, and the UI hides it. A fetched-sample size is never
            # presented as a total: the list previously derived stats from
            # contribution ratios, which presented invented numbers as
            # fetched data. Reviews/comments/decisions are computed for
            # real on the profile endpoint (one person at a time); the
            # list view leaves them None rather than estimating them.
            pr_total = self.gh.search_total(repo, f"type:pr author:{login}")
            people.append({
                "login": login,
                "name": login,
                "url": f"https://github.com/{login}",
                "role_tags": role_tags,
                "authored_pull_requests": pr_total,
                "reviews": None,
                "comments": None,
                "commits": contributions,
                "first_seen": None,
                "last_seen": None,
            })
        return people

    def get_person_profile(self, repo: str, login: str) -> dict[str, Any]:
        if not self.gh:
            return {
                "login": login,
                "name": login,
                "url": f"https://github.com/{login}",
                "role_tags": ["Contributor"],
                "authored_pull_requests": None,
                "reviews": None,
                "comments": None,
                "commits": None,
                "authored": [],
                "reviewed": [],
                "participated": [],
                "changes": [],
            }
        u = self.gh.user(login) or {}
        commits = self.gh.commits(repo, author=login, limit=10)
        pulls = self.gh.pulls(repo, creator=login, limit=10)

        authored_prs = []
        for pr in pulls:
            authored_prs.append({
                "number": pr.get("number", 0),
                "title": pr.get("title", ""),
                "url": pr.get("html_url", f"https://github.com/{repo}/pull/{pr.get('number')}"),
                "author": {"login": login, "name": u.get("name") or login, "url": f"https://github.com/{login}"},
                "merged_at": pr.get("merged_at"),
                "reviewers": [],
                "participants": [],
            })

        changes = []
        for c in commits:
            sha = c.get("sha", "")
            commit_info = c.get("commit", {})
            msg = commit_info.get("message", "").splitlines()[0] if commit_info.get("message") else "Update"
            # Real line stats and the real first touched file come from the
            # commit detail (same pattern as the changes feed); when GitHub
            # does not answer, stats stay 0 (unknown), never invented.
            detail = self._commit_detail_cached(repo, sha) if sha else None
            stats = (detail or {}).get("stats") or {}
            files = (detail or {}).get("files") or []
            if files:
                first_file = files[0]
                path = first_file.get("filename") or f"{repo} / commit {sha[:7]}"
                status = str(first_file.get("status", "modified"))
                change_kind = status if status in ("added", "removed", "renamed") else "modified"
            else:
                path = f"{repo} / commit {sha[:7]}"
                change_kind = "modified"
            pr_match = re.search(r"#(\d+)", msg)
            pr_num = int(pr_match.group(1)) if pr_match else 0
            commit_url = f"https://github.com/{repo}/commit/{sha}"
            changes.append({
                "change_id": f"change_{sha[:7]}",
                "path": path,
                "symbol": None,
                "change_kind": change_kind,
                "additions": int(stats.get("additions", 0) or 0),
                "deletions": int(stats.get("deletions", 0) or 0),
                "reasoning": msg,
                "decision": None,
                "evidence_ids": [f"{repo}:commit:{sha[:7]}"],
                "commit_sha": sha or None,
                "commit_url": commit_url,
                "files_changed": len(files) if detail else None,
                "pr": {
                    "number": pr_num,
                    "title": msg,
                    "url": f"https://github.com/{repo}/pull/{pr_num}" if pr_num else commit_url,
                    "author": {"login": login, "name": u.get("name") or login, "url": f"https://github.com/{login}"},
                    "reviewers": [],
                    "participants": [],
                },
                "author": {"login": login, "name": u.get("name") or login, "url": f"https://github.com/{login}"},
            })

        # Exact totals from GitHub's own search indexes. When search
        # does not answer (rate limit), a total stays None — unknown —
        # and the UI hides that stat. A fetched sample's size is never
        # substituted: it understates silently and reads as exact.
        pr_total = self.gh.search_total(repo, f"type:pr author:{login}")
        reviews_total = self.gh.search_total(repo, f"type:pr reviewed-by:{login}")
        comments_total = self.gh.search_total(repo, f"commenter:{login}")
        commits_total = self.gh.search_commits_total(repo, login)

        def _ref(item: dict[str, Any]) -> dict[str, Any]:
            number = int(item.get("number", 0) or 0)
            return {
                "number": number,
                "title": item.get("title", ""),
                "url": item.get("html_url", f"https://github.com/{repo}/pull/{number}"),
                "author": {"login": login, "name": u.get("name") or login, "url": f"https://github.com/{login}"},
                "merged_at": (item.get("pull_request") or {}).get("merged_at"),
                "reviewers": [],
                "participants": [],
            }

        reviewed = [_ref(it) for it in self.gh.search_items(repo, f"type:pr reviewed-by:{login}", limit=10)]
        participated = [_ref(it) for it in self.gh.search_items(repo, f"commenter:{login}", limit=10)]

        return {
            "login": login,
            "name": u.get("name") or login,
            "url": f"https://github.com/{login}",
            "role_tags": ["Contributor"],
            "authored_pull_requests": pr_total,
            "reviews": reviews_total,
            "comments": comments_total,
            "commits": commits_total,
            "first_seen": u.get("created_at"),
            "last_seen": commits[0].get("commit", {}).get("author", {}).get("date") if commits else None,
            "authored": authored_prs,
            "reviewed": reviewed,
            "participated": participated,
            "changes": changes,
        }

    def _commit_detail_cached(self, repo: str, sha: str) -> dict[str, Any] | None:
        """Commit detail (stats + files), cached per service instance so
        paging the changes feed does not re-hit the GitHub API."""
        cache = getattr(self, "_commit_detail_cache", None)
        if cache is None:
            cache = self._commit_detail_cache = {}
        key = f"{repo}@{sha}"
        if key not in cache:
            try:
                cache[key] = self.gh.commit_detail(repo, sha) if self.gh else None
            except Exception:
                cache[key] = None
        return cache[key]

    def get_changes(self, repo: str, limit: int = 20) -> list[dict[str, Any]]:
        if not self.gh:
            return []
        raw_commits = self.gh.commits(repo, limit=limit)
        changes: list[dict[str, Any]] = []
        for c in raw_commits:
            sha = c.get("sha", "")
            commit_info = c.get("commit", {})
            msg = commit_info.get("message", "").splitlines()[0] if commit_info.get("message") else "Update"
            author_info = c.get("author") or {}
            login = author_info.get("login") or commit_info.get("author", {}).get("name") or "developer"

            pr_match = re.search(r"#(\d+)", msg)
            pr_num = int(pr_match.group(1)) if pr_match else 0

            # Real line stats and the real first touched file come from
            # the commit detail; when GitHub does not answer, the stats
            # stay 0 (unknown) instead of invented numbers.
            detail = self._commit_detail_cached(repo, sha) if sha else None
            stats = (detail or {}).get("stats") or {}
            files = (detail or {}).get("files") or []
            additions = int(stats.get("additions", 0) or 0)
            deletions = int(stats.get("deletions", 0) or 0)
            if files:
                first_file = files[0]
                path = first_file.get("filename") or f"{repo} / commit {sha[:7]}"
                status = str(first_file.get("status", "modified"))
                change_kind = status if status in ("added", "removed", "renamed") else "modified"
            else:
                path = f"{repo} / commit {sha[:7]}"
                change_kind = "modified"

            commit_url = f"https://github.com/{repo}/commit/{sha}"
            changes.append({
                "change_id": f"change_{sha[:7]}",
                "path": path,
                "symbol": None,
                "change_kind": change_kind,
                "additions": additions,
                "deletions": deletions,
                "reasoning": msg,
                "decision": None,
                "evidence_ids": [f"{repo}:commit:{sha[:7]}"],
                "commit_sha": sha or None,
                "commit_url": commit_url,
                "files_changed": len(files) if detail else None,
                "pr": {
                    "number": pr_num,
                    "title": msg,
                    # A referenced PR links to the pull request itself;
                    # without one, the change is a direct commit and the
                    # URL stays the commit URL (the UI keys the PR
                    # affordance off number > 0).
                    "url": f"https://github.com/{repo}/pull/{pr_num}" if pr_num else commit_url,
                    "author": {"login": login, "name": login, "url": f"https://github.com/{login}"},
                    "reviewers": [],
                    "participants": [],
                },
                "author": {"login": login, "name": login, "url": f"https://github.com/{login}"},
            })
        return changes

    def get_pull_request(self, repo: str, number: int) -> dict[str, Any] | None:
        if not self.gh:
            return None
        pr = self.gh.pr_detail(repo, number)
        if not pr:
            return None
        files = self.gh.pr_files(repo, number)
        changed_files = [
            {
                "path": f.get("filename", ""),
                "change_kind": f.get("status", "modified"),
                "additions": int(f.get("additions", 0)),
                "deletions": int(f.get("deletions", 0)),
            }
            for f in files
        ]
        user_info = pr.get("user") or {}
        author = {
            "login": user_info.get("login", "maintainer"),
            "name": user_info.get("login", "maintainer"),
            "url": f"https://github.com/{user_info.get('login', '')}",
        }
        return {
            "number": number,
            "title": pr.get("title", ""),
            "url": pr.get("html_url", f"https://github.com/{repo}/pull/{number}"),
            "author": author,
            "merged_at": pr.get("merged_at"),
            "reviewers": [],
            "participants": [],
            "state": "merged" if pr.get("merged_at") else pr.get("state", "open"),
            "created_at": pr.get("created_at"),
            "body": pr.get("body") or "",
            "review_comment_count": pr.get("review_comments", 0),
            "issue_comment_count": pr.get("comments", 0),
            "changed_files": changed_files,
            "commits": [],
            "decision_ids": [],
        }

    def answer_question(
        self,
        parameters: AskParameters,
        *,
        generator: Any = None,
        usage_sink: dict[str, int] | None = None,
    ) -> AskResponse:
        repo = parameters.repo or os.environ.get("WHYCODE_DEFAULT_REPO", "encode/httpx")
        question = parameters.question

        # A caller may substitute its own generator (a visitor's custom
        # model) for this call only; the service default is untouched.
        # The recorder captures the tokens the generator actually bills
        # into usage_sink, for whichever generator served the call.
        from app.intent.llm.provider import RecordingProvider

        effective = generator if generator is not None else self.generator
        recorder = RecordingProvider(effective) if effective is not None else None

        # 1. Fetch live repository context from GitHub API
        repo_info = self.gh.repo_info(repo) if self.gh else None
        desc = repo_info.get("description", "") if repo_info else ""
        branch = repo_info.get("default_branch", "main") if repo_info else "main"

        # Search matching issues and PRs
        matching_prs = self.gh.search_issues_prs(repo, question, limit=4) if self.gh else []

        # Get relevant file paths using intelligent architectural ranking
        all_files = self.gh.tree_files(repo) if self.gh else []
        ranked_files = rank_files_for_query(repo, question, all_files)
        key_files = ranked_files[:12] if ranked_files else all_files[:12]

        # Fetch snippets from the top 4 most relevant files (up to 70 lines each)
        fetched_files: list[tuple[str, str]] = []
        if key_files and self.gh:
            for target_file in key_files[:4]:
                content = self.gh.file_content(repo, target_file)
                if content:
                    fetched_files.append((target_file, "\n".join(content.splitlines()[:70])))

        # 2. Recorded decisions from the ledger, when this repo is indexed.
        ledger_cards: list[dict[str, Any]] = []
        if self.ledger is not None:
            try:
                from app.ledger.why import WhyEngine

                found = WhyEngine(self.ledger).search(
                    repo, question, targets=key_files[:4], limit=3
                )
                ledger_cards = [
                    c for c in found.get("decisions", []) if c.get("currency") != "dismissed"
                ]
            except Exception as exc:  # noqa: BLE001 - the ledger is optional context
                logger.warning("Ledger lookup failed: %s", exc)

        # 3. The evidence pool: only content actually fetched above. The model
        # may cite these aliases and nothing else.
        pool: list[EvidenceView] = []
        for path, content in fetched_files:
            pool.append(
                EvidenceView(
                    evidence_id=f"{repo}:file:{path}",
                    kind="doc_file" if path.endswith((".md", ".rst")) else "source_file",
                    path=path,
                    excerpt=_excerpt(content),
                    alias=f"E{len(pool) + 1}",
                    url=f"https://github.com/{repo}/blob/{branch}/{path}",
                    start_line=1,
                    end_line=min(70, len(content.splitlines())),
                )
            )
        for item in matching_prs:
            number = item.get("number")
            if not isinstance(number, int):
                continue
            is_pr = "pull_request" in item
            pool.append(
                EvidenceView(
                    evidence_id=f"{repo}:{'pr' if is_pr else 'issue'}:{number}",
                    kind="pull_request" if is_pr else "issue",
                    excerpt=f"{item.get('title', '')}\n\n{(item.get('body') or '')[:400]}".strip(),
                    alias=f"E{len(pool) + 1}",
                    url=item.get("html_url")
                    or f"https://github.com/{repo}/{'pull' if is_pr else 'issues'}/{number}",
                    author=(item.get("user") or {}).get("login"),
                    author_avatar_url=(item.get("user") or {}).get("avatar_url"),
                    title=item.get("title"),
                    created_at=item.get("created_at"),
                    pr_number=number if is_pr else None,
                    issue_number=None if is_pr else number,
                )
            )
        decision_alias: dict[str, dict[str, Any]] = {}
        evidence_owner: dict[str, str] = {}
        for card in ledger_cards:
            decision_alias[f"D{len(decision_alias) + 1}"] = card
            for row in card.get("evidence", [])[:2]:
                view = EvidenceView(
                    evidence_id=row["evidence_id"],
                    kind=row["kind"],
                    path=row.get("path"),
                    excerpt=row["quote"],
                    alias=f"E{len(pool) + 1}",
                    url=row.get("url")
                    or _ledger_url(repo, branch, row),
                    author=row.get("author"),
                    created_at=row.get("created_at"),
                    pr_number=row.get("pr_number"),
                    commit_sha=row.get("commit_sha"),
                    start_line=row.get("start_line"),
                    end_line=row.get("end_line"),
                )
                pool.append(view)
                evidence_owner[view.evidence_id] = card["decision_id"]

        context_block = f"Repository: {repo} (default branch: {branch})\nDescription: {desc}\n\n"
        context_block += "EVIDENCE (cite only these aliases):\n"
        for view in pool:
            label = view.path or (
                f"PR #{view.pr_number}" if view.pr_number else
                f"Issue #{view.issue_number}" if view.issue_number else
                f"commit {view.commit_sha[:12]}" if view.commit_sha else view.kind
            )
            context_block += f"[{view.alias}] {label}\n{view.excerpt}\n\n"
        if decision_alias:
            context_block += "RECORDED DECISIONS (from the decision ledger):\n"
            for alias, card in decision_alias.items():
                context_block += (
                    f"[{alias}] {card['title']} (state: {card['currency']}"
                    f"{', pinned' if card.get('pinned') else ''})\n"
                    f"Decision: {card['decision']}\nRationale: {card.get('rationale') or 'not recorded'}\n\n"
                )

        # 4. The prompt. DistilBERT detects what kind of question this is so
        # the answer is laid out for the reader; the evidence rules are fixed.
        from app.nlp.intent import default_classifier
        from app.retrieval.prompt import build_answer_prompt

        classifier = getattr(self, "intent_classifier", None) or default_classifier()
        intent = classifier.classify(question)
        logger.info(
            "Question intent: %s (%.2f via %s)", intent.intent, intent.confidence, intent.backend
        )
        prompt = build_answer_prompt(
            question=question, context_block=context_block, intent=intent
        )

        try:
            raw = recorder.complete(
                system=prompt.system,
                user=prompt.user,
                schema=prompt.schema,
                schema_name=prompt.schema_name,
            )
            data = json.loads(raw)
        except Exception as exc:
            logger.error("Error during live LLM completion: %s", exc, exc_info=True)
            raise
        finally:
            if usage_sink is not None and recorder is not None:
                usage_sink.update(recorder.totals())

        # 5. Deterministic validation: every citation must resolve to the pool.
        by_alias = {v.alias.upper(): v for v in pool if v.alias}
        by_label: dict[str, EvidenceView] = {}
        for v in pool:
            if v.path:
                by_label[v.path.lower()] = v
            if v.pr_number:
                by_label[f"pr #{v.pr_number}"] = v
            if v.issue_number:
                by_label[f"issue #{v.issue_number}"] = v
        answer_text = clean_markdown(str(data.get("answer", "")))
        tokens = [str(c) for c in data.get("citations", [])] + re.findall(r"\[(E\d+)\]", answer_text)
        cited: list[EvidenceView] = []
        invalid: list[str] = []
        for token in tokens:
            key = token.strip().strip("[]`").strip()
            view = by_alias.get(key.upper()) or by_label.get(key.split(":", 1)[0].strip().lower())
            if view is None:
                if key and key not in invalid:
                    invalid.append(key)
                continue
            if view not in cited:
                cited.append(view)
        refs = [str(r).strip("[] ").upper() for r in data.get("decision_refs", []) or []]
        used_cards = [decision_alias[r] for r in refs if r in decision_alias]
        for view in cited:
            owner = evidence_owner.get(view.evidence_id)
            if owner and not any(c["decision_id"] == owner for c in used_cards):
                used_cards.extend(c for c in ledger_cards if c["decision_id"] == owner)

        declared_insufficient = data.get("answer_status") == "insufficient_evidence"
        if declared_insufficient or not cited:
            caveats = [str(c) for c in data.get("caveats", [])]
            if not cited and not declared_insufficient:
                caveats.append(
                    "Refused: the draft answer cited no evidence that Why-Code actually fetched "
                    "for this question, so it was not shown."
                )
            return AskResponse(
                answer_status=AnswerStatus.INSUFFICIENT_EVIDENCE,
                answer=(
                    answer_text
                    if declared_insufficient and answer_text
                    else "Why-Code could not find evidence in this repository that answers the "
                    "question, so it will not guess."
                ),
                confidence=AnswerConfidence.NONE,
                decision_ids=[],
                evidence=[],
                citations=[],
                graph_path=[],
                supersession=[],
                caveats=caveats,
                nearest_candidates=[],
                retrieval_trace=RetrievalTrace(
                    exact_matches=len(fetched_files),
                    fulltext_candidates=len(matching_prs),
                    vector_candidates=0,
                    graph_candidates=len(ledger_cards),
                    fused_candidates=len(pool),
                    selected_decisions=0,
                ),
                citation_valid=not invalid,
                evidence_strength=EvidenceStrength.NONE,
                refusal_mode=None,
                decisions=[],
                people=[],
            )

        kinds = {v.kind for v in cited}
        verified_ledger = any(
            row.get("verification") == "verified"
            for c in used_cards
            for row in c.get("evidence", [])
        )
        if invalid:
            confidence = AnswerConfidence.LOW
        elif len(cited) >= 2 and verified_ledger:
            confidence = AnswerConfidence.HIGH
        elif len(cited) >= 2:
            confidence = AnswerConfidence.MEDIUM
        else:
            confidence = AnswerConfidence.LOW
        strength = (
            EvidenceStrength.STRONG
            if len(kinds) >= 2 and len(cited) >= 3
            else EvidenceStrength.MODERATE
            if len(cited) >= 2
            else EvidenceStrength.THIN
        )
        caveats = [str(c) for c in data.get("caveats", [])]
        if invalid:
            caveats.append(
                "Dropped citations that did not resolve to fetched evidence: " + ", ".join(invalid)
            )
        if not used_cards:
            caveats.append(
                "No recorded decision covers this; the answer is synthesized from current source "
                "and matching issues/PRs, not from a decision record."
            )

        decision_views = [
            DecisionView(
                decision_id=c["decision_id"],
                title=c["title"],
                claim=c["decision"],
                rationale=c.get("rationale") or "",
                status=_DECISION_STATE.get(c["currency"], DecisionState.UNCERTAIN),
                confidence=AnswerConfidence.HIGH if c["in_force"] else AnswerConfidence.LOW,
                targets=[{"type": "File", "identifier": s} for s in c.get("scope", [])],
                target_ids=[f"File:{s}" for s in c.get("scope", [])],
                evidence_ids=[row["evidence_id"] for row in c.get("evidence", [])],
                superseded_by=c.get("superseded_by"),
                is_historical=c["currency"] in {"superseded", "stale"},
            )
            for c in used_cards
        ]
        graph_path: list[str] = [f"File:{v.path}" for v in cited if v.path and v.kind != "adr"]
        graph_path += [f"Decision:{c['decision_id']}" for c in used_cards]
        graph_path += [f"PullRequest:#{v.pr_number}" for v in cited if v.pr_number]

        return AskResponse(
            answer_status=AnswerStatus.ANSWERED,
            answer=answer_text,
            confidence=confidence,
            decision_ids=[d.decision_id for d in decision_views],
            evidence=cited,
            citations=[v.alias for v in cited if v.alias],
            graph_path=list(dict.fromkeys(graph_path)),
            supersession=[],
            caveats=caveats,
            nearest_candidates=[],
            retrieval_trace=RetrievalTrace(
                exact_matches=len(fetched_files),
                fulltext_candidates=len(matching_prs),
                vector_candidates=0,
                graph_candidates=len(ledger_cards),
                fused_candidates=len(pool),
                selected_decisions=len(decision_views),
            ),
            citation_valid=not invalid,
            evidence_strength=strength,
            refusal_mode=None,
            decisions=decision_views,
            people=[],
        )


_DECISION_STATE = {
    "active": DecisionState.ACTIVE,
    "needs_review": DecisionState.ACTIVE,
    "superseded": DecisionState.SUPERSEDED,
    "stale": DecisionState.UNCERTAIN,
    "background": DecisionState.UNCERTAIN,
    "uncheckable": DecisionState.UNCERTAIN,
}


def _excerpt(content: str, lines: int = 12, limit: int = 600) -> str:
    text = "\n".join(content.splitlines()[:lines])
    return text if len(text) <= limit else text[:limit] + "…"


def _ledger_url(repo: str, branch: str, row: dict[str, Any]) -> str:
    if row.get("commit_sha"):
        return f"https://github.com/{repo}/commit/{row['commit_sha']}"
    if row.get("pr_number"):
        return f"https://github.com/{repo}/pull/{row['pr_number']}"
    if row.get("path"):
        anchor = f"#L{row['start_line']}" if row.get("start_line") else ""
        return f"https://github.com/{repo}/blob/{branch}/{row['path']}{anchor}"
    return f"https://github.com/{repo}"
