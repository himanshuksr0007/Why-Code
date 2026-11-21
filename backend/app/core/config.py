"""Settings loaded once from .env and injected; never constructed ad hoc.

Secrets are ``repr=False`` so an incident log can include the settings
object without leaking tokens.

Both ``WHYCODE_*`` names and the plain operator names from the deployment
guide (``GITHUB_TOKEN``, ``NEO4J_URI``, ...) are accepted. The prefixed form
wins when both are present, which keeps local development explicit while
letting a hosted deployment use conventional environment names.
"""

from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field

from app.core.repos import normalize_repo

_ENV_PREFIX = "WHYCODE_"
_REQUIRED_FIELDS = (
    "github_token",
    "neo4j_uri",
    "neo4j_user",
    "neo4j_password",
    "llm_api_key",
)


def _env(source: dict[str, str], name: str, default: str = "") -> str:
    """Read ``WHYCODE_<NAME>`` first, then ``<NAME>``."""

    prefixed = source.get(f"{_ENV_PREFIX}{name}", "")
    if prefixed is not None and str(prefixed).strip():
        return str(prefixed).strip()
    plain = source.get(name, "")
    if plain is not None and str(plain).strip():
        return str(plain).strip()
    return default


def _csv(value: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in value.split(",") if part.strip())


class Settings(BaseModel):
    """One immutable view of the environment for a single process."""

    github_token: str = Field(default="", repr=False)
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str = Field(repr=False)
    neo4j_database: str = "neo4j"
    llm_api_key: str = Field(repr=False)
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_timeout_seconds: float = 60.0
    artifacts_dir: Path = Path("artifacts")

    # Product policy. These are operator-owned and never exposed as secrets.
    allowed_repos: tuple[str, ...] = ("encode/httpx",)
    default_ingestion_window_months: int = 12
    max_prs_per_ingestion: int = 100
    max_questions_per_minute: int = 10
    frontend_origin: str = ""

    @classmethod
    def from_env(
        cls,
        env: dict[str, str] | None = None,
        *,
        require_github: bool = True,
    ) -> Settings:
        source = os.environ if env is None else env
        required_fields = _REQUIRED_FIELDS if require_github else tuple(
            name for name in _REQUIRED_FIELDS if name != "github_token"
        )
        missing: list[str] = []
        found: dict[str, str] = {}
        for field_name in required_fields:
            value = _env(source, field_name.upper())
            if not value:
                missing.append(
                    f"{_ENV_PREFIX}{field_name.upper()} (or {field_name.upper()})"
                )
            else:
                found[field_name] = value
        if missing:
            raise ValueError(f"missing required environment variables: {', '.join(missing)}")

        allowed_raw = _env(source, "ALLOWED_REPOS", "encode/httpx")
        allowed = _csv(allowed_raw) or ("encode/httpx",)
        normalized_allowed = tuple(normalize_repo(item) for item in allowed)

        return cls(
            github_token=found.get("github_token", ""),
            neo4j_uri=found["neo4j_uri"],
            neo4j_user=found["neo4j_user"],
            neo4j_password=found["neo4j_password"],
            neo4j_database=_env(source, "NEO4J_DATABASE", "neo4j") or "neo4j",
            llm_api_key=found["llm_api_key"],
            llm_model=_env(source, "LLM_MODEL", "gpt-4o-mini") or "gpt-4o-mini",
            llm_base_url=(
                _env(source, "LLM_BASE_URL", "https://api.openai.com/v1")
                or "https://api.openai.com/v1"
            ),
            llm_timeout_seconds=float(
                _env(source, "LLM_TIMEOUT_SECONDS", "60") or "60"
            ),
            artifacts_dir=Path(_env(source, "ARTIFACTS_DIR", "artifacts")),
            allowed_repos=normalized_allowed,
            default_ingestion_window_months=int(
                _env(source, "DEFAULT_INGESTION_WINDOW_MONTHS", "12") or "12"
            ),
            max_prs_per_ingestion=int(
                _env(source, "MAX_PRS_PER_INGESTION", "100") or "100"
            ),
            max_questions_per_minute=int(
                _env(source, "MAX_QUESTIONS_PER_MINUTE", "10") or "10"
            ),
            frontend_origin=_env(source, "FRONTEND_ORIGIN"),
        )
