"""Persistence for user accounts and OTP challenges.

Two stores share one protocol:

- :class:`Neo4jAuthStore` — the production store. Users live as
  ``(:User)`` nodes (email unique) and verification challenges as
  ``(:OtpChallenge)`` nodes in the same Neo4j database as the code
  graph. Only password *hashes* and OTP *digests* are stored.
- :class:`SQLiteAuthStore` — the same contract on a local SQLite file,
  used when Neo4j is not configured (offline demo, tests). Accounts
  survive restarts, unlike an in-memory store.
"""

from __future__ import annotations

import sqlite3
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol


@dataclass(frozen=True)
class UserRecord:
    id: str
    name: str
    email: str
    password_hash: str = field(repr=False)
    email_verified: bool = False
    created_at: str = ""
    updated_at: str = ""
    last_login_at: str = ""


@dataclass(frozen=True)
class OtpRecord:
    email: str
    purpose: str
    code_hash: str = field(repr=False)
    created_at: str = ""
    expires_at: str = ""
    attempts: int = 0


class AuthStore(Protocol):
    def create_user(self, record: UserRecord) -> UserRecord: ...

    def get_user_by_email(self, email: str) -> UserRecord | None: ...

    def get_user_by_id(self, user_id: str) -> UserRecord | None: ...

    def update_user(self, user_id: str, **fields: Any) -> UserRecord | None: ...

    def save_otp(self, record: OtpRecord) -> OtpRecord: ...

    def get_otp(self, email: str, purpose: str) -> OtpRecord | None: ...

    def increment_otp_attempts(self, email: str, purpose: str) -> int: ...

    def delete_otp(self, email: str, purpose: str) -> None: ...


_USER_FIELDS = {
    "name",
    "password_hash",
    "email_verified",
    "updated_at",
    "last_login_at",
}


def _user_from_row(row: dict[str, Any]) -> UserRecord:
    return UserRecord(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        password_hash=row["password_hash"],
        email_verified=bool(row["email_verified"]),
        created_at=row.get("created_at") or "",
        updated_at=row.get("updated_at") or "",
        last_login_at=row.get("last_login_at") or "",
    )


def _otp_from_row(row: dict[str, Any]) -> OtpRecord:
    return OtpRecord(
        email=row["email"],
        purpose=row["purpose"],
        code_hash=row["code_hash"],
        created_at=row.get("created_at") or "",
        expires_at=row.get("expires_at") or "",
        attempts=int(row.get("attempts") or 0),
    )


