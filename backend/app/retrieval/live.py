"""Production composition root for the live, multi-repository answer service.

The demo used one in-memory fixture graph. This module builds the same
retrieval pipeline against the real Neo4j graph, lazily creating one
repository-scoped ``RetrievalService`` per indexed repo. The graph is
read-only here; ingestion, structural enrichment and intent extraction are
separate offline commands.
"""

from __future__ import annotations

import os
import threading
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.graph.neo4j_driver import Neo4jClient
from app.intent.config import IntentConfig
from app.intent.llm.provider import LLMProvider, build_provider
from app.retrieval.config import RetrievalConfig
from app.retrieval.indexes.embeddings import HashingEmbeddingProvider
from app.retrieval.models import (
    AskParameters,
    AskResponse,
    EvidenceItem,
    GraphContext,
)
from app.retrieval.question.entity_catalog import Neo4jEntityCatalog
from app.retrieval.question.entity_extractor import EntityIndex, KnownEntity
from app.retrieval.retrieval.neo4j_backend import Neo4jGraphBackend
from app.retrieval.service import RetrievalService

ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

_REPOS_QUERY = """
MATCH (n)
WHERE n.repo IS NOT NULL
WITH n.repo AS repo,
     count(DISTINCT CASE WHEN n:Decision THEN n END) AS decisions,
     count(DISTINCT CASE WHEN n:Evidence THEN n END) AS evidence
RETURN repo, decisions, evidence
ORDER BY repo
"""

_SUGGESTIONS_QUERY = """
MATCH (d:Decision {repo: $repo})
WHERE coalesce(d.decision_id, d.record_id) IS NOT NULL
  AND d.claim IS NOT NULL
  AND trim(d.claim) <> ''
RETURN coalesce(d.decision_id, d.record_id) AS decision_id,
       d.claim AS claim,
       coalesce(d.status, 'uncertain') AS status,
       d.pr_number AS pr_number
ORDER BY
  CASE coalesce(d.status, '')
    WHEN 'active' THEN 0
    WHEN 'contested' THEN 1
    ELSE 2
  END,
  coalesce(d.pr_number, 0) DESC,
  decision_id
LIMIT $limit
"""


class _LockedGenerator:
    """Serialize the quota-aware provider shared by request threads."""

    def __init__(self, inner: LLMProvider) -> None:
        self.inner = inner
        self._lock = threading.Lock()

    def complete(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any],
        schema_name: str,
    ) -> str:
        with self._lock:
            return self.inner.complete(
                system=system,
                user=user,
                schema=schema,
                schema_name=schema_name,
            )


