"""SQLite persistence for the decision ledger.

The authority log is append-only *in the database*: triggers reject any
UPDATE or DELETE on it, so the record of who granted or withdrew authority
cannot be rewritten by application code either.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from app.ledger.models import (
    Action,
    AuthorityEvent,
    Currency,
    Decision,
    Evidence,
    SignerKind,
    Source,
    Status,
    utcnow,
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS repos (
    repo TEXT PRIMARY KEY,
    root TEXT,
    head TEXT,
    indexed_at TEXT,
    stats TEXT
);
CREATE TABLE IF NOT EXISTS decisions (
    decision_id TEXT PRIMARY KEY,
    repo TEXT NOT NULL,
    title TEXT NOT NULL,
    decision TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT '',
    rationale TEXT NOT NULL DEFAULT '',
    alternatives TEXT NOT NULL DEFAULT '[]',
    consequences TEXT NOT NULL DEFAULT '[]',
    scope TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    kind TEXT NOT NULL DEFAULT 'architectural',
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    superseded_by TEXT,
    confidence REAL NOT NULL DEFAULT 0.5,
    created_at TEXT NOT NULL,
    anchor_at TEXT NOT NULL,
    anchor_commit TEXT,
    currency TEXT,
    changed_fraction REAL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS decisions_repo ON decisions(repo, status);
CREATE TABLE IF NOT EXISTS evidence (
    evidence_id TEXT NOT NULL,
    decision_id TEXT NOT NULL REFERENCES decisions(decision_id),
    kind TEXT NOT NULL,
    quote TEXT NOT NULL,
    path TEXT,
    start_line INTEGER,
    end_line INTEGER,
    commit_sha TEXT,
    pr_number INTEGER,
    url TEXT,
    author TEXT,
    created_at TEXT,
    verification TEXT NOT NULL,
    PRIMARY KEY (decision_id, evidence_id)
);
CREATE TABLE IF NOT EXISTS authority_log (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    decision_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    signer TEXT NOT NULL,
    signer_kind TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT '[]',
    evidence_ref TEXT,
    at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS authority_log_no_update
BEFORE UPDATE ON authority_log
BEGIN SELECT RAISE(ABORT, 'authority_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS authority_log_no_delete
BEFORE DELETE ON authority_log
BEGIN SELECT RAISE(ABORT, 'authority_log is append-only'); END;
"""

_JSON_FIELDS = ("alternatives", "consequences", "scope", "tags")


class LedgerError(ValueError):
    """A request the ledger refuses (missing reason, pinned decision, ...)."""


