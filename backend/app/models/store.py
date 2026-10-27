"""Persistence for custom models and per-client token usage.

Two stores share one protocol:

- :class:`Neo4jModelStore` — the production store. Custom models live as
  ``(:CustomModel)`` nodes and cumulative usage as ``(:ClientUsage)``
  nodes in the same Neo4j database as the code graph. Only the encrypted
  key token is stored, never a plaintext API key.
- :class:`InMemoryModelStore` — the same contract with no database, used
  when Neo4j is not configured (offline demo, tests). Data is per-process
  and disappears on restart.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class CustomModelRecord:
    id: str
    client_id: str
    name: str
    model: str
    endpoint: str
    context_tokens: int
    key_ciphertext: str = field(repr=False)
    key_hint: str = ""
    created_at: str = ""


@dataclass(frozen=True)
class UsageRecord:
    client_id: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    requests: int = 0
    updated_at: str = ""

    @classmethod
    def empty(cls, client_id: str) -> UsageRecord:
        return cls(client_id=client_id)


class ModelStore(Protocol):
    def create_model(self, record: CustomModelRecord) -> CustomModelRecord: ...

    def list_models(self, client_id: str) -> list[CustomModelRecord]: ...

    def get_model(self, client_id: str, model_id: str) -> CustomModelRecord | None: ...

    def delete_model(self, client_id: str, model_id: str) -> bool: ...

    def get_usage(self, client_id: str) -> UsageRecord: ...

    def add_usage(
        self,
        client_id: str,
        *,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        updated_at: str,
    ) -> UsageRecord: ...


class InMemoryModelStore:
    """Process-local store with the Neo4j store's exact contract."""

    def __init__(self) -> None:
        self._models: dict[str, CustomModelRecord] = {}
        self._usage: dict[str, UsageRecord] = {}
        self._lock = threading.Lock()

    def create_model(self, record: CustomModelRecord) -> CustomModelRecord:
        with self._lock:
            self._models[record.id] = record
        return record

    def list_models(self, client_id: str) -> list[CustomModelRecord]:
        with self._lock:
            return sorted(
                (m for m in self._models.values() if m.client_id == client_id),
                key=lambda m: m.created_at,
            )

    def get_model(self, client_id: str, model_id: str) -> CustomModelRecord | None:
        with self._lock:
            record = self._models.get(model_id)
        if record is None or record.client_id != client_id:
            return None
        return record

    def delete_model(self, client_id: str, model_id: str) -> bool:
        with self._lock:
            record = self._models.get(model_id)
            if record is None or record.client_id != client_id:
                return False
            del self._models[model_id]
        return True

    def get_usage(self, client_id: str) -> UsageRecord:
        with self._lock:
            return self._usage.get(client_id, UsageRecord.empty(client_id))

    def add_usage(
        self,
        client_id: str,
        *,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        updated_at: str,
    ) -> UsageRecord:
        with self._lock:
            current = self._usage.get(client_id, UsageRecord.empty(client_id))
            updated = UsageRecord(
                client_id=client_id,
                prompt_tokens=current.prompt_tokens + prompt_tokens,
                completion_tokens=current.completion_tokens + completion_tokens,
                total_tokens=current.total_tokens + total_tokens,
                requests=current.requests + 1,
                updated_at=updated_at,
            )
            self._usage[client_id] = updated
        return updated


