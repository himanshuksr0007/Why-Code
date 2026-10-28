"""The authentication service: signup with email OTP verification,
password login, and bearer-token sessions.

Security posture:
- Passwords are stored only as Argon2id/PBKDF2 hashes (see security.py).
- OTP codes are 6 digits, stored only as HMAC digests, expire after 10
  minutes, are single-use, allow at most 5 guesses, and can be re-sent at
  most once a minute (5 per hour) per address.
- Login answers are generic ("invalid email or password") and a dummy
  hash verification runs for unknown accounts, so neither the response
  nor its timing reveals whether an email is registered.
- Signup, login and OTP endpoints are rate limited per IP / email.
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
from datetime import datetime, timedelta, timezone

from app.auth import security
from app.auth.mailer import Mailer, build_mailer
from app.auth.store import AuthStore, OtpRecord, UserRecord

logger = logging.getLogger("whycode.auth")

OTP_PURPOSE_VERIFY = "verify_email"
OTP_TTL = timedelta(minutes=10)
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
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


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise AuthError(
            422, "Password must be at least 8 characters.", code="weak_password"
        )
    if len(password) > 128:
        raise AuthError(422, "Password is too long.", code="weak_password")
    if not (any(c.isalpha() for c in password) and any(c.isdigit() for c in password)):
        raise AuthError(
            422,
            "Password must contain at least one letter and one digit.",
            code="weak_password",
        )


def validate_name(name: str) -> str:
    cleaned = name.strip()
    if not (1 <= len(cleaned) <= 80):
        raise AuthError(422, "Enter your name.", code="invalid_name")
    return cleaned


class AuthService:
    def __init__(
        self,
        store: AuthStore,
        mailer: Mailer,
        *,
        secret: str,
        limiter: RateLimiter | None = None,
    ) -> None:
        self._store = store
        self._mailer = mailer
        self._secret = secret
        self._limiter = limiter or RateLimiter()

    # -- internal helpers ---------------------------------------------------

    def _issue_otp(self, email: str) -> None:
        """Create a fresh challenge for the email and mail the code."""
        moment = _now()
        code = security.generate_otp_code()
        self._store.save_otp(
            OtpRecord(
                email=email,
                purpose=OTP_PURPOSE_VERIFY,
                code_hash=security.hash_otp_code(
                    self._secret, email, OTP_PURPOSE_VERIFY, code
                ),
                created_at=_iso(moment),
                expires_at=_iso(moment + OTP_TTL),
                attempts=0,
            )
        )
        try:
            self._mailer.send_otp(email, code, purpose=OTP_PURPOSE_VERIFY)
        except Exception as exc:  # noqa: BLE001 - surfaced as a clean 502
            logger.error("Could not send verification email to %s: %s", email, exc)
            raise AuthError(
                502,
                "We could not send the verification email. Check the address"
                " and try again in a minute.",
                code="mail_failed",
            ) from exc

    def _check_otp_send_limits(self, email: str) -> None:
        # Cooldown derives from the live challenge so a resend cannot be
        # spammed even across limiter restarts.
        existing = self._store.get_otp(email, OTP_PURPOSE_VERIFY)
        if existing is not None and existing.created_at:
            created = datetime.fromisoformat(existing.created_at)
            elapsed = (_now() - created).total_seconds()
            if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
                raise AuthError(
                    429,
                    "A code was just sent. Wait a moment before asking for another.",
                    code="otp_cooldown",
                    retry_after=int(OTP_RESEND_COOLDOWN_SECONDS - elapsed) + 1,
                )
        retry = self._limiter.check(
            f"otp-send:{email}", limit=5, window_seconds=3600
        )
        if retry:
            raise AuthError(
                429,
                "Too many codes requested for this email. Try again later.",
                code="rate_limited",
                retry_after=retry,
            )

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

    def signup(self, *, name: str, email: str, password: str, client_ip: str) -> dict:
        retry = self._limiter.check(
            f"signup:{client_ip}", limit=10, window_seconds=3600
        )
        if retry:
            raise AuthError(
                429, "Too many signups from this network.", code="rate_limited",
                retry_after=retry,
            )
        name = validate_name(name)
        email = validate_email(email)
        validate_password(password)

        existing = self._store.get_user_by_email(email)
        if existing is not None and existing.email_verified:
            raise AuthError(
                409,
                "An account with this email already exists. Log in instead.",
                code="account_exists",
            )
        self._check_otp_send_limits(email)
        password_hash = security.hash_password(password)
        if existing is not None:
            # An earlier signup never finished verification: refresh the
            # credentials and send a fresh code.
            self._store.update_user(
                existing.id,
                name=name,
                password_hash=password_hash,
                updated_at=_iso(_now()),
            )
        else:
            moment = _iso(_now())
            self._store.create_user(
                UserRecord(
                    id=f"usr_{uuid.uuid4().hex}",
                    name=name,
                    email=email,
                    password_hash=password_hash,
                    email_verified=False,
                    created_at=moment,
                    updated_at=moment,
                )
            )
        self._issue_otp(email)
        return {"email": email, "otp_sent": True}

    def verify_email(self, *, email: str, code: str) -> dict:
        email = validate_email(email)
        code = code.strip()
        if not (len(code) == 6 and code.isdigit()):
            raise AuthError(422, "Enter the 6-digit code.", code="invalid_code")
        challenge = self._store.get_otp(email, OTP_PURPOSE_VERIFY)
        if challenge is None:
            raise AuthError(
                400,
                "No verification is pending for this email. Sign up or ask"
                " for a new code.",
                code="no_pending_code",
            )
        if challenge.attempts >= OTP_MAX_ATTEMPTS:
            self._store.delete_otp(email, OTP_PURPOSE_VERIFY)
            raise AuthError(
                400,
                "Too many wrong codes — the code has been cancelled. Ask for"
                " a new one.",
                code="too_many_attempts",
            )
        if challenge.expires_at and datetime.fromisoformat(challenge.expires_at) <= _now():
            self._store.delete_otp(email, OTP_PURPOSE_VERIFY)
            raise AuthError(
                400, "That code has expired. Ask for a new one.", code="code_expired"
            )
        if not security.otp_code_matches(
            self._secret, email, OTP_PURPOSE_VERIFY, code, challenge.code_hash
        ):
            attempts = self._store.increment_otp_attempts(email, OTP_PURPOSE_VERIFY)
            remaining = OTP_MAX_ATTEMPTS - attempts
            raise AuthError(
                400,
                f"That code does not match. {remaining} attempt"
                f"{'' if remaining == 1 else 's'} left."
                if remaining > 0
                else "That code does not match.",
                code="code_mismatch",
            )
        user = self._store.get_user_by_email(email)
        if user is None:  # challenge without an account: treat as stale
            self._store.delete_otp(email, OTP_PURPOSE_VERIFY)
            raise AuthError(400, "No account is waiting for this code.", code="no_account")
        self._store.delete_otp(email, OTP_PURPOSE_VERIFY)
        updated = self._store.update_user(
            user.id, email_verified=True, updated_at=_iso(_now())
        )
        return self._session(updated or user)

    def resend_otp(self, *, email: str) -> dict:
        """Always answers the same way; only unverified accounts get mail."""
        email = validate_email(email)
        user = self._store.get_user_by_email(email)
        if user is not None and not user.email_verified:
            self._check_otp_send_limits(email)
            self._issue_otp(email)
        return {"email": email, "otp_sent": True}

    def login(self, *, email: str, password: str, client_ip: str) -> dict:
        email = validate_email(email)
        retry = self._limiter.check(
            f"login:{client_ip}:{email}", limit=10, window_seconds=900
        )
        if retry:
            raise AuthError(
                429,
                "Too many login attempts. Wait a few minutes and try again.",
                code="rate_limited",
                retry_after=retry,
            )
        user = self._store.get_user_by_email(email)
        if user is None:
            security.verify_password(password, security.DUMMY_PASSWORD_HASH)
            raise AuthError(
                401, "Invalid email or password.", code="invalid_credentials"
            )
        if not security.verify_password(password, user.password_hash):
            raise AuthError(
                401, "Invalid email or password.", code="invalid_credentials"
            )
        if not user.email_verified:
            raise AuthError(
                403,
                "Verify your email first — enter the code we sent you.",
                code="email_not_verified",
            )
        updated = self._store.update_user(user.id, last_login_at=_iso(_now()))
        return self._session(updated or user)

    def me(self, token: str) -> dict:
        payload = security.verify_token(self._secret, token)
        if payload is None:
            raise AuthError(401, "Your session has expired. Log in again.", code="no_session")
        user = self._store.get_user_by_id(str(payload.get("sub", "")))
        if user is None:
            raise AuthError(401, "Your session has expired. Log in again.", code="no_session")
        return {"user": _public_user(user)}


def build_auth_service() -> AuthService:
    """Wire the store + mailer from the environment: Neo4j when its
    variables are configured (and reachable), the SQLite file store
    otherwise — the same degrade-never-block pattern as the model store.
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
            " sessions and pending OTPs will not survive a restart"
        )
    return AuthService(store, build_mailer(), secret=secret)
