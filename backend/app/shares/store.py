"""Persistence for shared chats: Neo4j in production, SQLite fallback.

A share is a snapshot of one conversation plus its access rule:
- ``public``: anyone with the link can view it.
- ``private``: only the owner and the whitelisted account handles can.

Handles are the account handles the site shows (the sanitized email
local part — see ``normalize_handle`` in the service), so a whitelist
entry is exactly the ``@handle`` a user sees in their profile bubble.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol


@dataclass(frozen=True)
class ShareRecord:
    id: str
    owner_id: str
    owner_name: str
    owner_handle: str
    chat_id: str
    title: str
    repo: str
    visibility: str  # "public" | "private"
    whitelist: list[str] = field(default_factory=list)
    snapshot: str = "{}"  # JSON: {"turns": [...]}
    created_at: str = ""
    updated_at: str = ""


class ShareStore(Protocol):
    def upsert_share(self, record: ShareRecord) -> ShareRecord: ...

    def get_share(self, share_id: str) -> ShareRecord | None: ...

    def get_share_for_chat(self, owner_id: str, chat_id: str) -> ShareRecord | None: ...

    def delete_share(self, share_id: str, owner_id: str) -> bool: ...


def _record_from_row(row: dict[str, Any]) -> ShareRecord:
    whitelist = row.get("whitelist") or []
    if isinstance(whitelist, str):
        try:
            whitelist = json.loads(whitelist)
        except ValueError:
            whitelist = []
    return ShareRecord(
        id=str(row["id"]),
        owner_id=str(row["owner_id"]),
        owner_name=str(row.get("owner_name") or ""),
        owner_handle=str(row.get("owner_handle") or ""),
        chat_id=str(row.get("chat_id") or ""),
        title=str(row.get("title") or "Shared chat"),
        repo=str(row.get("repo") or ""),
        visibility=str(row.get("visibility") or "public"),
        whitelist=[str(h) for h in whitelist],
        snapshot=str(row.get("snapshot") or "{}"),
        created_at=str(row.get("created_at") or ""),
        updated_at=str(row.get("updated_at") or ""),
    )


class SQLiteShareStore:
    """The fallback store: a local file, same degrade pattern as auth."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._lock = threading.Lock()
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock, self._conn:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS shares (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    owner_name TEXT NOT NULL DEFAULT '',
                    owner_handle TEXT NOT NULL DEFAULT '',
                    chat_id TEXT NOT NULL DEFAULT '',
                    title TEXT NOT NULL DEFAULT '',
                    repo TEXT NOT NULL DEFAULT '',
                    visibility TEXT NOT NULL DEFAULT 'public',
                    whitelist TEXT NOT NULL DEFAULT '[]',
                    snapshot TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL DEFAULT '',
                    UNIQUE (owner_id, chat_id)
                );
                """
            )

    def upsert_share(self, record: ShareRecord) -> ShareRecord:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO shares (id, owner_id, owner_name, owner_handle,"
                " chat_id, title, repo, visibility, whitelist, snapshot,"
                " created_at, updated_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                " ON CONFLICT(owner_id, chat_id) DO UPDATE SET"
                " title = excluded.title, repo = excluded.repo,"
                " visibility = excluded.visibility,"
                " whitelist = excluded.whitelist,"
                " snapshot = excluded.snapshot,"
                " updated_at = excluded.updated_at",
                (
                    record.id,
                    record.owner_id,
                    record.owner_name,
                    record.owner_handle,
                    record.chat_id,
                    record.title,
                    record.repo,
                    record.visibility,
                    json.dumps(record.whitelist),
                    record.snapshot,
                    record.created_at,
                    record.updated_at,
                ),
            )
        stored = self.get_share_for_chat(record.owner_id, record.chat_id)
        return stored or record

    def get_share(self, share_id: str) -> ShareRecord | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM shares WHERE id = ?", (share_id,)
            ).fetchone()
        return _record_from_row(dict(row)) if row is not None else None

    def get_share_for_chat(self, owner_id: str, chat_id: str) -> ShareRecord | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM shares WHERE owner_id = ? AND chat_id = ?",
                (owner_id, chat_id),
            ).fetchone()
        return _record_from_row(dict(row)) if row is not None else None

    def delete_share(self, share_id: str, owner_id: str) -> bool:
        with self._lock, self._conn:
            cursor = self._conn.execute(
                "DELETE FROM shares WHERE id = ? AND owner_id = ?",
                (share_id, owner_id),
            )
        return cursor.rowcount > 0


class Neo4jShareStore:
    """The production store: (:Share) nodes, one per (owner, chat)."""

    def __init__(self, client: Any) -> None:
        self._client = client
        client.run(
            "CREATE CONSTRAINT whycode_share_id IF NOT EXISTS"
            " FOR (s:Share) REQUIRE s.id IS UNIQUE"
        )
        client.run(
            "CREATE INDEX whycode_share_owner_chat IF NOT EXISTS"
            " FOR (s:Share) ON (s.owner_id, s.chat_id)"
        )

    def upsert_share(self, record: ShareRecord) -> ShareRecord:
        self._client.run(
            "MERGE (s:Share {owner_id: $owner_id, chat_id: $chat_id})"
            " ON CREATE SET s.id = $id, s.created_at = $created_at"
            " SET s.owner_name = $owner_name, s.owner_handle = $owner_handle,"
            " s.title = $title, s.repo = $repo, s.visibility = $visibility,"
            " s.whitelist = $whitelist, s.snapshot = $snapshot,"
            " s.updated_at = $updated_at",
            id=record.id,
            owner_id=record.owner_id,
            owner_name=record.owner_name,
            owner_handle=record.owner_handle,
            chat_id=record.chat_id,
            title=record.title,
            repo=record.repo,
            visibility=record.visibility,
            whitelist=record.whitelist,
            snapshot=record.snapshot,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )
        stored = self.get_share_for_chat(record.owner_id, record.chat_id)
        return stored or record

    def get_share(self, share_id: str) -> ShareRecord | None:
        result = self._client.run(
            "MATCH (s:Share {id: $value}) RETURN s", value=share_id
        )
        row = result.single()
        return _record_from_row(dict(row["s"])) if row is not None else None

    def get_share_for_chat(self, owner_id: str, chat_id: str) -> ShareRecord | None:
        result = self._client.run(
            "MATCH (s:Share {owner_id: $owner_id, chat_id: $chat_id}) RETURN s",
            owner_id=owner_id,
            chat_id=chat_id,
        )
        row = result.single()
        return _record_from_row(dict(row["s"])) if row is not None else None

    def delete_share(self, share_id: str, owner_id: str) -> bool:
        result = self._client.run(
            "MATCH (s:Share {id: $id, owner_id: $owner_id})"
            " DELETE s RETURN count(s) AS removed",
            id=share_id,
            owner_id=owner_id,
        )
        row = result.single()
        return bool(row is not None and row["removed"])
