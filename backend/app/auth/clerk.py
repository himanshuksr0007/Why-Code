"""Clerk session-token verification for the social sign-in bridge.

The frontend signs users in with Clerk (Google / GitHub OAuth). It then
sends the Clerk session token here; this module verifies it properly —
RS256 signature against the instance's JWKS, issuer pinned to the
configured Clerk instance, expiry checked — and resolves the token's
subject to a verified email address through the Clerk Backend API
(session tokens do not carry the email claim by default, and an email
supplied by the client must never be trusted on its own).

Only the token's ``sub`` is taken from the JWT; identity comes from
Clerk's API response, fetched with the server-side secret key.
"""

from __future__ import annotations

import base64
import json
import logging
import time
from typing import Any

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric import padding, rsa

logger = logging.getLogger("whycode.auth.clerk")

_JWKS_TTL_SECONDS = 3600
_jwks_cache: dict[str, tuple[float, dict[str, Any]]] = {}


class ClerkError(Exception):
    """Verification or lookup failed; ``code`` is safe to show clients."""

    def __init__(self, detail: str, *, code: str = "social_failed", status: int = 401):
        super().__init__(detail)
        self.detail = detail
        self.code = code
        self.status = status


def issuer_from_publishable_key(publishable_key: str) -> str | None:
    """pk_test_<base64(host$)> / pk_live_<base64(host$)> -> https://host."""
    try:
        encoded = publishable_key.split("_", 2)[2]
        host = base64.b64decode(encoded).decode("utf-8").rstrip("$")
        if not host or "." not in host:
            return None
        return f"https://{host}"
    except Exception:
        return None


def _b64url_decode(segment: str) -> bytes:
    return base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4))


def _fetch_jwks(issuer: str) -> dict[str, Any]:
    now = time.time()
    cached = _jwks_cache.get(issuer)
    if cached and now - cached[0] < _JWKS_TTL_SECONDS:
        return cached[1]
    resp = httpx.get(f"{issuer}/.well-known/jwks.json", timeout=10.0)
    resp.raise_for_status()
    jwks = resp.json()
    _jwks_cache[issuer] = (now, jwks)
    return jwks


def _public_key_for(jwks: dict[str, Any], kid: str) -> rsa.RSAPublicKey:
    for jwk in jwks.get("keys", []):
        if jwk.get("kid") != kid:
            continue
        n = int.from_bytes(_b64url_decode(jwk["n"]), "big")
        e = int.from_bytes(_b64url_decode(jwk["e"]), "big")
        return rsa.RSAPublicNumbers(e, n).public_key()
    raise ClerkError("Unknown signing key.", code="social_bad_token")


def verify_session_token(token: str, *, issuer: str) -> dict[str, Any]:
    """Verify a Clerk session JWT and return its claims."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ClerkError("Malformed session token.", code="social_bad_token")
    try:
        header = json.loads(_b64url_decode(parts[0]))
        claims = json.loads(_b64url_decode(parts[1]))
    except Exception:
        raise ClerkError("Malformed session token.", code="social_bad_token") from None
    if header.get("alg") != "RS256" or not header.get("kid"):
        raise ClerkError("Unexpected token header.", code="social_bad_token")
    if claims.get("iss") != issuer:
        raise ClerkError("Token was issued for a different application.", code="social_bad_token")
    now = int(time.time())
    if int(claims.get("exp", 0)) <= now:
        raise ClerkError("Session token has expired.", code="social_expired")
    if int(claims.get("nbf", 0)) > now + 60:
        raise ClerkError("Session token is not yet valid.", code="social_bad_token")
    try:
        jwks = _fetch_jwks(issuer)
    except Exception as exc:
        logger.warning("Clerk JWKS fetch failed: %s", exc)
        raise ClerkError("Could not verify the session right now.", code="social_unavailable", status=503) from None
    key = _public_key_for(jwks, str(header["kid"]))
    signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
    signature = _b64url_decode(parts[2])
    try:
        key.verify(signature, signing_input, padding.PKCS1v15(), _sha256())
    except InvalidSignature:
        raise ClerkError("Session token signature is invalid.", code="social_bad_token") from None
    if not claims.get("sub"):
        raise ClerkError("Session token has no subject.", code="social_bad_token")
    return claims


def _sha256():
    from cryptography.hazmat.primitives import hashes

    return hashes.SHA256()


def fetch_clerk_user(user_id: str, *, secret_key: str) -> dict[str, Any]:
    """Resolve a Clerk user id to {email, name, provider} via the API.

    The email returned is the user's primary address and only counts when
    Clerk reports it as verified.
    """
    try:
        resp = httpx.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {secret_key}"},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Clerk user lookup failed: %s", exc)
        raise ClerkError("Could not load the social profile right now.", code="social_unavailable", status=503) from None

    primary_id = data.get("primary_email_address_id")
    email = ""
    verified = False
    for entry in data.get("email_addresses", []) or []:
        if entry.get("id") == primary_id:
            email = str(entry.get("email_address", "")).strip().lower()
            verified = (entry.get("verification") or {}).get("status") == "verified"
            break
    if not email or not verified:
        raise ClerkError(
            "That social account has no verified email address.",
            code="social_email_unverified",
            status=422,
        )
    first = str(data.get("first_name") or "").strip()
    last = str(data.get("last_name") or "").strip()
    name = f"{first} {last}".strip() or str(data.get("username") or "") or email.split("@")[0]
    provider = ""
    for account in data.get("external_accounts", []) or []:
        provider = str(account.get("provider", ""))
        if provider:
            break
    return {"email": email, "name": name, "provider": provider}
