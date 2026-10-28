"""Shared chat links: public links anyone can open, private links only
whitelisted account handles can open.

The owner publishes a snapshot of a conversation (chats otherwise live
only in the owner's browser). Access rules:

- public  → anyone with the link, signed in or not.
- private → the owner, plus signed-in users whose account handle is on
            the whitelist the owner maintains. Anonymous viewers get a
            "log in" answer (401, code ``login_required``); signed-in
            users who are not whitelisted get 403 ``not_whitelisted``.

Handles are normalized exactly like the frontend's ``handleFor``: the
email local part, lowercased, non ``[a-z0-9_]`` runs collapsed to ``_``,
edge underscores trimmed.
"""

from __future__ import annotations

import json
import logging
import os
import re
import secrets
from datetime import datetime, timezone
from typing import Callable

from app.shares.store import ShareRecord, ShareStore

logger = logging.getLogger("whycode.shares")

MAX_SNAPSHOT_BYTES = 1_500_000
MAX_TURNS = 200
MAX_WHITELIST = 50

_HANDLE_JUNK_RE = re.compile(r"[^a-z0-9_]+")


class ShareError(Exception):
    """A client-facing share failure with an HTTP status and a code."""

    def __init__(self, status: int, detail: str, *, code: str = ""):
        super().__init__(detail)
        self.status = status
        self.detail = detail
        self.code = code


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_handle(value: str) -> str:
    """Normalize a typed username/handle to the canonical account handle."""
    text = (value or "").strip().lstrip("@").lower()
    if "@" in text:  # a full email was typed — its local part is the handle
        text = text.split("@", 1)[0]
    text = _HANDLE_JUNK_RE.sub("_", text).strip("_")
    return text or "user"


def handle_for_email(email: str) -> str:
    return normalize_handle(email.split("@", 1)[0] if email else "")


