"""Repository onboarding routes.

Everything here is safe to expose to the browser: no token, password or
provider key crosses this boundary. The visitor only sees allow-list policy,
stage labels, counts and an explicit ready/failed state.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date

from fastapi import APIRouter, HTTPException, Response

from app.workspace.config import BOUNDARIES, FOCUS_SUGGESTIONS, WorkspaceConfig
from app.workspace.jobs import IngestionJobManager
from app.workspace.models import (
    IngestRequest,
    IngestionJob,
    RepositoryInfo,
    WorkspaceInfo,
)
from app.workspace.repository import RepoInputError, normalize_repo
from app.workspace.window import WindowError, resolve_window


def build_workspace_router(
    manager: IngestionJobManager,
    config: WorkspaceConfig,
    *,
    today: Callable[[], date] | None = None,
) -> APIRouter:
    router = APIRouter(tags=["workspace"])
    now = today or date.today

    @router.get("/workspace/config", response_model=WorkspaceInfo)
    @router.get(
        "/api/v1/workspace/config",
        response_model=WorkspaceInfo,
        include_in_schema=False,
    )
    def workspace_config() -> WorkspaceInfo:
        prepared = manager.prepared()
        repositories = [
            RepositoryInfo(
                repo=repo,
                allowed=True,
                prepared=repo in prepared,
                decisions=prepared.get(repo).decisions if repo in prepared else 0,
                evidence=prepared.get(repo).evidence if repo in prepared else 0,
            )
            for repo in config.allowed_repos
        ]
        return WorkspaceInfo(
            demo_mode=config.demo_mode,
            allowed_repos=list(config.allowed_repos),
            prepared_repos=list(prepared),
            repositories=repositories,
            default_depth=config.default_depth,
            default_window_months=config.default_window_months,
            deep_window_months=config.deep_window_months,
            max_window_months=config.max_window_months,
            max_prs_per_ingestion=config.max_prs_per_ingestion,
            max_questions_per_minute=config.max_questions_per_minute,
            ingestion_enabled=config.ingestion_enabled,
            focus_suggestions=list(FOCUS_SUGGESTIONS),
            boundaries=list(BOUNDARIES),
        )

    @router.post(
        "/repos",
        response_model=IngestionJob,
        status_code=202,
    )
    @router.post(
        "/api/v1/repos",
        response_model=IngestionJob,
        status_code=202,
        include_in_schema=False,
    )
    def submit_repository(body: IngestRequest, response: Response) -> IngestionJob:
        try:
            repo = normalize_repo(body.repo)
        except RepoInputError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        if not config.is_allowed(repo):
            allowed = ", ".join(config.allowed_repos) or "(none configured)"
            raise HTTPException(
                status_code=403,
                detail=(
                    f"{repo} is not on this deployment's allow-list. "
                    f"v1 is locked to: {allowed}."
                ),
            )

        try:
            window = resolve_window(body, config, today=now())
        except WindowError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        job = manager.submit(repo, body, window)
        response.headers["Location"] = f"/repos/{repo}/ingestion/{job.job_id}"
        return job

    @router.get(
        "/repos/{owner}/{repo}/ingestion/latest",
        response_model=IngestionJob,
    )
    @router.get(
        "/api/v1/repos/{owner}/{repo}/ingestion/latest",
        response_model=IngestionJob,
        include_in_schema=False,
    )
    def latest_ingestion(owner: str, repo: str) -> IngestionJob:
        resolved = _path_repo(owner, repo)
        job = manager.latest_for(resolved)
        if job is None:
            raise HTTPException(
                status_code=404,
                detail=f"no ingestion job has been started for {resolved}",
            )
        return job

    @router.get(
        "/repos/{owner}/{repo}/ingestion/{job_id}",
        response_model=IngestionJob,
    )
    @router.get(
        "/api/v1/repos/{owner}/{repo}/ingestion/{job_id}",
        response_model=IngestionJob,
        include_in_schema=False,
    )
    def ingestion_job(owner: str, repo: str, job_id: str) -> IngestionJob:
        resolved = _path_repo(owner, repo)
        job = manager.get(job_id)
        if job is None or job.repo != resolved:
            raise HTTPException(status_code=404, detail="ingestion job not found")
        return job

    return router


def _path_repo(owner: str, repo: str) -> str:
    try:
        return normalize_repo(f"{owner}/{repo}")
    except RepoInputError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


__all__ = ["build_workspace_router"]
