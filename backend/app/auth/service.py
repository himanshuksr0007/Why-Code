"""The authentication service: Clerk in front, app sessions behind it.

Identity is Clerk's job now (email + password, email codes, Google and
GitHub OAuth — verification mail, leaked-password screening, brute-force
protection). This service owns only what the app itself needs:

- the account records the rest of the product hangs off (shares address
  users by the account created here), and
- the app's own bearer-token sessions (see security.py).

The bridge between the two is `exchange_clerk_token`: the frontend
presents a Clerk session token, it is verified properly (see clerk.py),
and the caller gets a normal session for the account with the same
email. The email IS the identity — an address that arrives via Google,
GitHub or Clerk email sign-in always resolves to the same account here,
never a duplicate.
"""

from __future__ import annotations

import logging
import os
import re
import secrets
import threading
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from app.auth import security
from app.auth.store import AuthStore, UserRecord

logger = logging.getLogger("whycode.auth")

TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days

_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(moment: datetime) -> str:
    return moment.isoformat()


class AuthError(Exception):
    """A client-facing auth failure with an HTTP status and a stable code."""

    def __init__(self, status: int, detail: str, *, code: str = "", retry_after: int = 0):
        super().__init__(detail)
        self.status = status
        self.detail = detail
        self.code = code
        self.retry_after = retry_after