def _clean_whitelist(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    for value in values or []:
        handle = normalize_handle(str(value))
        if handle and handle not in cleaned:
            cleaned.append(handle)
    return cleaned[:MAX_WHITELIST]


def _public_share(record: ShareRecord, *, include_turns: bool) -> dict:
    payload: dict = {
        "id": record.id,
        "title": record.title,
        "repo": record.repo,
        "visibility": record.visibility,
        "owner_name": record.owner_name,
        "owner_handle": record.owner_handle,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }
    if include_turns:
        try:
            snapshot = json.loads(record.snapshot or "{}")
            payload["turns"] = snapshot.get("turns", [])
        except ValueError:
            payload["turns"] = []
    return payload


class ShareService:
    def __init__(
        self,
        store: ShareStore,
        *,
        user_for_token: Callable[[str], dict | None],
    ) -> None:
        self._store = store
        self._user_for_token = user_for_token

    # -- helpers -------------------------------------------------------

    def _require_user(self, token: str) -> dict:
        user = self._user_for_token(token) if token else None
        if user is None:
            raise ShareError(
                401, "Log in to share chats.", code="login_required"
            )
        return user

    def _owner_handle(self, user: dict) -> str:
        return handle_for_email(str(user.get("email", "")))

    # -- owner operations ----------------------------------------------

    def publish(
        self,
        *,
        token: str,
        chat_id: str,
        title: str,
        repo: str,
        visibility: str,
        whitelist: list[str],
        turns: list[dict],
    ) -> dict:
        """Create or update the share for one of the owner's chats."""
        user = self._require_user(token)
        if visibility not in ("public", "private"):
            raise ShareError(
                422, "Visibility must be 'public' or 'private'.", code="bad_visibility"
            )
        if not chat_id:
            raise ShareError(422, "A chat id is required.", code="bad_chat")
        if len(turns) > MAX_TURNS:
            raise ShareError(422, "That chat is too long to share.", code="too_long")
        snapshot = json.dumps({"turns": turns})
        if len(snapshot.encode("utf-8")) > MAX_SNAPSHOT_BYTES:
            raise ShareError(
                413, "That chat is too large to share.", code="too_large"
            )
        existing = self._store.get_share_for_chat(str(user["id"]), chat_id)
        now = _now_iso()
        record = ShareRecord(
            id=existing.id if existing else secrets.token_urlsafe(9),
            owner_id=str(user["id"]),
            owner_name=str(user.get("name", "")),
            owner_handle=self._owner_handle(user),
            chat_id=chat_id,
            title=(title or "Shared chat")[:200],
            repo=(repo or "")[:200],
            visibility=visibility,
            whitelist=_clean_whitelist(whitelist),
            snapshot=snapshot,
            created_at=existing.created_at if existing else now,
            updated_at=now,
        )
        stored = self._store.upsert_share(record)
        payload = _public_share(stored, include_turns=False)
        payload["whitelist"] = stored.whitelist
        payload["chat_id"] = stored.chat_id
        return payload

    def my_share(self, *, token: str, chat_id: str) -> dict:
        """The owner's current share for a chat (dialog prefill)."""
        user = self._require_user(token)
        record = self._store.get_share_for_chat(str(user["id"]), chat_id)
        if record is None:
            raise ShareError(404, "This chat is not shared yet.", code="not_shared")
        payload = _public_share(record, include_turns=False)
        payload["whitelist"] = record.whitelist
        payload["chat_id"] = record.chat_id
        return payload

    def unpublish(self, *, token: str, share_id: str) -> None:
        user = self._require_user(token)
        if not self._store.delete_share(share_id, str(user["id"])):
            raise ShareError(404, "Share not found.", code="not_found")

    # -- viewer access ---------------------------------------------------

    def view(self, *, token: str, share_id: str) -> dict:
        record = self._store.get_share(share_id)
        if record is None:
            raise ShareError(404, "This link does not exist.", code="not_found")
        if record.visibility == "private":
            user = self._user_for_token(token) if token else None
            if user is None:
                raise ShareError(
                    401,
                    "This is a private chat. Log in to view it.",
                    code="login_required",
                )
            viewer_handle = self._owner_handle(user)
            is_owner = str(user["id"]) == record.owner_id
            if not is_owner and viewer_handle not in record.whitelist:
                raise ShareError(
                    403,
                    "You are not on this chat's whitelist. Ask the owner to"
                    f" add @{viewer_handle}.",
                    code="not_whitelisted",
                )
        return _public_share(record, include_turns=True)


def build_share_service(auth_service: object) -> ShareService:
    """Wire the store from the environment (Neo4j, else SQLite), with the
    auth service resolving bearer tokens to users. Same degrade-never-
    block pattern as the auth/model stores."""

    from app.shares.store import Neo4jShareStore, SQLiteShareStore

    def env(name: str) -> str:
        return os.environ.get(f"WHYCODE_{name}", "").strip()

    def user_for_token(token: str) -> dict | None:
        try:
            result = auth_service.me(token)  # type: ignore[attr-defined]
            return result.get("user")
        except Exception:  # noqa: BLE001 - any auth failure = anonymous
            return None

    store: ShareStore | None = None
    uri, user = env("NEO4J_URI"), env("NEO4J_USER")
    password = env("NEO4J_PASSWORD")
    if uri and user and password:
        try:
            from app.graph.neo4j_driver import Neo4jClient

            client = Neo4jClient.connect(
                uri=uri,
                database=env("NEO4J_DATABASE") or "neo4j",
                user=user,
                password=password,
            )
            client.verify_connectivity()
            store = Neo4jShareStore(client)
            logger.info("Share store: Neo4j at %s", uri)
        except Exception as exc:  # noqa: BLE001 - degrade, never block startup
            logger.warning("Share store: Neo4j unavailable (%s); using SQLite", exc)
    if store is None:
        db_path = env("SHARE_DB") or env("AUTH_DB") or "artifacts/auth.db"
        store = SQLiteShareStore(db_path)
        logger.info("Share store: SQLite at %s", db_path)
    return ShareService(store, user_for_token=user_for_token)
