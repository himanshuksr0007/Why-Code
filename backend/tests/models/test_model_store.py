"""InMemoryModelStore contract: CRUD, client isolation, usage totals.

The Neo4j store implements the same contract; its live round-trip is in
test_neo4j_model_store.py (skipped without a test database).
"""

from __future__ import annotations

from app.models.store import CustomModelRecord, InMemoryModelStore


def _record(client_id: str = "client-a", model_id: str = "cm_1") -> CustomModelRecord:
    return CustomModelRecord(
        id=model_id,
        client_id=client_id,
        name="Mine",
        model="some-model",
        endpoint="https://example.com/v1",
        context_tokens=64_000,
        key_ciphertext="ciphertext",
        key_hint="1234",
        created_at="2026-01-01T00:00:00+00:00",
    )


def test_create_list_get_delete() -> None:
    store = InMemoryModelStore()
    store.create_model(_record())
    assert [m.id for m in store.list_models("client-a")] == ["cm_1"]
    assert store.get_model("client-a", "cm_1") is not None
    assert store.delete_model("client-a", "cm_1") is True
    assert store.get_model("client-a", "cm_1") is None
    assert store.delete_model("client-a", "cm_1") is False


def test_clients_cannot_see_or_delete_each_others_models() -> None:
    store = InMemoryModelStore()
    store.create_model(_record())
    assert store.list_models("client-b") == []
    assert store.get_model("client-b", "cm_1") is None
    assert store.delete_model("client-b", "cm_1") is False


def test_usage_accumulates() -> None:
    store = InMemoryModelStore()
    store.add_usage(
        "client-a",
        prompt_tokens=10,
        completion_tokens=5,
        total_tokens=15,
        updated_at="2026-01-01T00:00:00+00:00",
    )
    usage = store.add_usage(
        "client-a",
        prompt_tokens=1,
        completion_tokens=2,
        total_tokens=3,
        updated_at="2026-01-01T00:01:00+00:00",
    )
    assert usage.prompt_tokens == 11
    assert usage.completion_tokens == 7
    assert usage.total_tokens == 18
    assert usage.requests == 2
    assert store.get_usage("client-b").total_tokens == 0
