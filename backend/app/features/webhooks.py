"""GitHub webhook receiver support.

Signature verification is HMAC-SHA256 with a constant-time compare;
deliveries are deduplicated by their ``X-GitHub-Delivery`` id in a
small SQLite store.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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

    def recent(self, *, limit: int = 20) -> dict[str, list[dict[str, Any]]]:
        with self._lock:
            events = self._db.execute(
                "SELECT delivery_id, event, action, repo, pr_number, title,"
                " received_at FROM events ORDER BY received_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            has_legacy_jobs = self._db.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'jobs'"
            ).fetchone()
            jobs = (
                self._db.execute(
                    "SELECT id, kind, repo, created_at, status, detail FROM jobs"
                    " ORDER BY id DESC LIMIT ?",
                    (limit,),
                ).fetchall()
                if has_legacy_jobs
                else []
            )
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
    ledger: Any = None,
) -> dict[str, Any]:
    """Record a verified event; apply a PR's decisions block to the ledger.

    Opening or editing a pull request records its declared decisions as
    proposed (replacing earlier ones from the same PR); merging it puts
    them in force, signed by the merge. Closing unmerged drops them.
    """
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
    ledger_result = None
    if recorded and ledger is not None and event == "pull_request" and repo and pr_number:
        ledger_result = apply_pr_decisions(ledger, repo=repo, action=action or "", pr=pr)
    return {"recorded": recorded, "job_id": None, "repo": repo, "ledger": ledger_result}


def apply_pr_decisions(ledger: Any, *, repo: str, action: str, pr: dict[str, Any]) -> dict[str, Any]:
    from app.ledger.miners import block_decisions, parse_decision_block
    from app.ledger.models import Action, AuthorityEvent, SignerKind

    number = int(pr["number"])
    merged = action == "closed" and bool(pr.get("merged"))
    if action not in {"opened", "edited", "reopened", "synchronize", "closed"}:
        return {"applied": 0}
    if action == "closed" and not merged:
        ledger.drop_proposed_from_pr(repo, number)
        return {"applied": 0, "dropped": True}
    block = parse_decision_block(pr.get("body"))
    author = (pr.get("user") or {}).get("login")
    decisions = block_decisions(
        block,
        repo=repo,
        pr_number=number,
        author=author,
        accepted=False,
        url=pr.get("html_url"),
    )
    ledger.drop_proposed_from_pr(repo, number, keep={d.decision_id for d in decisions})
    ids: list[str] = []
    for decision in decisions:
        outcome = ledger.upsert_mined(decision)
        if outcome == "tombstoned":
            continue
        if merged:
            ledger.act(
                decision.decision_id,
                AuthorityEvent(
                    decision_id=decision.decision_id,
                    action=Action.MERGE,
                    reason=f"declared in PR #{number}, which merged",
                    signer=f"PR #{number} merge" + (f" by {(pr.get('merged_by') or {}).get('login')}"
                                                    if pr.get("merged_by") else ""),
                    signer_kind=SignerKind.BOT,
                    scope=decision.scope,
                    evidence_ref=pr.get("merge_commit_sha") or decision.evidence[0].evidence_id,
                ),
            )
        ids.append(decision.decision_id)
    return {"applied": len(ids), "decision_ids": ids, "merged": merged, "errors": block.errors}
