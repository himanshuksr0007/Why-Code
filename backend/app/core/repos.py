"""Public repository identifier handling.

The onboarding flow accepts the shapes people actually paste: a GitHub URL,
a clone URL, or ``owner/repo``. Everything is normalized to the canonical
``owner/repo`` slug used by the graph. Only github.com is accepted in v1.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

_OWNER = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
_REPO = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")


def normalize_repo(value: str) -> str:
    """Return ``owner/repo`` or raise ``ValueError`` with a user-safe message."""

    raw = (value or "").strip()
    if not raw:
        raise ValueError("Enter a public GitHub repository URL or owner/repo.")

    # SCP-style clone URL: git@github.com:owner/repo.git
    scp = re.match(r"^git@github\.com:(?P<slug>.+)$", raw, re.IGNORECASE)
    if scp:
        raw = scp.group("slug")

    if "://" in raw or raw.lower().startswith("github.com/"):
        parsed = urlparse(raw if "://" in raw else f"https://{raw}")
        host = (parsed.hostname or "").lower()
        if host not in {"github.com", "www.github.com"}:
            raise ValueError("Only public github.com repositories are supported in v1.")
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) < 2:
            raise ValueError("The URL must point to a repository, for example https://github.com/encode/httpx.")
        owner, repo = parts[0], parts[1]
    else:
        parts = [part for part in raw.strip("/").split("/") if part]
        if len(parts) != 2:
            raise ValueError("Use owner/repo or a full https://github.com/owner/repo URL.")
        owner, repo = parts

    repo = repo.removesuffix(".git")
    if not _OWNER.fullmatch(owner) or not _REPO.fullmatch(repo):
        raise ValueError("That does not look like a GitHub repository identifier.")
    return f"{owner}/{repo}"


def repo_artifacts_slug(repo: str) -> str:
    """Filesystem-safe, collision-resistant slug for one repository."""

    owner, name = normalize_repo(repo).split("/", 1)
    return f"{owner}__{name}"


__all__ = ["normalize_repo", "repo_artifacts_slug"]
