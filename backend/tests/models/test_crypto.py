"""KeyCipher: keys round-trip, wrong master keys and tampering fail."""

from __future__ import annotations

import pytest
from cryptography.fernet import Fernet

from app.models.crypto import KeyCipher


def _cipher() -> KeyCipher:
    return KeyCipher(Fernet(Fernet.generate_key()))


def test_roundtrip() -> None:
    cipher = _cipher()
    token = cipher.encrypt("sk-secret-123")
    assert token != "sk-secret-123"
    assert cipher.decrypt(token) == "sk-secret-123"


def test_wrong_master_key_cannot_decrypt() -> None:
    token = _cipher().encrypt("sk-secret-123")
    with pytest.raises(ValueError):
        _cipher().decrypt(token)


def test_tampered_token_cannot_decrypt() -> None:
    cipher = _cipher()
    token = cipher.encrypt("sk-secret-123")
    with pytest.raises(ValueError):
        cipher.decrypt(token[:-4] + "AAAA")


def test_from_env_rejects_a_malformed_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WHYCODE_SECRET_KEY", "not-a-fernet-key")
    with pytest.raises(ValueError):
        KeyCipher.from_env()


def test_from_env_without_key_is_ephemeral(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("WHYCODE_SECRET_KEY", raising=False)
    assert KeyCipher.from_env().ephemeral is True
