"""Encryption for user-supplied LLM API keys at rest.

Custom-model API keys are encrypted with Fernet (AES-128-CBC with an HMAC)
before they are written to Neo4j, using a master key that only ever lives
in the ``WHYCODE_SECRET_KEY`` environment variable. The database stores
ciphertext tokens; a plaintext key exists in process memory only briefly,
while a request is being answered.
"""

from __future__ import annotations

import logging
import os

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("whycode")

_ENV_NAME = "WHYCODE_SECRET_KEY"


class KeyCipher:
    """Encrypt and decrypt short secrets with the process master key."""

    def __init__(self, fernet: Fernet, *, ephemeral: bool = False) -> None:
        self._fernet = fernet
        self.ephemeral = ephemeral

    @classmethod
    def from_env(cls) -> KeyCipher:
        raw = os.environ.get(_ENV_NAME, "").strip()
        if raw:
            try:
                return cls(Fernet(raw.encode("ascii")))
            except (ValueError, TypeError) as error:
                raise ValueError(
                    f"{_ENV_NAME} is not a valid Fernet key; generate one with: "
                    "python -c \"from cryptography.fernet import Fernet; "
                    "print(Fernet.generate_key().decode())\""
                ) from error
        logger.warning(
            "%s is not set; using an ephemeral key. Custom-model keys saved "
            "during this run will be unreadable after a restart.",
            _ENV_NAME,
        )
        return cls(Fernet(Fernet.generate_key()), ephemeral=True)

    @staticmethod
    def generate_key() -> str:
        return Fernet.generate_key().decode("ascii")

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode("utf-8")).decode("ascii")

    def decrypt(self, token: str) -> str:
        try:
            return self._fernet.decrypt(token.encode("ascii")).decode("utf-8")
        except (InvalidToken, ValueError, TypeError) as error:
            raise ValueError(
                "stored key cannot be decrypted with the current master key"
            ) from error


__all__ = ["KeyCipher"]
