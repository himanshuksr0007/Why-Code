"""Cryptographic primitives for user authentication.

Passwords are *hashed*, never encrypted: a one-way Argon2id hash (with a
PBKDF2-HMAC-SHA256 fallback when argon2-cffi is unavailable) means a
database leak never exposes a recoverable password. One-time codes are
stored as HMAC digests keyed by the server secret, so a leaked challenge
row cannot be brute-forced offline without the secret either.

Session tokens are HS256 JSON Web Tokens signed with the server secret,
implemented on the standard library so the auth package has no extra
runtime dependency beyond argon2-cffi.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

_PBKDF2_ITERATIONS = 600_000
_PBKDF2_PREFIX = "pbkdf2_sha256"

try:  # Preferred hasher: Argon2id (OWASP first choice).
    from argon2 import PasswordHasher
    from argon2.exceptions import InvalidHashError, VerifyMismatchError

    _argon = PasswordHasher()  # defaults: argon2id, 64 MiB, t=3, p=4
except Exception:  # noqa: BLE001 - any import problem degrades to PBKDF2
    _argon = None


def hash_password(password: str) -> str:
    if _argon is not None:
        return _argon.hash(password)
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return "$".join(
        (
            _PBKDF2_PREFIX,
            str(_PBKDF2_ITERATIONS),
            base64.b64encode(salt).decode("ascii"),
            base64.b64encode(digest).decode("ascii"),
        )
    )


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return False
    if stored_hash.startswith("$argon2"):
        if _argon is None:
            return False
        try:
            return _argon.verify(stored_hash, password)
        except (VerifyMismatchError, InvalidHashError):
            return False
        except Exception:  # noqa: BLE001 - a malformed hash never authenticates
            return False
    if stored_hash.startswith(_PBKDF2_PREFIX + "$"):
        try:
            _, iterations, salt_b64, digest_b64 = stored_hash.split("$", 3)
            salt = base64.b64decode(salt_b64)
            expected = base64.b64decode(digest_b64)
            candidate = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), salt, int(iterations)
            )
        except Exception:  # noqa: BLE001
            return False
        return hmac.compare_digest(candidate, expected)
    return False


# A real hash of a throwaway password, verified against when the account
# does not exist so login timing does not reveal registered emails.
DUMMY_PASSWORD_HASH = hash_password("whycode-dummy-password-for-timing")


# ---------------------------------------------------------------------------
# One-time codes
# ---------------------------------------------------------------------------


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp_code(secret: str, email: str, purpose: str, code: str) -> str:
    message = f"{email.strip().lower()}:{purpose}:{code}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def otp_code_matches(secret: str, email: str, purpose: str, code: str, stored: str) -> bool:
    return hmac.compare_digest(hash_otp_code(secret, email, purpose, code), stored)


# ---------------------------------------------------------------------------
# Session tokens (HS256 JWT, stdlib)
# ---------------------------------------------------------------------------


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def issue_token(secret: str, *, user_id: str, email: str, name: str, ttl_seconds: int) -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "iss": "whycode",
        "iat": now,
        "exp": now + ttl_seconds,
    }
    signing_input = ".".join(
        (
            _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
        )
    )
    signature = hmac.new(
        secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{signing_input}.{_b64url_encode(signature)}"


def verify_token(secret: str, token: str) -> dict | None:
    """Return the payload of a valid, unexpired HS256 token, else None."""
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        header = json.loads(_b64url_decode(header_b64))
        if header.get("alg") != "HS256":
            return None
        signing_input = f"{header_b64}.{payload_b64}"
        expected = hmac.new(
            secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(expected, _b64url_decode(signature_b64)):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if payload.get("iss") != "whycode":
            return None
        if int(payload.get("exp", 0)) <= int(time.time()):
            return None
        return payload
    except Exception:  # noqa: BLE001 - any malformation means "not a session"
        return None