class Neo4jModelStore:
    """Neo4j-backed store. All values are parameters; nothing is
    interpolated into Cypher."""

    def __init__(self, client: Any) -> None:
        self._client = client
        self._client.run(
            "CREATE CONSTRAINT custom_model_id IF NOT EXISTS "
            "FOR (m:CustomModel) REQUIRE m.id IS UNIQUE"
        )
        self._client.run(
            "CREATE CONSTRAINT client_usage_id IF NOT EXISTS "
            "FOR (u:ClientUsage) REQUIRE u.client_id IS UNIQUE"
        )

    def create_model(self, record: CustomModelRecord) -> CustomModelRecord:
        self._client.run(
            "CREATE (m:CustomModel {id: $id, client_id: $client_id, "
            "name: $name, model: $model, endpoint: $endpoint, "
            "context_tokens: $context_tokens, key_ciphertext: $key_ciphertext, "
            "key_hint: $key_hint, created_at: $created_at})",
            id=record.id,
            client_id=record.client_id,
            name=record.name,
            model=record.model,
            endpoint=record.endpoint,
            context_tokens=record.context_tokens,
            key_ciphertext=record.key_ciphertext,
            key_hint=record.key_hint,
            created_at=record.created_at,
        )
        return record

    def list_models(self, client_id: str) -> list[CustomModelRecord]:
        result = self._client.run(
            "MATCH (m:CustomModel {client_id: $client_id}) "
            "RETURN m ORDER BY m.created_at",
            client_id=client_id,
        )
        return [_record_from_node(row["m"]) for row in result.records]

    def get_model(self, client_id: str, model_id: str) -> CustomModelRecord | None:
        result = self._client.run(
            "MATCH (m:CustomModel {id: $id, client_id: $client_id}) RETURN m",
            id=model_id,
            client_id=client_id,
        )
        row = result.single()
        return _record_from_node(row["m"]) if row is not None else None

    def delete_model(self, client_id: str, model_id: str) -> bool:
        result = self._client.run(
            "MATCH (m:CustomModel {id: $id, client_id: $client_id}) "
            "DELETE m RETURN count(m) AS deleted",
            id=model_id,
            client_id=client_id,
        )
        row = result.single()
        return bool(row is not None and row["deleted"])

    def get_usage(self, client_id: str) -> UsageRecord:
        result = self._client.run(
            "MATCH (u:ClientUsage {client_id: $client_id}) RETURN u",
            client_id=client_id,
        )
        row = result.single()
        if row is None:
            return UsageRecord.empty(client_id)
        return _usage_from_node(row["u"])

    def add_usage(
        self,
        client_id: str,
        *,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        updated_at: str,
    ) -> UsageRecord:
        result = self._client.run(
            "MERGE (u:ClientUsage {client_id: $client_id}) "
            "ON CREATE SET u.prompt_tokens = $prompt, "
            "u.completion_tokens = $completion, u.total_tokens = $total, "
            "u.requests = 1, u.updated_at = $now "
            "ON MATCH SET u.prompt_tokens = u.prompt_tokens + $prompt, "
            "u.completion_tokens = u.completion_tokens + $completion, "
            "u.total_tokens = u.total_tokens + $total, "
            "u.requests = u.requests + 1, u.updated_at = $now "
            "RETURN u",
            client_id=client_id,
            prompt=prompt_tokens,
            completion=completion_tokens,
            total=total_tokens,
            now=updated_at,
        )
        row = result.single()
        return _usage_from_node(row["u"]) if row is not None else UsageRecord.empty(client_id)


def _record_from_node(node: Any) -> CustomModelRecord:
    props = dict(node)
    return CustomModelRecord(
        id=str(props["id"]),
        client_id=str(props["client_id"]),
        name=str(props["name"]),
        model=str(props["model"]),
        endpoint=str(props["endpoint"]),
        context_tokens=int(props["context_tokens"]),
        key_ciphertext=str(props["key_ciphertext"]),
        key_hint=str(props.get("key_hint", "")),
        created_at=str(props.get("created_at", "")),
    )


def _usage_from_node(node: Any) -> UsageRecord:
    props = dict(node)
    return UsageRecord(
        client_id=str(props["client_id"]),
        prompt_tokens=int(props.get("prompt_tokens", 0)),
        completion_tokens=int(props.get("completion_tokens", 0)),
        total_tokens=int(props.get("total_tokens", 0)),
        requests=int(props.get("requests", 0)),
        updated_at=str(props.get("updated_at", "")),
    )


__all__ = [
    "CustomModelRecord",
    "InMemoryModelStore",
    "ModelStore",
    "Neo4jModelStore",
    "UsageRecord",
]
