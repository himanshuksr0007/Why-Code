"""Operator-controlled workspace configuration.

Only an allow-listed set of repositories is accepted in v1. For the hackathon
the default is exactly ``encode/httpx``; the allow-list can grow once live
ingestion is repeatable.
"""

from __future__ import annotations

import os
from collections.abc import Mapping

from pydantic import BaseModel, Field, field_validator

from app.workspace.models import ScanDepth
from app.workspace.repository import RepoInputError, normalize_repo

DEFAULT_ALLOWED_REPOS = ("encode/httpx",)

FOCUS_SUGGESTIONS = (
    "retries",
    "auth",
    "database",
    "API",
    "config",
)

BOUNDARIES = (
    "Public GitHub repositories only.",
    "Python repositories with enough merged PR and review history.",
    "The repository must be ingested before questions can be answered.",
    "When the evidence is insufficient, WhyCode refuses instead of guessing.",
)


class WorkspaceConfig(BaseModel):
    """One immutable view of the operator's onboarding policy."""

    allowed_repos: tuple[str, ...] = DEFAULT_ALLOWED_REPOS
    prepared_repos: tuple[str, ...] = ()
    demo_mode: bool = False
    default_depth: ScanDepth = ScanDepth.QUICK
    default_window_months: int = Field(default=12, ge=1, le=60)
    deep_window_months: int = Field(default=36, ge=2, le=60)
    max_window_months: int = Field(default=60, ge=1, le=120)
    max_prs_per_ingestion: int = Field(default=100, ge=1, le=1000)
    max_questions_per_minute: int = Field(default=10, ge=1, le=1000)
    frontend_origin: str = "http://localhost:3000"
    ingestion_enabled: bool = False

    @field_validator("allowed_repos", "prepared_repos")
    @classmethod
    def _normalise_repos(cls, values: tuple[str, ...]) -> tuple[str, ...]:
        cleaned: list[str] = []
        for value in values:
            try:
                repo = normalize_repo(value)
            except RepoInputError as error:
                raise ValueError(f"invalid repository in allow-list: {value!r}") from error
            if repo not in cleaned:
                cleaned.append(repo)
        return tuple(cleaned)

    @classmethod
    def from_env(
        cls,
        env: Mapping[str, str] | None = None,
    ) -> WorkspaceConfig:
        source = os.environ if env is None else env
        return cls(
            allowed_repos=_csv(source.get("WHYCODE_ALLOWED_REPOS"), DEFAULT_ALLOWED_REPOS),
            prepared_repos=_csv(source.get("WHYCODE_PREPARED_REPOS"), ()),
            demo_mode=_bool(source.get("WHYCODE_DEMO_MODE"), False),
            default_depth=_depth(source.get("WHYCODE_DEFAULT_SCAN_DEPTH")),
            default_window_months=_int(
                source.get("WHYCODE_DEFAULT_INGESTION_WINDOW_MONTHS"), 12
            ),
            deep_window_months=_int(
                source.get("WHYCODE_DEEP_INGESTION_WINDOW_MONTHS"), 36
            ),
            max_window_months=_int(source.get("WHYCODE_MAX_INGESTION_WINDOW_MONTHS"), 60),
            max_prs_per_ingestion=_int(source.get("WHYCODE_MAX_PRS_PER_INGESTION"), 100),
            max_questions_per_minute=_int(
                source.get("WHYCODE_MAX_QUESTIONS_PER_MINUTE"), 10
            ),
            frontend_origin=(
                source.get("WHYCODE_FRONTEND_ORIGIN", "http://localhost:3000").strip()
                or "http://localhost:3000"
            ),
            ingestion_enabled=_bool(source.get("WHYCODE_INGESTION_ENABLED"), False),
        )

    def is_allowed(self, repo: str) -> bool:
        return normalize_repo(repo) in self.allowed_repos

    def is_prepared(self, repo: str) -> bool:
        return normalize_repo(repo) in self.prepared_repos

    def with_prepared(self, repos: tuple[str, ...]) -> WorkspaceConfig:
        merged = tuple(dict.fromkeys((*self.prepared_repos, *repos)))
        return self.model_copy(update={"prepared_repos": merged})


def _csv(value: str | None, default: tuple[str, ...]) -> tuple[str, ...]:
    if value is None or not value.strip():
        return default
    return tuple(part.strip() for part in value.split(",") if part.strip())


def _bool(value: str | None, default: bool) -> bool:
    if value is None or not value.strip():
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _int(value: str | None, default: int) -> int:
    if value is None or not value.strip():
        return default
    try:
        return int(value)
    except ValueError as error:
        raise ValueError(f"expected an integer, got {value!r}") from error


def _depth(value: str | None) -> ScanDepth:
    if value is None or not value.strip():
        return ScanDepth.QUICK
    try:
        return ScanDepth(value.strip().lower())
    except ValueError as error:
        raise ValueError(
            "WHYCODE_DEFAULT_SCAN_DEPTH must be quick, deep or custom"
        ) from error


__all__ = [
    "BOUNDARIES",
    "DEFAULT_ALLOWED_REPOS",
    "FOCUS_SUGGESTIONS",
    "WorkspaceConfig",
]
