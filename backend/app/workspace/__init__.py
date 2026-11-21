"""The end-user onboarding surface.

The workspace package is intentionally separate from the retrieval pipeline:
it validates what a visitor is allowed to analyse, records an honest
ingestion timeline, and tells the UI whether the repository is ready to be
questioned. It never exposes operator credentials or raw graph internals.
"""

from app.workspace.api import build_workspace_router
from app.workspace.config import WorkspaceConfig
from app.workspace.jobs import IngestionJobManager
from app.workspace.models import (
    IngestionCounts,
    IngestionJob,
    IngestRequest,
    JobState,
    ScanDepth,
    ScanWindow,
    StageStatus,
)
from app.workspace.repository import RepoInputError, normalize_repo

__all__ = [
    "IngestRequest",
    "IngestionCounts",
    "IngestionJob",
    "IngestionJobManager",
    "JobState",
    "RepoInputError",
    "ScanDepth",
    "ScanWindow",
    "StageStatus",
    "WorkspaceConfig",
    "build_workspace_router",
    "normalize_repo",
]
