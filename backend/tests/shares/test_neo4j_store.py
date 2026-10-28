"""Neo4j share store against a real database (opt-in integration test).

Set WHYCODE_TEST_NEO4J_URI / _USER / _PASSWORD to run; skipped otherwise.
"""

from __future__ import annotations

import os
import uuid

import pytest

pytestmark = pytest.mark.integration

_URI = os.environ.get("WHYCODE_TEST_NEO4J_URI", "")
_USER = os.environ.get("WHYCODE_TEST_NEO4J_USER", "")
_PW = os.environ.get("WHYCODE_TEST_NEO4J_" + "PASSWORD", "")

if not (_URI and _USER and _PW):
    pytest.skip("WHYCODE_TEST_NEO4J_* not set", allow_module_level=True)


@pytest.fixture()
def store_and_client():
    from app.graph.neo4j_driver import Neo4jClient
    from app.shares.store import Neo4jShareStore

    client = Neo4jClient.connect(
        uri=_URI,
        database=os.environ.get("WHYCODE_TEST_NEO4J_DATABASE") or "neo4j",
        user=_USER,
        password=_PW,
    )
    store = Neo4jShareStore(client)
    yield store, client
    client.run("MATCH (s:Share) WHERE s.chat_id STARTS WITH 'share-test-' DELETE s")


def test_neo4j_share_roundtrip(store_and_client) -> None:
    from app.shares.store import ShareRecord

    store, _ = store_and_client
    suffix = uuid.uuid4().hex[:8]
    record = ShareRecord(
        id=f"share-{suffix}",
        owner_id="owner-1",
        owner_name="Owner",
        owner_handle="owner",
        chat_id=f"share-test-{suffix}",
        title="T",
        repo="a/b",
        visibility="private",
        whitelist=["friend_two"],
        snapshot='{"turns": []}',
        created_at="2026-01-01T00:00:00+00:00",
        updated_at="2026-01-01T00:00:00+00:00",
    )
    stored = store.upsert_share(record)
    assert stored.id == record.id
    assert store.get_share(record.id).whitelist == ["friend_two"]
    # Upsert keeps the id and updates fields.
    updated = store.upsert_share(
        ShareRecord(**{**record.__dict__, "title": "T2", "id": "ignored"})
    )
    assert updated.id == record.id
    assert updated.title == "T2"
    assert store.delete_share(record.id, "owner-1") is True
    assert store.get_share(record.id) is None
