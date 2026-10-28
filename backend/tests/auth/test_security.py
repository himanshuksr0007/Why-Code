"""Auth crypto primitives: password hashing, OTP digests, JWT sessions."""

from __future__ import annotations

import time

from app.auth import security


def test_argon2_hash_roundtrip() -> None:
    stored = security.hash_password("correct horse 9")
    assert stored.startswith("$argon2id$")
    assert "correct horse 9" not in stored
    assert security.verify_password("correct horse 9", stored)
    assert not security.verify_password("correct horse 8", stored)


def test_pbkdf2_fallback_roundtrip(monkeypatch) -> None:
    monkeypatch.setattr(security, "_argon", None)
    stored = security.hash_password("fallback pass 1")
    assert stored.startswith("pbkdf2_sha256$600000$")
    assert security.verify_password("fallback pass 1", stored)
    assert not security.verify_password("fallback pass 2", stored)


def test_verify_rejects_garbage_hashes() -> None:
    assert not security.verify_password("x", "")
    assert not security.verify_password("x", "not-a-hash")
    assert not security.verify_password("x", "$argon2id$garbage")


def test_otp_digest_is_keyed_and_scoped() -> None:
    digest = security.hash_otp_code("s3cret", "a@example.com", "verify_email", "123456")
    assert digest != security.hash_otp_code("other", "a@example.com", "verify_email", "123456")
    assert digest != security.hash_otp_code("s3cret", "b@example.com", "verify_email", "123456")
    assert digest != security.hash_otp_code("s3cret", "a@example.com", "verify_email", "123457")
    assert security.otp_code_matches("s3cret", "a@example.com", "verify_email", "123456", digest)
    assert not security.otp_code_matches("s3cret", "a@example.com", "verify_email", "000000", digest)


def test_generated_codes_are_six_digits() -> None:
    for _ in range(50):
        code = security.generate_otp_code()
        assert len(code) == 6 and code.isdigit()


def test_token_roundtrip_and_claims() -> None:
    token = security.issue_token(
        "signing-key", user_id="usr_1", email="a@example.com", name="A", ttl_seconds=600
    )
    payload = security.verify_token("signing-key", token)
    assert payload is not None
    assert payload["sub"] == "usr_1"
    assert payload["email"] == "a@example.com"


def test_token_rejects_wrong_secret_tampering_and_expiry() -> None:
    token = security.issue_token(
        "signing-key", user_id="usr_1", email="a@example.com", name="A", ttl_seconds=600
    )
    assert security.verify_token("other-key", token) is None
    head, body, sig = token.split(".")
    assert security.verify_token("signing-key", f"{head}.{body}.AAAA{sig[4:]}") is None
    expired = security.issue_token(
        "signing-key", user_id="usr_1", email="a@example.com", name="A", ttl_seconds=-5
    )
    assert security.verify_token("signing-key", expired) is None
    assert security.verify_token("signing-key", "not.a.token") is None
    assert int(time.time()) > 0  # (clock sanity for the expiry assertions)
