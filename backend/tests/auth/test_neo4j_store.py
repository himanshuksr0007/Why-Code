"""Neo4j auth store against a real database (opt-in integration test).

Set WHYCODE_TEST_NEO4J_URI / _USER / _PASSWORD (and optionally
_DATABASE) to run it; skipped otherwise.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import replace

import pytest

pytestmark = pytest.mark.integration

_URI = os.environ.get("WHYCODE_TEST_NEO4J_URI", "")
_USER = os.environ.get("WHYCODE_TEST_NEO4J_USER", "")
_PASSWORD = os.environ.get("WHYCODE_TEST_NEO4J_PASSWORD", "")

if not (_URI and _USER and _PASSWORD):
    pytest.skip("WHYCODE_TEST_NEO4J_* not set", allow_module_level=True)


@pytest.fixture()
def store_and_client():
    from app.auth.store import Neo4jAuthStore
    from app.graph.neo4j_driver import Neo4jClient

    client = Neo4jClient.connect(
        uri=_URI,
        database=os.environ.get("WHYCODE_TEST_NEO4J_DATABASE") or "neo4j",
        user=_USER,
        password=_PASSWORD,
    )
    store = Neo4jAuthStore(client)
    yield store, client
    client.run("MATCH (u:User) WHERE u.email ENDS WITH '@auth-test.example' DETACH DELETE u")
    client.run("MATCH (o:OtpChallenge) WHERE o.email ENDS WITH '@auth-test.example' DELETE o")


def test_neo4j_user_and_otp_roundtrip(store_and_client) -> None:
    from app.auth.store import OtpRecord, UserRecord

    store, _ = store_and_client
    email = f"ada-{uuid.uuid4().hex[:8]}@auth-test.example"
    user = UserRecord(
        id=f"usr_{uuid.uuid4().hex}",
        name="Ada",
        email=email,
        password_hash="$argon2id$fake",
        email_verified=False,
        created_at="2026-01-01T00:00:00+00:00",
        updated_at="2026-01-01T00:00:00+00:00",
    )
    store.create_user(user)
    fetched = store.get_user_by_email(email)
    assert fetched is not None and fetched.id == user.id
    assert store.get_user_by_id(user.id).email == email  # type: ignore[union-attr]

    updated = store.update_user(user.id, email_verified=True, name="Ada L")
    assert updated is not None and updated.email_verified and updated.name == "Ada L"

    store.save_otp(
        OtpRecord(
            email=email,
            purpose="verify_email",
            code_hash="digest",
            created_at="2026-01-01T00:00:00+00:00",
            expires_at="2026-01-01T00:10:00+00:00",
            attempts=0,
        )
    )
    challenge = store.get_otp(email, "verify_email")
    assert challenge is not None and challenge.code_hash == "digest"
    assert store.increment_otp_attempts(email, "verify_email") == 1
    assert store.increment_otp_attempts(email, "verify_email") == 2
    store.save_otp(replace(challenge, code_hash="digest2", attempts=0))
    assert store.get_otp(email, "verify_email").code_hash == "digest2"  # type: ignore[union-attr]
    store.delete_otp(email, "verify_email")
    assert store.get_otp(email, "verify_email") is None
