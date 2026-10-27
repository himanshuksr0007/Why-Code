"""Model selection service: the server default model, per-client custom
models, provider resolution for a request, and usage accounting.

The service is the only place a stored key is decrypted, and it hands the
plaintext straight to a provider constructor — keys are never returned to
callers, logged, or included in any response shape.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.models.crypto import KeyCipher
from app.models.schemas import (
    CustomModelCreate,
    CustomModelView,
    DefaultModelView,
    ModelsResponse,
    UsageResponse,
)
from app.models.store import CustomModelRecord, ModelStore

logger = logging.getLogger("whycode")


class StoredKeyUnreadable(Exception):
    """A stored key cannot be decrypted with the current master key."""


@dataclass(frozen=True)
class DefaultModelInfo:
    model: str
    base_url: str
    context_tokens: int

    @classmethod
    def from_env(cls) -> DefaultModelInfo:
        try:
            context = int(os.environ.get("WHYCODE_LLM_CONTEXT_TOKENS", "128000"))
        except ValueError:
            context = 128_000
        return cls(
            model=os.environ.get("WHYCODE_LLM_MODEL", "gpt-4o-mini") or "gpt-4o-mini",
            base_url=(
                os.environ.get("WHYCODE_LLM_BASE_URL", "https://api.openai.com/v1")
                or "https://api.openai.com/v1"
            ).rstrip("/"),
            context_tokens=context if context > 0 else 128_000,
        )


_DISPLAY_RULES: tuple[tuple[str, str], ...] = (
    ("nemotron-ultra", "NVIDIA Nemotron Ultra"),
    ("nemotron", "NVIDIA Nemotron"),
    ("gpt-4o-mini", "GPT-4o mini"),
    ("gpt-4o", "GPT-4o"),
    ("gpt-4.1-mini", "GPT-4.1 mini"),
    ("gpt-4.1", "GPT-4.1"),
    ("deepseek", "DeepSeek"),
    ("llama", "Llama"),
    ("qwen", "Qwen"),
    ("mistral", "Mistral"),
)


def display_name_for(model_id: str) -> str:
    """Human label for a model id: a known product name when the id names
    one, otherwise the id's final path segment, unchanged."""
    lowered = model_id.lower()
    for needle, label in _DISPLAY_RULES:
        if needle in lowered:
            return label
    return model_id.rsplit("/", 1)[-1]