class SQLiteAuthStore:
    def __init__(self, path: str) -> None:
        self._path = path
        self._lock = threading.Lock()
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock, self._conn:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    email_verified INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL DEFAULT '',
                    last_login_at TEXT NOT NULL DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS otp_challenges (
                    email TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    code_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT '',
                    expires_at TEXT NOT NULL DEFAULT '',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (email, purpose)
                );
                """
            )

    def create_user(self, record: UserRecord) -> UserRecord:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO users (id, name, email, password_hash, email_verified,"
                " created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    record.id,
                    record.name,
                    record.email,
                    record.password_hash,
                    1 if record.email_verified else 0,
                    record.created_at,
                    record.updated_at,
                    record.last_login_at,
                ),
            )
        return record

    def _get_user(self, where: str, value: str) -> UserRecord | None:
        with self._lock:
            row = self._conn.execute(
                f"SELECT * FROM users WHERE {where} = ?", (value,)  # noqa: S608 - fixed column
            ).fetchone()
        return _user_from_row(dict(row)) if row else None

    def get_user_by_email(self, email: str) -> UserRecord | None:
        return self._get_user("email", email)

    def get_user_by_id(self, user_id: str) -> UserRecord | None:
        return self._get_user("id", user_id)

    def update_user(self, user_id: str, **fields: Any) -> UserRecord | None:
        updates = {k: v for k, v in fields.items() if k in _USER_FIELDS}
        if not updates:
            return self.get_user_by_id(user_id)
        assignments = ", ".join(f"{key} = ?" for key in updates)
        values = [
            (1 if value else 0) if isinstance(value, bool) else value
            for value in updates.values()
        ]
        with self._lock, self._conn:
            self._conn.execute(
                f"UPDATE users SET {assignments} WHERE id = ?", (*values, user_id)
            )
        return self.get_user_by_id(user_id)

    def save_otp(self, record: OtpRecord) -> OtpRecord:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT OR REPLACE INTO otp_challenges"
                " (email, purpose, code_hash, created_at, expires_at, attempts)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (
                    record.email,
                    record.purpose,
                    record.code_hash,
                    record.created_at,
                    record.expires_at,
                    record.attempts,
                ),
            )
        return record

    def get_otp(self, email: str, purpose: str) -> OtpRecord | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM otp_challenges WHERE email = ? AND purpose = ?",
                (email, purpose),
            ).fetchone()
        return _otp_from_row(dict(row)) if row else None

    def increment_otp_attempts(self, email: str, purpose: str) -> int:
        with self._lock, self._conn:
            self._conn.execute(
                "UPDATE otp_challenges SET attempts = attempts + 1"
                " WHERE email = ? AND purpose = ?",
                (email, purpose),
            )
            row = self._conn.execute(
                "SELECT attempts FROM otp_challenges WHERE email = ? AND purpose = ?",
                (email, purpose),
            ).fetchone()
        return int(row["attempts"]) if row else 0

    def delete_otp(self, email: str, purpose: str) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "DELETE FROM otp_challenges WHERE email = ? AND purpose = ?",
                (email, purpose),
            )


class Neo4jAuthStore:
    """The production store: (:User) and (:OtpChallenge) nodes."""

    def __init__(self, client: Any) -> None:
        self._client = client
        client.run(
            "CREATE CONSTRAINT whycode_user_email IF NOT EXISTS"
            " FOR (u:User) REQUIRE u.email IS UNIQUE"
        )
        client.run(
            "CREATE INDEX whycode_otp_email IF NOT EXISTS"
            " FOR (o:OtpChallenge) ON (o.email)"
        )

    def create_user(self, record: UserRecord) -> UserRecord:
        self._client.run(
            "CREATE (u:User {id: $id, name: $name, email: $email,"
            " password_hash: $password_hash, email_verified: $email_verified,"
            " created_at: $created_at, updated_at: $updated_at,"
            " last_login_at: $last_login_at})",
            id=record.id,
            name=record.name,
            email=record.email,
            password_hash=record.password_hash,
            email_verified=record.email_verified,
            created_at=record.created_at,
            updated_at=record.updated_at,
            last_login_at=record.last_login_at,
        )
        return record

    def _get_user(self, where: str, value: str) -> UserRecord | None:
        result = self._client.run(
            f"MATCH (u:User {{{where}: $value}}) RETURN u",  # noqa: S608 - fixed property
            value=value,
        )
        row = result.single()
        return _user_from_row(dict(row["u"])) if row is not None else None

    def get_user_by_email(self, email: str) -> UserRecord | None:
        return self._get_user("email", email)

    def get_user_by_id(self, user_id: str) -> UserRecord | None:
        return self._get_user("id", user_id)

    def update_user(self, user_id: str, **fields: Any) -> UserRecord | None:
        updates = {k: v for k, v in fields.items() if k in _USER_FIELDS}
        if not updates:
            return self.get_user_by_id(user_id)
        assignments = ", ".join(f"u.{key} = ${key}" for key in updates)
        self._client.run(
            f"MATCH (u:User {{id: $id}}) SET {assignments}",
            id=user_id,
            **updates,
        )
        return self.get_user_by_id(user_id)

    def save_otp(self, record: OtpRecord) -> OtpRecord:
        self._client.run(
            "MERGE (o:OtpChallenge {email: $email, purpose: $purpose})"
            " SET o.code_hash = $code_hash, o.created_at = $created_at,"
            " o.expires_at = $expires_at, o.attempts = $attempts",
            email=record.email,
            purpose=record.purpose,
            code_hash=record.code_hash,
            created_at=record.created_at,
            expires_at=record.expires_at,
            attempts=record.attempts,
        )
        return record

    def get_otp(self, email: str, purpose: str) -> OtpRecord | None:
        result = self._client.run(
            "MATCH (o:OtpChallenge {email: $email, purpose: $purpose}) RETURN o",
            email=email,
            purpose=purpose,
        )
        row = result.single()
        return _otp_from_row(dict(row["o"])) if row is not None else None

    def increment_otp_attempts(self, email: str, purpose: str) -> int:
        result = self._client.run(
            "MATCH (o:OtpChallenge {email: $email, purpose: $purpose})"
            " SET o.attempts = o.attempts + 1 RETURN o.attempts AS attempts",
            email=email,
            purpose=purpose,
        )
        row = result.single()
        return int(row["attempts"]) if row is not None else 0

    def delete_otp(self, email: str, purpose: str) -> None:
        self._client.run(
            "MATCH (o:OtpChallenge {email: $email, purpose: $purpose}) DELETE o",
            email=email,
            purpose=purpose,
        )
