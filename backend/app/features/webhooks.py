"""GitHub webhook receiver support.

Signature verification is HMAC-SHA256 with a constant-time compare;
deliveries are deduplicated by their ``X-GitHub-Delivery`` id in a
small SQLite store. A merged pull request records an
``incremental_refresh`` job and invalidates the repo's cached decision
threads, so the next read re-derives decisions from fresh data instead
of re-ingesting the world.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


def verify_signature(secret: str, body: bytes, header: str | None) -> bool:
    """True when the ``sha256=`` signature header matches the raw body."""
    if not secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[len("sha256=") :])


class WebhookStore:
    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._db = sqlite3.connect(self._path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        with self._lock, self._db:
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    delivery_id TEXT PRIMARY KEY,
                    event TEXT NOT NULL,
                    action TEXT,
                    repo TEXT,
                    pr_number INTEGER,
                    title TEXT,
                    received_at TEXT NOT NULL
                )
                """
            )
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kind TEXT NOT NULL,
                    repo TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    detail TEXT
                )
                """
            )

    def record_event(
        self,
        *,
        delivery_id: str,
        event: str,
        action: str | None,
        repo: str | None,
        pr_number: int | None,
        title: str | None,
    ) -> bool:
        """Insert an event; returns False when it is a redelivery."""
        with self._lock, self._db:
            cursor = self._db.execute(
                "INSERT OR IGNORE INTO events"
                " (delivery_id, event, action, repo, pr_number, title, received_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    delivery_id,
                    event,
                    action,
                    repo,
                    pr_number,
                    title,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            return cursor.rowcount > 0

    def record_job(self, *, kind: str, repo: str, detail: str) -> int:
        with self._lock, self._db:
            cursor = self._db.execute(
                "INSERT INTO jobs (kind, repo, created_at, status, detail)"
                " VALUES (?, ?, ?, 'done', ?)",
                (kind, repo, datetime.now(timezone.utc).isoformat(), detail),
            )
            return int(cursor.lastrowid)

    def recent(self, *, limit: int = 20) -> dict[str, list[dict[str, Any]]]:
        with self._lock:
            events = self._db.execute(
                "SELECT delivery_id, event, action, repo, pr_number, title,"
                " received_at FROM events ORDER BY received_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            jobs = self._db.execute(
                "SELECT id, kind, repo, created_at, status, detail FROM jobs"
                " ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return {
            "events": [dict(row) for row in events],
            "jobs": [dict(row) for row in jobs],
        }


def handle_github_event(
    store: WebhookStore,
    *,
    delivery_id: str,
    event: str,
    payload: dict[str, Any],
    invalidate: Callable[[str], None],
) -> dict[str, Any]:
    """Record a verified event; merged PRs schedule an incremental refresh."""
    repo = (payload.get("repository") or {}).get("full_name")
    action = payload.get("action")
    pr = payload.get("pull_request") or {}
    pr_number = pr.get("number") if isinstance(pr, dict) else None
    title = pr.get("title") if isinstance(pr, dict) else None
    recorded = store.record_event(
        delivery_id=delivery_id,
        event=event,
        action=action,
        repo=repo,
        pr_number=pr_number,
        title=title,
    )
    job_id: int | None = None
    if (
        recorded
        and repo
        and event == "pull_request"
        and action == "closed"
        and isinstance(pr, dict)
        and pr.get("merged")
    ):
        invalidate(repo)
        job_id = store.record_job(
            kind="incremental_refresh",
            repo=repo,
            detail=(
                f"PR #{pr_number} merged; cached decision threads invalidated,"
                " decisions re-derive on next read."
            ),
        )
    return {"recorded": recorded, "job_id": job_id, "repo": repo}