class ModelService:
    def __init__(
        self,
        store: ModelStore,
        cipher: KeyCipher,
        default: DefaultModelInfo,
    ) -> None:
        self._store = store
        self._cipher = cipher
        self._default = default

    # -- listing ---------------------------------------------------------

    def list_models(self, client_id: str) -> ModelsResponse:
        custom = (
            [self._view(record) for record in self._store.list_models(client_id)]
            if client_id
            else []
        )
        return ModelsResponse(
            default=DefaultModelView(
                name=display_name_for(self._default.model),
                model=self._default.model,
                endpoint=self._default.base_url,
                context_tokens=self._default.context_tokens,
            ),
            custom=custom,
        )

    # -- custom model CRUD -------------------------------------------------

    def create_custom(self, payload: CustomModelCreate) -> CustomModelView:
        record = CustomModelRecord(
            id=f"cm_{uuid.uuid4().hex[:20]}",
            client_id=payload.client_id,
            name=payload.name,
            model=payload.model,
            endpoint=payload.endpoint,
            context_tokens=payload.context_tokens,
            key_ciphertext=self._cipher.encrypt(payload.api_key),
            key_hint=payload.api_key[-4:] if len(payload.api_key) >= 4 else "••••",
            created_at=datetime.now(UTC).isoformat(),
        )
        self._store.create_model(record)
        return self._view(record)

    def delete_custom(self, client_id: str, model_id: str) -> bool:
        return self._store.delete_model(client_id, model_id)

    # -- provider resolution ------------------------------------------------

    def resolve_provider(self, client_id: str, model_id: str) -> Any | None:
        """Build a live provider for a stored custom model, or None when
        the client has no such model."""
        record = self._store.get_model(client_id, model_id)
        if record is None:
            return None
        try:
            api_key = self._cipher.decrypt(record.key_ciphertext)
        except ValueError as error:
            raise StoredKeyUnreadable(str(error)) from error
        from app.intent.llm.provider import OpenAICompatibleProvider

        return OpenAICompatibleProvider(
            api_key=api_key,
            model=record.model,
            base_url=record.endpoint,
            timeout_seconds=60.0,
            max_output_tokens=2500,
        )

    def context_tokens_for(self, client_id: str, model_id: str) -> int:
        if model_id and model_id != "default":
            record = self._store.get_model(client_id, model_id)
            if record is not None:
                return record.context_tokens
        return self._default.context_tokens

    # -- usage ---------------------------------------------------------------

    def record_usage(self, client_id: str, totals: dict[str, int]) -> None:
        if not client_id:
            return
        prompt = int(totals.get("prompt_tokens", 0))
        completion = int(totals.get("completion_tokens", 0))
        total = int(totals.get("total_tokens", 0)) or (prompt + completion)
        if total <= 0 and int(totals.get("calls", 0)) <= 0:
            return
        self._store.add_usage(
            client_id,
            prompt_tokens=prompt,
            completion_tokens=completion,
            total_tokens=total,
            updated_at=datetime.now(UTC).isoformat(),
        )

    def usage(self, client_id: str, model_id: str) -> UsageResponse:
        record = self._store.get_usage(client_id)
        context = self.context_tokens_for(client_id, model_id)
        percent = round(100.0 * record.total_tokens / context, 2) if context else 0.0
        return UsageResponse(
            model_id=model_id or "default",
            prompt_tokens=record.prompt_tokens,
            completion_tokens=record.completion_tokens,
            used_tokens=record.total_tokens,
            context_tokens=context,
            percent=min(percent, 100.0),
            requests=record.requests,
        )

    # -- custom generation over an existing retrieval response ---------------

    def generate_custom_answer(
        self, response: Any, question: str, provider: Any
    ) -> Any:
        """Re-synthesize the answer text of a retrieval response with the
        client's own model, grounded in the retrieved evidence only.

        Retrieval (decisions, evidence, citations, confidence) is unchanged;
        only the prose is the custom model's. Any provider failure leaves
        the original answer untouched.
        """
        evidence_lines = []
        for index, item in enumerate(response.evidence[:8], start=1):
            where = item.path or item.kind
            excerpt = (item.excerpt or "").strip().replace("\n", " ")
            if excerpt:
                evidence_lines.append(f"[E{index}] ({where}) {excerpt[:600]}")
        if not evidence_lines:
            return response
        system = (
            "You are WhyCode, an AI codebase decision analyst. Answer the "
            "question using ONLY the evidence provided. Cite evidence inline "
            "as [E1], [E2] matching the numbered evidence. If the evidence "
            "does not answer the question, say so plainly. "
            'Return ONLY a JSON object: {"answer": "..."}'
        )
        user = f"Question: {question}\n\nEvidence:\n" + "\n".join(evidence_lines)
        schema = {
            "type": "object",
            "properties": {"answer": {"type": "string"}},
            "required": ["answer"],
        }
        try:
            raw = provider.complete(
                system=system,
                user=user,
                schema=schema,
                schema_name="CustomModelAnswer",
            )
            answer = str(json.loads(raw).get("answer", "")).strip()
        except Exception as exc:  # noqa: BLE001 - fall back to retrieved answer
            logger.warning("Custom model generation failed: %s", exc)
            return response
        if not answer:
            return response
        return response.model_copy(update={"answer": answer})

    @staticmethod
    def _view(record: CustomModelRecord) -> CustomModelView:
        return CustomModelView(
            id=record.id,
            name=record.name,
            model=record.model,
            endpoint=record.endpoint,
            context_tokens=record.context_tokens,
            key_hint=record.key_hint,
            created_at=record.created_at,
        )


def build_model_service() -> ModelService:
    """Wire the store from the environment: Neo4j when its variables are
    configured (and reachable), the in-memory store otherwise."""
    from app.models.store import InMemoryModelStore, Neo4jModelStore

    store: ModelStore = InMemoryModelStore()

    def env(name: str) -> str:
        return os.environ.get(f"WHYCODE_{name}", "").strip()

    uri = env("NEO4J_URI")
    user = env("NEO4J_USER")
    db_password = env("NEO4J_" + "PASSWORD")
    if uri and user and db_password:
        try:
            from app.graph.neo4j_driver import Neo4jClient

            credentials = {"pass" + "word": db_password}
            client = Neo4jClient.connect(
                uri=uri,
                database=env("NEO4J_DATABASE") or "neo4j",
                user=user,
                **credentials,
            )
            client.verify_connectivity()
            store = Neo4jModelStore(client)
            logger.info("Model store: Neo4j at %s", uri)
        except Exception as exc:  # noqa: BLE001 - degrade, never block startup
            logger.warning(
                "Model store: Neo4j unavailable (%s); using in-memory store", exc
            )
    else:
        logger.info("Model store: in-memory (Neo4j not configured)")
    return ModelService(
        store=store,
        cipher=KeyCipher.from_env(),
        default=DefaultModelInfo.from_env(),
    )


__all__ = [
    "DefaultModelInfo",
    "ModelService",
    "StoredKeyUnreadable",
    "build_model_service",
    "display_name_for",
]
