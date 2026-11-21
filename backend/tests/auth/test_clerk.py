"""Clerk token verification: JWKS signature, issuer pinning, expiry."""

from __future__ import annotations

import base64
import json
import time

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from app.auth import clerk


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


@pytest.fixture()
def keypair(monkeypatch):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = private.public_key().public_numbers()
    jwks = {
        "keys": [
            {
                "kid": "key_1",
                "kty": "RSA",
                "n": _b64(public.n.to_bytes((public.n.bit_length() + 7) // 8, "big")),
                "e": _b64(public.e.to_bytes((public.e.bit_length() + 7) // 8, "big")),
            }
        ]
    }
    monkeypatch.setattr(clerk, "_fetch_jwks", lambda issuer: jwks)
    return private


def _sign(private, claims: dict, kid: str = "key_1") -> str:
    header = {"alg": "RS256", "kid": kid, "typ": "JWT"}
    signing_input = (
        f"{_b64(json.dumps(header).encode())}.{_b64(json.dumps(claims).encode())}"
    )
    signature = private.sign(
        signing_input.encode(), padding.PKCS1v15(), hashes.SHA256()
    )
    return f"{signing_input}.{_b64(signature)}"


ISSUER = "https://clerk.example.com"


def _claims(**overrides):
    now = int(time.time())
    base = {"sub": "user_123", "iss": ISSUER, "iat": now, "exp": now + 600, "nbf": now - 10}
    base.update(overrides)
    return base


def test_issuer_from_publishable_key() -> None:
    encoded = base64.b64encode(b"funny-llama-42.clerk.accounts.dev$").decode()
    assert (
        clerk.issuer_from_publishable_key(f"pk_test_{encoded}")
        == "https://funny-llama-42.clerk.accounts.dev"
    )
    assert clerk.issuer_from_publishable_key("not-a-key") is None
    assert clerk.issuer_from_publishable_key("") is None


def test_verify_accepts_valid_token(keypair) -> None:
    token = _sign(keypair, _claims())
    claims = clerk.verify_session_token(token, issuer=ISSUER)
    assert claims["sub"] == "user_123"


def test_verify_rejects_wrong_issuer(keypair) -> None:
    token = _sign(keypair, _claims())
    with pytest.raises(clerk.ClerkError):
        clerk.verify_session_token(token, issuer="https://other.example.com")


def test_verify_rejects_expired_token(keypair) -> None:
    token = _sign(keypair, _claims(exp=int(time.time()) - 10))
    with pytest.raises(clerk.ClerkError) as exc:
        clerk.verify_session_token(token, issuer=ISSUER)
    assert exc.value.code == "social_expired"


def test_verify_rejects_tampered_payload(keypair) -> None:
    token = _sign(keypair, _claims())
    head, _payload, sig = token.split(".")
    forged = f"{head}.{_b64(json.dumps(_claims(sub='user_evil')).encode())}.{sig}"
    with pytest.raises(clerk.ClerkError):
        clerk.verify_session_token(forged, issuer=ISSUER)


def test_verify_rejects_unknown_kid(keypair) -> None:
    token = _sign(keypair, _claims(), kid="key_unknown")
    with pytest.raises(clerk.ClerkError):
        clerk.verify_session_token(token, issuer=ISSUER)