class RateLimiter:
    """In-process sliding-window limiter (single-instance deployments)."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def check(self, key: str, *, limit: int, window_seconds: int) -> int:
        """Record a hit; return 0 when allowed, else seconds to wait."""
        now = time.monotonic()
        with self._lock:
            hits = [t for t in self._hits[key] if now - t < window_seconds]
            if len(hits) >= limit:
                self._hits[key] = hits
                return max(1, int(window_seconds - (now - hits[0])) + 1)
            hits.append(now)
            self._hits[key] = hits
            return 0


def _public_user(user: UserRecord) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "email_verified": user.email_verified,
        "created_at": user.created_at,
    }


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_email(email: str) -> str:
    normalized = normalize_email(email)
    if len(normalized) > 254 or not _EMAIL_RE.match(normalized):
        raise AuthError(422, "Enter a valid email address.", code="invalid_email")
    return normalized


def validate_name(name: str) -> str:
    cleaned = name.strip()
    if not (1 <= len(cleaned) <= 80):
        raise AuthError(422, "Enter your name.", code="invalid_name")
    return cleaned


class AuthService:
    def __init__(
        self,
        store: AuthStore,
        *,
        secret: str,
        limiter: RateLimiter | None = None,
        clerk_publishable_key: str = "",
        clerk_secret_key: str = "",
    ) -> None:
        self._store = store
        self._secret = secret
        self._limiter = limiter or RateLimiter()
        self._clerk_publishable_key = clerk_publishable_key
        self._clerk_secret_key = clerk_secret_key

    # -- internal helpers ---------------------------------------------------

    def _session(self, user: UserRecord) -> dict:
        token = security.issue_token(
            self._secret,
            user_id=user.id,
            email=user.email,
            name=user.name,
            ttl_seconds=TOKEN_TTL_SECONDS,
        )
        return {"token": token, "user": _public_user(user)}

    # -- flows ---------------------------------------------------------------

    def social_login(self, *, email: str, name: str, provider: str, client_ip: str) -> dict:
        """Find-or-create the account for a Clerk-verified email and
        issue a normal session. Called only with an email Clerk has
        already verified (OAuth profile or confirmed email sign-in), so
        the account is created verified.
        """
        email = validate_email(email)
        retry = self._limiter.check(
            f"social:{client_ip}:{email}", limit=20, window_seconds=900
        )
        if retry:
            raise AuthError(
                429,
                "Too many sign-in attempts. Wait a few minutes and try again.",
                code="rate_limited",
                retry_after=retry,
            )
        try:
            name = validate_name(name)
        except AuthError:
            name = email.split("@")[0]
        user = self._store.get_user_by_email(email)
        if user is not None:
            updated = self._store.update_user(
                user.id,
                email_verified=True,
                last_login_at=_iso(_now()),
                updated_at=_iso(_now()),
            )
            return self._session(updated or user)
        moment = _iso(_now())
        user = self._store.create_user(
            UserRecord(
                id=f"usr_{uuid.uuid4().hex}",
                name=name,
                email=email,
                # Passwords live in Clerk now. The stored hash is of a
                # random secret nobody knows; it exists only because the
                # record schema predates the migration.
                password_hash=security.hash_password(uuid.uuid4().hex),
                email_verified=True,
                created_at=moment,
                updated_at=moment,
                last_login_at=moment,
            )
        )
        logger.info("Clerk sign-in created account for %s via %s", email, provider or "clerk")
        return self._session(user)

    def exchange_clerk_token(self, *, token: str, client_ip: str) -> dict:
        """Verify a Clerk session token and exchange it for a session."""
        from app.auth import clerk

        if not self._clerk_publishable_key or not self._clerk_secret_key:
            raise AuthError(
                503,
                "Sign-in is not configured on this server yet.",
                code="social_not_configured",
            )
        issuer = clerk.issuer_from_publishable_key(self._clerk_publishable_key)
        if issuer is None:
            raise AuthError(
                503,
                "Sign-in is misconfigured on this server.",
                code="social_not_configured",
            )
        try:
            claims = clerk.verify_session_token(token, issuer=issuer)
            profile = clerk.fetch_clerk_user(
                str(claims["sub"]), secret_key=self._clerk_secret_key
            )
        except clerk.ClerkError as exc:
            raise AuthError(exc.status, exc.detail, code=exc.code) from None
        return self.social_login(
            email=profile["email"],
            name=profile["name"],
            provider=profile["provider"],
            client_ip=client_ip,
        )

    def me(self, token: str) -> dict:
        payload = security.verify_token(self._secret, token)
        if payload is None:
            raise AuthError(401, "Your session has expired. Log in again.", code="no_session")
        user = self._store.get_user_by_id(str(payload.get("sub", "")))
        if user is None:
            raise AuthError(401, "Your session has expired. Log in again.", code="no_session")
        return {"user": _public_user(user)}


def build_auth_service() -> AuthService:
    """Wire the store from the environment: Neo4j when its variables are
    configured (and reachable), the SQLite file store otherwise — the
    same degrade-never-block pattern as the model store.
    """
    from app.auth.store import Neo4jAuthStore, SQLiteAuthStore

    def env(name: str) -> str:
        return os.environ.get(f"WHYCODE_{name}", "").strip()

    store: AuthStore | None = None
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
            store = Neo4jAuthStore(client)
            logger.info("Auth store: Neo4j at %s", uri)
        except Exception as exc:  # noqa: BLE001 - degrade, never block startup
            logger.warning("Auth store: Neo4j unavailable (%s); using SQLite", exc)
    if store is None:
        db_path = env("AUTH_DB") or "artifacts/auth.db"
        store = SQLiteAuthStore(db_path)
        logger.info("Auth store: SQLite at %s", db_path)

    secret = env("AUTH_SECRET")
    if not secret:
        secret = secrets.token_hex(32)
        logger.warning(
            "WHYCODE_AUTH_SECRET is not set — generated an ephemeral secret;"
            " sessions will not survive a restart"
        )
    clerk_publishable = env("CLERK_PUBLISHABLE_KEY") or os.environ.get(
        "CLERK_PUBLISHABLE_KEY", ""
    ).strip()
    clerk_secret = env("CLERK_SECRET_KEY") or os.environ.get(
        "CLERK_SECRET_KEY", ""
    ).strip()
    if clerk_publishable and clerk_secret:
        logger.info("Clerk sign-in configured")
    return AuthService(
        store,
        secret=secret,
        clerk_publishable_key=clerk_publishable,
        clerk_secret_key=clerk_secret,
    )
