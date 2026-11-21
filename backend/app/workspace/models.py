"""Transport models for repository onboarding and ingestion progress.

The models are deliberately small and stable. The browser receives stage
labels, counts and an explicit state — never an opaque "AI is thinking"
indicator.
"""

from __future__ import annotations

from datetime import date
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ScanDepth(StrEnum):
    QUICK = "quick"
    DEEP = "deep"
    CUSTOM = "custom"


class JobState(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    READY = "ready"
    FAILED = "failed"


class StageStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"
    SKIPPED = "skipped"


class ScanWindow(BaseModel):
    since: date
    until: date


class IngestRequest(BaseModel):
    """What the visitor chooses. Repository credentials never live here."""

    model_config = ConfigDict(extra="forbid")

    repo: str = Field(min_length=1, max_length=300)
    depth: ScanDepth = ScanDepth.QUICK
    since: date | None = None
    until: date | None = None
    focus: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("focus")
    @classmethod
    def _clean_focus(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for value in values:
            label = " ".join(value.split()).strip()
            if not label:
                continue
            if len(label) > 40:
                raise ValueError("each focus area must be 40 characters or fewer")
            if label not in cleaned:
                cleaned.append(label)
        if len(cleaned) > 8:
            raise ValueError("choose at most 8 focus areas")
        return cleaned


class IngestionCounts(BaseModel):
    prs_selected: int = Field(default=0, ge=0)
    prs_analyzed: int = Field(default=0, ge=0)
    files_analyzed: int = Field(default=0, ge=0)
    decisions: int = Field(default=0, ge=0)
    evidence: int = Field(default=0, ge=0)


class JobStage(BaseModel):
    id: str
    label: str
    status: StageStatus = StageStatus.PENDING
    detail: str = ""
    count: int | None = Field(default=None, ge=0)


class IngestionJob(BaseModel):
    job_id: str
    repo: str
    depth: ScanDepth
    window: ScanWindow
    focus: list[str] = Field(default_factory=list)
    prepared: bool = False
    state: JobState = JobState.QUEUED
    current_stage: str | None = None
    progress: int = Field(default=0, ge=0, le=100)
    stages: list[JobStage] = Field(default_factory=list)
    counts: IngestionCounts = Field(default_factory=IngestionCounts)
    message: str = ""
    error: str | None = None
    created_at: str
    updated_at: str


class RepositoryInfo(BaseModel):
    repo: str
    allowed: bool = True
    prepared: bool = False
    decisions: int = 0
    evidence: int = 0


class WorkspaceInfo(BaseModel):
    demo_mode: bool
    allowed_repos: list[str] = Field(default_factory=list)
    prepared_repos: list[str] = Field(default_factory=list)
    repositories: list[RepositoryInfo] = Field(default_factory=list)
    default_depth: ScanDepth = ScanDepth.QUICK
    default_window_months: int
    deep_window_months: int
    max_window_months: int
    max_prs_per_ingestion: int
    max_questions_per_minute: int
    ingestion_enabled: bool
    focus_suggestions: list[str] = Field(default_factory=list)
    boundaries: list[str] = Field(default_factory=list)


__all__ = [
    "IngestRequest",
    "IngestionCounts",
    "IngestionJob",
    "JobStage",
    "JobState",
    "RepositoryInfo",
    "ScanDepth",
    "ScanWindow",
    "StageStatus",
    "WorkspaceInfo",
]
