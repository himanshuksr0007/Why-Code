"""Normalise the repository references a visitor can paste.

Accepted forms:

* ``https://github.com/encode/httpx``
* ``github.com/encode/httpx``
* ``git@github.com:encode/httpx.git``
* ``encode/httpx``

Only the repository root is accepted. A URL that points at a subdirectory or
a specific pull request is rejected instead of silently ingesting a different
repository than the one the visitor asked for.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

_SLUG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*$")
_GITHUB_HOSTS = {"github.com", "www.github.com"}


class RepoInputError(ValueError):
    """The pasted value is not a GitHub repository root."""


def normalize_repo(value: str) -> str:
    raw = value.strip()
    if not raw:
        raise RepoInputError("enter a GitHub repository URL or owner/repo")

    if raw.startswith("git@"):
        match = re.fullmatch(
            r"git@github\.com:(?P<slug>[^/\s]+/[^/\s]+?)(?:\.git)?/?", raw
        )
        if match is None:
            raise RepoInputError("expected git@github.com:owner/repo")
        return _validate_slug(match.group("slug"))

    if "://" in raw or raw.lower().startswith("github.com/"):
        candidate = raw if "://" in raw else f"https://{raw}"
        parsed = urlparse(candidate)
        if parsed.scheme not in {"http", "https"}:
            raise RepoInputError("only http(s) GitHub URLs are supported")
        if (parsed.hostname or "").lower() not in _GITHUB_HOSTS:
            raise RepoInputError("only github.com repositories are supported")
        if parsed.query or parsed.fragment:
            raise RepoInputError("paste the repository URL without query parameters")
        path = parsed.path.strip("/")
        if path.endswith(".git"):
            path = path[:-4]
        return _validate_slug(path)

    return _validate_slug(raw)


def _validate_slug(value: str) -> str:
    slug = value.strip().strip("/")
    if slug.endswith(".git"):
        slug = slug[:-4]
    if not _SLUG.fullmatch(slug):
        raise RepoInputError("expected a public GitHub repository such as owner/repo")
    owner, repo = slug.split("/", 1)
    if owner in {".", ".."} or repo in {".", ".."}:
        raise RepoInputError("invalid repository name")
    return f"{owner}/{repo}".lower()


__all__ = ["RepoInputError", "normalize_repo"]
