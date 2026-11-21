"""FastAPI application factory. `/health` is liveness only: it must not
touch Neo4j, or CI would depend on a paid cloud database being awake."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings
from app.retrieval.api.demo_routes import build_demo_router
from app.retrieval.api.routes import build_router
from app.retrieval.service import RetrievalService
from app.workspace.api import build_workspace_router
from app.workspace.config import WorkspaceConfig
from app.workspace.jobs import IngestionJobManager
from app.workspace.models import IngestionCounts
from app.workspace.ratelimit import SlidingWindowRateLimiter

VERSION = "0.0.1"

_DEMO_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)


def create_app(
    settings: Settings | None = None,
    retrieval_service: Any | None = None,
    demo_service: RetrievalService | None = None,
    workspace_config: WorkspaceConfig | None = None,
    ingestion_manager: IngestionJobManager | None = None,
) -> FastAPI:
    app = FastAPI(title="why-code", version=VERSION)
    config = workspace_config or WorkspaceConfig.from_env()
    manager = ingestion_manager or IngestionJobManager(config)
    app.state.settings = settings
    app.state.retrieval_service = retrieval_service
    app.state.demo_service = demo_service
    app.state.workspace_config = config
    app.state.ingestion_manager = manager
    origins = list(dict.fromkeys((*_DEMO_ORIGINS, config.frontend_origin)))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"service": "why-code", "status": "ok", "version": VERSION}

    app.include_router(
        build_router(
            retrieval_service,
            SlidingWindowRateLimiter(config.max_questions_per_minute),
        )
    )
    app.include_router(build_workspace_router(manager, config))
    if demo_service is not None:
        app.include_router(build_demo_router(demo_service))
    return app


def create_demo_app() -> FastAPI:
    """The prepared, offline judge demo.

    The same service serves ``/ask``, ``/demo/*`` and onboarding. The demo
    route only accepts the script; ``/ask`` remains available for free-form
    questions, which still pass through the deterministic refusal gates.
    """

    from app.retrieval.demo import create_demo_service

    service = create_demo_service()
    base = WorkspaceConfig.from_env()
    config = base.model_copy(
        update={
            "demo_mode": True,
            "allowed_repos": tuple(
                dict.fromkeys((*base.allowed_repos, "encode/httpx"))
            ),
            "prepared_repos": ("encode/httpx",),
            "ingestion_enabled": False,
        }
    )
    manager = IngestionJobManager(
        config,
        prepared_counts={"encode/httpx": _demo_counts()},
    )
    return create_app(
        retrieval_service=service,
        demo_service=service,
        workspace_config=config,
        ingestion_manager=manager,
    )


def create_live_app() -> FastAPI:
    """Build the live application from Neo4j and the configured LLM.

    Startup failure is deliberately non-fatal: ``/health`` stays a liveness
    probe, ``/ready`` explains the failure, and the answer routes return 503
    until the graph and credentials are fixed.
    """

    from dotenv import load_dotenv

    from app.retrieval.live import ENV_PATH, build_live_service
    from app.workspace.runner import SubprocessPipelineRunner

    load_dotenv(ENV_PATH, override=False)
    settings: Settings | None = None
    service: Any | None = None
    error: str | None = None
    try:
        settings = Settings.from_env(require_github=False)
        service = build_live_service(settings)
    except Exception as exc:  # noqa: BLE001 - reported by /ready
        error = f"{type(exc).__name__}: {exc}"

    config = WorkspaceConfig.from_env()
    prepared: dict[str, IngestionCounts] = {}
    if service is not None:
        for item in service.list_repos():
            repo = str(item.get("repo") or "")
            if repo:
                prepared[repo] = IngestionCounts(
                    prs_selected=0,
                    prs_analyzed=0,
                    files_analyzed=0,
                    decisions=int(item.get("decisions") or 0),
                    evidence=int(item.get("evidence") or 0),
                )
        config = config.with_prepared(tuple(prepared))

    runner = None
    if settings is not None and config.ingestion_enabled:
        runner = SubprocessPipelineRunner(settings, config)
    on_ready = getattr(service, "invalidate_repo", None)
    manager = IngestionJobManager(
        config,
        prepared_counts=prepared,
        runner=runner,
        on_ready=on_ready if callable(on_ready) else None,
    )

    app = create_app(
        settings=settings,
        retrieval_service=service,
        workspace_config=config,
        ingestion_manager=manager,
    )
    app.state.live_error = error

    @app.get("/ready")
    def ready() -> dict[str, Any]:
        if error is not None:
            raise HTTPException(status_code=503, detail=error)
        repos = service.list_repos() if service is not None else []
        return {
            "service": "why-code",
            "status": "ready",
            "repos": [item["repo"] for item in repos],
        }

    return app


def _demo_counts() -> IngestionCounts:
    from app.retrieval.demo.data import build_contexts

    contexts = build_contexts()
    prs = {
        item.pr_number
        for context in contexts.values()
        for item in context.evidence
        if item.pr_number is not None
    }
    files = {
        item.path
        for context in contexts.values()
        for item in context.evidence
        if item.path
    }
    evidence = {
        item.evidence_id
        for context in contexts.values()
        for item in context.evidence
    }
    return IngestionCounts(
        prs_selected=len(prs),
        prs_analyzed=len(prs),
        files_analyzed=len(files),
        decisions=len(contexts),
        evidence=len(evidence),
    )



__all__ = ["VERSION", "create_app", "create_demo_app", "create_live_app"]