class LedgerStore:
    def __init__(self, path: str | Path = ":memory:") -> None:
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._db = sqlite3.connect(str(path), check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.execute("PRAGMA foreign_keys = ON")
        with self._lock, self._db:
            self._db.executescript(_SCHEMA)

    # ------------------------------------------------------------ repos

    def upsert_repo(
        self, repo: str, *, root: str | None, head: str | None, stats: dict[str, Any]
    ) -> None:
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO repos (repo, root, head, indexed_at, stats) VALUES (?,?,?,?,?)"
                " ON CONFLICT(repo) DO UPDATE SET root=excluded.root, head=excluded.head,"
                " indexed_at=excluded.indexed_at, stats=excluded.stats",
                (repo, root, head, utcnow(), json.dumps(stats)),
            )

    def repos(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._db.execute("SELECT * FROM repos ORDER BY repo").fetchall()
        return [{**dict(r), "stats": json.loads(r["stats"] or "{}")} for r in rows]

    def repo(self, repo: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._db.execute("SELECT * FROM repos WHERE repo = ?", (repo,)).fetchone()
        return {**dict(row), "stats": json.loads(row["stats"] or "{}")} if row else None

    def has_repo(self, repo: str) -> bool:
        with self._lock:
            return (
                self._db.execute(
                    "SELECT 1 FROM decisions WHERE repo = ? LIMIT 1", (repo,)
                ).fetchone()
                is not None
            )

    # -------------------------------------------------------- decisions

    def get(self, decision_id: str) -> Decision | None:
        with self._lock:
            row = self._db.execute(
                "SELECT * FROM decisions WHERE decision_id = ?", (decision_id,)
            ).fetchone()
            if row is None:
                # Allow unambiguous short prefixes, like git.
                rows = self._db.execute(
                    "SELECT * FROM decisions WHERE decision_id LIKE ? LIMIT 2",
                    (f"{decision_id}%",),
                ).fetchall()
                row = rows[0] if len(rows) == 1 else None
            if row is None:
                return None
            return self._hydrate(row)

    def list_decisions(
        self,
        repo: str,
        *,
        statuses: Iterable[Status] | None = None,
        currencies: Iterable[Currency] | None = None,
    ) -> list[Decision]:
        query = "SELECT * FROM decisions WHERE repo = ?"
        params: list[Any] = [repo]
        if statuses:
            values = [s.value for s in statuses]
            query += f" AND status IN ({','.join('?' * len(values))})"
            params += values
        if currencies:
            values = [c.value for c in currencies]
            query += f" AND currency IN ({','.join('?' * len(values))})"
            params += values
        query += " ORDER BY pinned DESC, confidence DESC, title"
        with self._lock:
            rows = self._db.execute(query, params).fetchall()
            return [self._hydrate(r) for r in rows]

    def cached_currency(self, decision_id: str) -> tuple[str | None, float | None]:
        with self._lock:
            row = self._db.execute(
                "SELECT currency, changed_fraction FROM decisions WHERE decision_id = ?",
                (decision_id,),
            ).fetchone()
        return (row["currency"], row["changed_fraction"]) if row else (None, None)

    def set_currency(self, decision_id: str, currency: Currency, fraction: float | None) -> None:
        with self._lock, self._db:
            self._db.execute(
                "UPDATE decisions SET currency = ?, changed_fraction = ? WHERE decision_id = ?",
                (currency.value, fraction, decision_id),
            )

    def upsert_mined(self, decision: Decision) -> str:
        """Insert or merge a mined decision; returns ``created|merged|tombstoned``.

        * A dismissed record is a tombstone: mining never revives it.
        * The same decision from another source merges as extra evidence.
        * Mining never demotes a decision a person or agent put in force.
        """
        decision.ensure_id()
        with self._lock, self._db:
            existing = self.get(decision.decision_id)
            if existing is not None and existing.status is Status.DISMISSED:
                return "tombstoned"
            if existing is None:
                self._insert(decision)
                if decision.status is Status.ACCEPTED:
                    self._append(
                        AuthorityEvent(
                            decision_id=decision.decision_id,
                            action=Action.ACCEPT,
                            reason=f"committed {decision.source.value} marks it accepted",
                            signer=_import_signer(decision),
                            signer_kind=SignerKind.IMPORT
                            if decision.source is Source.ADR
                            else SignerKind.BOT,
                            scope=decision.scope,
                            evidence_ref=decision.evidence[0].evidence_id
                            if decision.evidence
                            else None,
                        )
                    )
                else:
                    self._append(
                        AuthorityEvent(
                            decision_id=decision.decision_id,
                            action=Action.RECORD,
                            reason=f"mined from {decision.source.value}",
                            signer="whycode-indexer",
                            signer_kind=SignerKind.BOT,
                            scope=decision.scope,
                            evidence_ref=decision.evidence[0].evidence_id
                            if decision.evidence
                            else None,
                        )
                    )
                return "created"
            # Merge: new evidence rows, widen scope, keep stronger status.
            for item in decision.evidence:
                self._put_evidence(existing.decision_id, item)
            scope = list(dict.fromkeys([*existing.scope, *decision.scope]))[:10]
            promote = existing.status is Status.PROPOSED and decision.status is Status.ACCEPTED
            self._db.execute(
                "UPDATE decisions SET scope = ?, confidence = MAX(confidence, ?),"
                " status = ?, updated_at = ? WHERE decision_id = ?",
                (
                    json.dumps(scope),
                    decision.confidence,
                    (Status.ACCEPTED if promote else existing.status).value,
                    utcnow(),
                    existing.decision_id,
                ),
            )
            if promote:
                self._append(
                    AuthorityEvent(
                        decision_id=existing.decision_id,
                        action=Action.ACCEPT,
                        reason=f"committed {decision.source.value} marks it accepted",
                        signer=_import_signer(decision),
                        signer_kind=SignerKind.IMPORT,
                        scope=scope,
                        evidence_ref=decision.evidence[0].evidence_id
                        if decision.evidence
                        else None,
                    )
                )
            return "merged"

    def record(self, decision: Decision, event: AuthorityEvent) -> Decision:
        """Record a decision a person or agent states directly."""
        decision.ensure_id()
        _require(event, need_scope=decision.status is Status.ACCEPTED, need_evidence=False)
        with self._lock, self._db:
            existing = self.get(decision.decision_id)
            if existing is None:
                self._insert(decision)
            else:
                # Adding a title that exists updates it; omitted fields keep
                # their stored value and evidence accumulates.
                merged = existing.model_copy(
                    update={
                        k: v
                        for k, v in decision.model_dump(exclude={"evidence", "decision_id"}).items()
                        if v not in ("", [], None) and k not in {"created_at", "source"}
                    }
                )
                self._update(merged)
                self._db.execute(
                    "UPDATE decisions SET currency = NULL WHERE decision_id = ?",
                    (existing.decision_id,),
                )
                for item in decision.evidence:
                    self._put_evidence(existing.decision_id, item)
            event = event.model_copy(update={"decision_id": decision.decision_id})
            self._append(event)
        return self.get(decision.decision_id)  # type: ignore[return-value]

    def act(
        self,
        decision_id: str,
        event: AuthorityEvent,
        *,
        superseded_by: str | None = None,
        force: bool = False,
    ) -> Decision:
        """Apply an authority action (accept, pin, dismiss, ...) with its log row."""
        with self._lock, self._db:
            decision = self.get(decision_id)
            if decision is None:
                raise LedgerError(f"no decision {decision_id}")
            action = event.action
            scope = event.scope or decision.scope
            if action is Action.ACCEPT:
                _require(
                    event.model_copy(update={"scope": scope}), need_scope=True, need_evidence=True
                )
            else:
                _require(event, need_scope=False, need_evidence=False)
            if decision.pinned and action in {Action.DISMISS, Action.SUPERSEDE} and not force:
                raise LedgerError(
                    f"{decision.decision_id} is pinned; a person must pass force to retire it"
                )
            if force and event.signer_kind is not SignerKind.PERSON:
                raise LedgerError("only a person may force an action on a pinned decision")
            # Authority changes invalidate the currency cached at index time.
            updates: dict[str, Any] = {"updated_at": utcnow(), "currency": None}
            if action in {Action.ACCEPT, Action.REAFFIRM, Action.MERGE}:
                updates.update(
                    status=Status.ACCEPTED.value,
                    anchor_at=utcnow(),
                    anchor_commit=event.evidence_ref if _is_sha(event.evidence_ref) else None,
                    scope=json.dumps(scope),
                )
            elif action is Action.PIN:
                if decision.status is not Status.ACCEPTED:
                    raise LedgerError("only a decision in force can be pinned; accept it first")
                updates["pinned"] = 1
            elif action is Action.UNPIN:
                updates["pinned"] = 0
            elif action is Action.DISMISS:
                updates.update(status=Status.DISMISSED.value, pinned=0)
            elif action is Action.SUPERSEDE:
                if superseded_by and self.get(superseded_by) is None:
                    raise LedgerError(f"no successor decision {superseded_by}")
                updates.update(
                    status=Status.SUPERSEDED.value, pinned=0, superseded_by=superseded_by
                )
            assignments = ", ".join(f"{k} = ?" for k in updates)
            self._db.execute(
                f"UPDATE decisions SET {assignments} WHERE decision_id = ?",
                [*updates.values(), decision.decision_id],
            )
            self._append(
                event.model_copy(update={"decision_id": decision.decision_id, "scope": scope})
            )
        return self.get(decision.decision_id)  # type: ignore[return-value]

    def history(self, decision_id: str) -> list[AuthorityEvent]:
        with self._lock:
            rows = self._db.execute(
                "SELECT * FROM authority_log WHERE decision_id = ? ORDER BY seq", (decision_id,)
            ).fetchall()
        return [
            AuthorityEvent(**{**dict(r), "scope": json.loads(r["scope"] or "[]")}) for r in rows
        ]

    def recent_events(self, repo: str, *, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._db.execute(
                "SELECT a.*, d.title FROM authority_log a JOIN decisions d USING(decision_id)"
                " WHERE d.repo = ? ORDER BY a.seq DESC LIMIT ?",
                (repo, limit),
            ).fetchall()
        return [{**dict(r), "scope": json.loads(r["scope"] or "[]")} for r in rows]

    def update_evidence_verification(self, decision_id: str, item: Evidence) -> None:
        with self._lock, self._db:
            self._db.execute(
                "UPDATE evidence SET verification = ?, start_line = ?, end_line = ?"
                " WHERE decision_id = ? AND evidence_id = ?",
                (
                    item.verification.value,
                    item.start_line,
                    item.end_line,
                    decision_id,
                    item.evidence_id,
                ),
            )

    def drop_proposed_from_pr(self, repo: str, pr_number: int, *, keep: Iterable[str] = ()) -> None:
        """An edited PR description replaces its earlier proposed entries."""
        kept = set(keep)
        with self._lock, self._db:
            ids = [
                r["decision_id"]
                for r in self._db.execute(
                    "SELECT DISTINCT d.decision_id FROM decisions d"
                    " JOIN evidence e USING(decision_id)"
                    " WHERE d.repo = ? AND d.source = ? AND d.status = ? AND e.pr_number = ?",
                    (repo, Source.PR_BLOCK.value, Status.PROPOSED.value, pr_number),
                ).fetchall()
            ]
            for decision_id in ids:
                if decision_id in kept:
                    continue
                self._db.execute(
                    "UPDATE decisions SET status = ?, updated_at = ? WHERE decision_id = ?",
                    (Status.DISMISSED.value, utcnow(), decision_id),
                )
                self._append(
                    AuthorityEvent(
                        decision_id=decision_id,
                        action=Action.DISMISS,
                        reason=f"PR #{pr_number} description no longer proposes it",
                        signer="whycode-webhook",
                        signer_kind=SignerKind.BOT,
                    )
                )

    # ---------------------------------------------------------- internals

    def _insert(self, d: Decision) -> None:
        now = utcnow()
        self._db.execute(
            "INSERT INTO decisions (decision_id, repo, title, decision, context, rationale,"
            " alternatives, consequences, scope, tags, kind, source, status, pinned,"
            " superseded_by, confidence, created_at, anchor_at, anchor_commit, updated_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                d.decision_id,
                d.repo,
                d.title,
                d.decision,
                d.context,
                d.rationale,
                json.dumps(d.alternatives),
                json.dumps(d.consequences),
                json.dumps(d.scope),
                json.dumps(d.tags),
                d.kind,
                d.source.value,
                d.status.value,
                int(d.pinned),
                d.superseded_by,
                d.confidence,
                d.created_at,
                d.anchor_at,
                d.anchor_commit,
                now,
            ),
        )
        for item in d.evidence:
            self._put_evidence(d.decision_id, item)

    def _update(self, d: Decision) -> None:
        self._db.execute(
            "UPDATE decisions SET title=?, decision=?, context=?, rationale=?, alternatives=?,"
            " consequences=?, scope=?, tags=?, kind=?, status=?, confidence=?, updated_at=?"
            " WHERE decision_id = ?",
            (
                d.title,
                d.decision,
                d.context,
                d.rationale,
                json.dumps(d.alternatives),
                json.dumps(d.consequences),
                json.dumps(d.scope),
                json.dumps(d.tags),
                d.kind,
                d.status.value,
                d.confidence,
                utcnow(),
                d.decision_id,
            ),
        )

    def _put_evidence(self, decision_id: str, e: Evidence) -> None:
        if not e.evidence_id:
            e.evidence_id = e.fingerprint()
        self._db.execute(
            "INSERT OR IGNORE INTO evidence (evidence_id, decision_id, kind, quote, path,"
            " start_line, end_line, commit_sha, pr_number, url, author, created_at, verification)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                e.evidence_id,
                decision_id,
                e.kind,
                e.quote,
                e.path,
                e.start_line,
                e.end_line,
                e.commit_sha,
                e.pr_number,
                e.url,
                e.author,
                e.created_at,
                e.verification.value,
            ),
        )

    def _append(self, event: AuthorityEvent) -> None:
        self._db.execute(
            "INSERT INTO authority_log (decision_id, action, reason, signer, signer_kind, scope,"
            " evidence_ref, at) VALUES (?,?,?,?,?,?,?,?)",
            (
                event.decision_id,
                event.action.value,
                event.reason,
                event.signer,
                event.signer_kind.value,
                json.dumps(event.scope),
                event.evidence_ref,
                event.at,
            ),
        )

    def _hydrate(self, row: sqlite3.Row) -> Decision:
        data = dict(row)
        for key in _JSON_FIELDS:
            data[key] = json.loads(data[key] or "[]")
        data["pinned"] = bool(data["pinned"])
        for key in ("currency", "changed_fraction", "updated_at"):
            data.pop(key, None)
        evidence_rows = self._db.execute(
            "SELECT * FROM evidence WHERE decision_id = ? ORDER BY kind, path, start_line",
            (data["decision_id"],),
        ).fetchall()
        data["evidence"] = [
            Evidence(**{k: v for k, v in dict(r).items() if k != "decision_id"})
            for r in evidence_rows
        ]
        return Decision(**data)


def _require(event: AuthorityEvent, *, need_scope: bool, need_evidence: bool) -> None:
    missing: list[str] = []
    if not event.reason.strip():
        missing.append("no reason")
    if not event.signer.strip():
        missing.append("no signer")
    if need_scope and not event.scope:
        missing.append("no scope: name the files or modules it governs")
    if need_evidence and not event.evidence_ref:
        missing.append("no evidence reference")
    if missing:
        raise LedgerError("; ".join(missing))


def _is_sha(value: str | None) -> bool:
    if not value:
        return False
    return 7 <= len(value) <= 40 and all(c in "0123456789abcdef" for c in value.lower())


def _import_signer(decision: Decision) -> str:
    first = decision.evidence[0] if decision.evidence else None
    if first and first.path:
        return first.path
    if first and first.pr_number:
        return f"PR #{first.pr_number} merge"
    return decision.source.value


__all__ = ["LedgerError", "LedgerStore"]
