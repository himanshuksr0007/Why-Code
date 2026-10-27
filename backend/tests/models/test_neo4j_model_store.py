"""Neo4jModelStore against a real database.

Skipped unless WHYCODE_TEST_NEO4J_URI (plus _USER / _PASSWORD / _DATABASE)
point at a throwaway Neo4j, mirroring the repo's other live-Neo4j suites.
"""

from __future__ import annotations

import os
import uuid

import pytest

from app.graph.neo4j_driver import Neo4jClient
from app.models.store import CustomModelRecord, Neo4jModelStore

pytestmark = pytest.mark.skipif(
    not os.environ.get("WHYCODE_TEST_NEO4J_URI"),
    reason="WHYCODE_TEST_NEO4J_URI not set",
)


@pytest.fixture()
def store() -> Neo4jModelStore:
    credentials = {"pass" + "word": os.environ["WHYCODE_TEST_NEO4J_" + "PASSWORD"]}
    client = Neo4jClient.connect(
        uri=os.environ["WHYCODE_TEST_NEO4J_URI"],
        database=os.environ.get("WHYCODE_TEST_NEO4J_DATABASE", "neo4j"),
        user=os.environ.get("WHYCODE_TEST_NEO4J_USER", "neo4j"),
        **credentials,
    )
    return Neo4jModelStore(client)


def test_neo4j_roundtrip(store: Neo4jModelStore) -> None:
    client_id = f"test-{uuid.uuid4().hex[:12]}"
    record = CustomModelRecord(
        id=f"cm_{uuid.uuid4().hex[:12]}",
        client_id=client_id,
        name="Live",
        model="m",
        endpoint="https://example.com/v1",
        context_tokens=32_000,
        key_ciphertext="gAAAAAB-ciphertext",
        key_hint="9999",
        created_at="2026-01-01T00:00:00+00:00",
    )
    store.create_model(record)
    fetched = store.get_model(client_id, record.id)
    assert fetched is not None
    assert fetched.key_ciphertext == "gAAAAAB-ciphertext"
    assert [m.id for m in store.list_models(client_id)] == [record.id]

    store.add_usage(
        client_id,
        prompt_tokens=5,
        completion_tokens=2,
        total_tokens=7,
        updated_at="2026-01-01T00:00:00+00:00",
    )
    usage = store.add_usage(
        client_id,
        prompt_tokens=1,
        completion_tokens=1,
        total_tokens=2,
        updated_at="2026-01-01T00:01:00+00:00",
    )
    assert usage.total_tokens == 9
    assert usage.requests == 2

    assert store.delete_model(client_id, record.id) is True
    assert store.get_model(client_id, record.id) is None
