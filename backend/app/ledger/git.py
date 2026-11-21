"""Thin, shell-free wrappers over the ``git`` CLI.

Every call passes an argument list (never a shell string) and a timeout, so a
repository path or a ref can never be interpreted as a command.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path

_RECORD = "\x1e"
_FIELD = "\x1f"


class GitError(RuntimeError):
    pass


@dataclass
class Commit:
    sha: str
    author: str
    date: str
    subject: str
    body: str
    files: list[str] = field(default_factory=list)

    @property
    def message(self) -> str:
        return f"{self.subject}\n\n{self.body}".strip()


class Git:
    def __init__(self, root: str | Path, *, timeout: float = 60.0) -> None:
        self.root = Path(root).resolve()
        self.timeout = timeout

    def run(self, *args: str, check: bool = True) -> str:
        try:
            proc = subprocess.run(
                ["git", "-C", str(self.root), *args],
                capture_output=True,
                text=True,
                timeout=self.timeout,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise GitError(str(exc)) from exc
        if check and proc.returncode != 0:
            raise GitError(proc.stderr.strip() or f"git {' '.join(args)} failed")
        return proc.stdout

    def is_repo(self) -> bool:
        try:
            return self.run("rev-parse", "--is-inside-work-tree").strip() == "true"
        except GitError:
            return False

    def head(self) -> str | None:
        try:
            return self.run("rev-parse", "HEAD").strip() or None
        except GitError:
            return None

    def remote_slug(self) -> str | None:
        """``owner/name`` of the ``origin`` remote when it is on GitHub."""
        try:
            url = self.run("remote", "get-url", "origin").strip()
        except GitError:
            return None
        for prefix in ("https://github.com/", "git@github.com:", "ssh://git@github.com/"):
            if url.startswith(prefix):
                slug = url[len(prefix) :].removesuffix(".git").strip("/")
                if slug.count("/") == 1:
                    return slug
        return None

    def ls_files(self) -> list[str]:
        return [line for line in self.run("ls-files", "-z").split("\0") if line]

    def commits(
        self, *, limit: int = 500, rev: str = "HEAD", paths: list[str] | None = None
    ) -> list[Commit]:
        # Each record starts with a separator and ends with a field separator,
        # after which ``--name-only`` prints that commit's files.
        fmt = _RECORD + _FIELD.join(["%H", "%an", "%aI", "%s", "%b"]) + _FIELD
        args = ["log", f"--max-count={limit}", f"--format={fmt}", "--name-only", rev]
        if paths:
            args += ["--", *paths]
        try:
            out = self.run(*args)
        except GitError:
            return []
        commits: list[Commit] = []
        for chunk in out.split(_RECORD):
            if not chunk.strip():
                continue
            parts = chunk.split(_FIELD)
            if len(parts) < 6:
                continue
            sha, author, date, subject, body, names = parts[:6]
            commits.append(
                Commit(
                    sha=sha.strip(),
                    author=author,
                    date=date,
                    subject=subject,
                    body=body.strip(),
                    files=[n for n in names.split("\n") if n.strip()],
                )
            )
        return commits

    def changed_since(
        self, anchor: str, paths: list[str]
    ) -> tuple[set[str], dict[str, str], set[str]]:
        """Files among ``paths`` changed since ``anchor`` (a commit or ISO time).

        Returns ``(changed, renamed, deleted)``; ``renamed`` maps an old path
        to its new name so a rename is not mistaken for a deletion.
        """
        if not paths:
            return set(), {}, set()
        if _looks_like_sha(anchor):
            args = ["diff", "--name-status", "-M", f"{anchor}..HEAD"]
        else:
            first = self._first_commit_after(anchor)
            if first is None:
                return set(), {}, set()
            args = ["diff", "--name-status", "-M", f"{first}^..HEAD"]
        try:
            out = self.run(*args)
        except GitError:
            return set(), {}, set()
        changed: set[str] = set()
        renamed: dict[str, str] = {}
        deleted: set[str] = set()
        for line in out.splitlines():
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            status = parts[0]
            if status.startswith("R") and len(parts) == 3:
                old, new = parts[1], parts[2]
                if _covered(old, paths):
                    renamed[old] = new
                    changed.add(old)
                continue
            path = parts[1]
            if not _covered(path, paths):
                continue
            changed.add(path)
            if status.startswith("D"):
                deleted.add(path)
        return changed, renamed, deleted

    def _first_commit_after(self, iso: str) -> str | None:
        try:
            out = self.run("log", "--reverse", f"--since={iso}", "--format=%H", "HEAD")
        except GitError:
            return None
        first = out.split("\n", 1)[0].strip()
        if not first:
            return None
        # A root commit has no parent; fall back to diffing from itself.
        try:
            self.run("rev-parse", f"{first}^")
        except GitError:
            return None
        return first

    def commit_exists(self, sha: str) -> bool:
        try:
            self.run("cat-file", "-e", f"{sha}^{{commit}}")
            return True
        except GitError:
            return False

    def changed_files(self, base: str, head: str = "HEAD") -> list[str]:
        out = self.run("diff", "--name-only", f"{base}...{head}")
        return [line for line in out.splitlines() if line.strip()]

    def churn(self, *, limit: int = 300) -> dict[str, int]:
        counts: dict[str, int] = {}
        for commit in self.commits(limit=limit):
            for path in commit.files:
                counts[path] = counts.get(path, 0) + 1
        return counts


def _looks_like_sha(value: str) -> bool:
    return 7 <= len(value) <= 40 and all(c in "0123456789abcdef" for c in value.lower())


def _covered(path: str, scope: list[str]) -> bool:
    return any(path == s or (s.endswith("/") and path.startswith(s)) for s in scope)


__all__ = ["Commit", "Git", "GitError"]