class LiveRetrievalService:
    """Repository-scoped retrieval over the live Neo4j graph.

    The public surface deliberately matches ``RetrievalService`` plus the
    repository/suggestion discovery helpers the live UI uses.
    """

    def __init__(
        self,
        *,
        runner: Neo4jClient,
        backend: Neo4jGraphBackend,
        embedder: HashingEmbeddingProvider,
        generator: LLMProvider,
        default_repo: str | None = None,
    ) -> None:
        self.runner = runner
        self.backend = backend
        self.embedder = embedder
        self.generator = _LockedGenerator(generator)
        self.default_repo = default_repo or None
        self._services: dict[str, RetrievalService] = {}
        self._lock = threading.Lock()

    # -- discovery ------------------------------------------------------
    def list_repos(self) -> list[dict[str, Any]]:
        result = self.runner.run(_REPOS_QUERY)
        repos: list[dict[str, Any]] = []
        for record in result.records:
            repo = _record_value(record, "repo")
            if not isinstance(repo, str) or not repo.strip():
                continue
            repos.append(
                {
                    "repo": repo,
                    "decisions": _int_value(record, "decisions"),
                    "evidence": _int_value(record, "evidence"),
                }
            )
        return repos

    def suggestions(
        self, repo: str | None = None, *, limit: int = 5
    ) -> list[dict[str, Any]]:
        resolved = self.resolve_repo(repo)
        result = self.runner.run(
            _SUGGESTIONS_QUERY, repo=resolved, limit=max(1, min(limit, 20))
        )
        suggestions: list[dict[str, Any]] = []
        for index, record in enumerate(result.records, start=1):
            decision_id = _record_value(record, "decision_id")
            claim = _record_value(record, "claim")
            if not isinstance(decision_id, str) or not isinstance(claim, str):
                continue
            clean_claim = " ".join(claim.split()).strip()
            if not clean_claim:
                continue
            suggestions.append(
                {
                    "question_id": f"{resolved}:suggestion:{index}",
                    "question": _question_for(clean_claim),
                    "focus": "Trace the PR, review and code evidence behind this decision.",
                    "decision_id": decision_id,
                }
            )
        return suggestions

    def resolve_repo(self, repo: str | None) -> str:
        requested = (repo or "").strip()
        if requested:
            return requested
        if self.default_repo:
            return self.default_repo
        repos = [item["repo"] for item in self.list_repos()]
        if len(repos) == 1:
            return str(repos[0])
        if not repos:
            raise ValueError("no repositories are indexed")
        raise ValueError(
            "repo is required; indexed repositories: " + ", ".join(map(str, repos))
        )

    # -- answer service -------------------------------------------------
    def ask(self, parameters: AskParameters) -> AskResponse:
        repo = self.resolve_repo(parameters.repo)
        return self._service(repo).ask(
            parameters.model_copy(update={"repo": repo})
        )

    def get_decision(
        self, decision_id: str, *, repo: str | None = None
    ) -> GraphContext | None:
        resolved = self.resolve_repo(repo)
        return self._service(resolved).get_decision(decision_id, repo=resolved)

    def get_evidence(
        self, evidence_id: str, *, repo: str | None = None
    ) -> EvidenceItem | None:
        resolved = self.resolve_repo(repo)
        return self._service(resolved).get_evidence(evidence_id, repo=resolved)

    def entity_history(
        self, entity_id: str, *, repo: str | None = None
    ) -> list[GraphContext]:
        resolved = self.resolve_repo(repo)
        return self._service(resolved).entity_history(entity_id, repo=resolved)

    def _service(self, repo: str) -> RetrievalService:
        with self._lock:
            cached = self._services.get(repo)
            if cached is not None:
                return cached

        config = RetrievalConfig.from_env(repo)
        catalog = Neo4jEntityCatalog.load(
            self.runner, repo, limit_per_type=config.catalog_limit_per_type
        )
        service = RetrievalService(
            backend=self.backend,
            embedder=self.embedder,
            generator=self.generator,
            config=config,
            index=_entity_index(catalog),
            lookup=self.backend,
        )
        with self._lock:
            self._services.setdefault(repo, service)
            return self._services[repo]

    def close(self) -> None:
        self.runner.close()

    def invalidate_repo(self, repo: str) -> None:
        """Drop the cached repository service after a fresh ingestion."""

        with self._lock:
            self._services.pop(repo, None)


def build_live_service(settings: Settings | None = None) -> LiveRetrievalService:
    """Build the service from environment-backed settings.

    Serving answers does not need a GitHub token, so callers should use
    ``Settings.from_env(require_github=False)``.
    """

    resolved = settings or Settings.from_env(require_github=False)
    runner = Neo4jClient.from_settings(resolved)
    runner.verify_connectivity()

    default_repo = os.environ.get("WHYCODE_DEFAULT_REPO", "").strip() or None
    config = RetrievalConfig.from_env(default_repo or "")
    config = config.model_copy(update={"repo": default_repo})
    embedder = HashingEmbeddingProvider(config.embedding_dimensions)
    backend = Neo4jGraphBackend(runner, config=config)

    intent_config = IntentConfig.from_env(
        default_repo or "repository",
        artifacts_dir=resolved.artifacts_dir,
    )
    generator = build_provider(intent_config)
    return LiveRetrievalService(
        runner=runner,
        backend=backend,
        embedder=embedder,
        generator=generator,
        default_repo=default_repo,
    )


def _entity_index(catalog: Any) -> EntityIndex:
    return EntityIndex(
        [
            KnownEntity(
                type=entity.type,
                identifier=entity.identifier,
                aliases=entity.aliases,
                graph_key=entity.graph_key,
                display_name=entity.display_name,
                path=entity.path,
                claim=entity.claim,
                status=entity.status,
                pr_number=entity.pr_number,
                source_label=entity.source_label,
            )
            for entity in catalog.entries()
        ]
    )


def _question_for(claim: str) -> str:
    clean = claim.strip().rstrip(".?!")
    if len(clean) > 180:
        clean = clean[:177].rstrip() + "…"
    return f'Why did the codebase decide: "{clean}"?'


def _record_value(record: Any, key: str) -> Any:
    if isinstance(record, Mapping):
        return record.get(key)
    try:
        return record[key]
    except (KeyError, TypeError, IndexError):
        return getattr(record, key, None)


def _int_value(record: Any, key: str) -> int:
    value = _record_value(record, key)
    return int(value) if isinstance(value, (int, float)) else 0


__all__ = [
    "ENV_PATH",
    "LiveRetrievalService",
    "build_live_service",
]
