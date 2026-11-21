"""FastAPI application factory. `/health` is liveness only: it must not
touch Neo4j, or CI would depend on a paid cloud database being awake."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import find_dotenv, load_dotenv

_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
else:
    load_dotenv(find_dotenv(usecwd=True))

# Log loaded environment variables for debugging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("whycode")

# Log which .env file was loaded
if _env_path.exists():
    logger.info(f"Loaded .env from: {_env_path}")
else:
    loaded = find_dotenv(usecwd=True)
    if loaded:
        logger.info(f"Loaded .env from: {loaded}")
    else:
        logger.info("No .env file found, using system environment variables")

# Log key environment variables (partial values for privacy)
logger.info("=== Environment Configuration ===")
logger.info(f"NEO4J_URI set: {'WHYCODE_NEO4J_URI' in os.environ}")
logger.info(f"LLM_API_KEY set: {'WHYCODE_LLM_API_KEY' in os.environ}")
logger.info(f"GITHUB_TOKEN set: {'WHYCODE_GITHUB_TOKEN' in os.environ}")

if "WHYCODE_NEO4J_URI" in os.environ:
    uri = os.environ["WHYCODE_NEO4J_URI"]
    logger.info(f"NEO4J_URI: {uri[:20]}...{uri[-10:] if len(uri) > 30 else ''}")

if "WHYCODE_LLM_MODEL" in os.environ:
    logger.info(f"LLM_MODEL: {os.environ['WHYCODE_LLM_MODEL']}")

if "WHYCODE_LLM_BASE_URL" in os.environ:
    url = os.environ["WHYCODE_LLM_BASE_URL"]
    logger.info(f"LLM_BASE_URL: {url[:30]}...")

logger.info("=== End Environment Configuration ===")

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
    "https://why-code-ten.vercel.app",
)


def create_app(
    settings: Settings | None = None,
    retrieval_service: Any | None = None,
    demo_service: RetrievalService | None = None,
    workspace_config: WorkspaceConfig | None = None,
    ingestion_manager: IngestionJobManager | None = None,
) -> FastAPI:
    live_service = None
    if demo_service is None:
        try:
            logger.info("Attempting to initialize LiveService...")
            from app.intent.llm.provider import OpenAICompatibleProvider
            from app.retrieval.config import RetrievalConfig
            from app.retrieval.live_service import LiveService

            cfg = RetrievalConfig.from_env(repo="encode/httpx")
            logger.info(f"RetrievalConfig loaded - repo: {cfg.repo}")
            logger.info(f"RetrievalConfig loaded - LLM API key present: {bool(cfg.llm_api_key)}")

            generator = None
            if cfg.llm_api_key:
                logger.info("Creating LLM provider...")
                generator = OpenAICompatibleProvider(
                    api_key=cfg.llm_api_key,
                    model=cfg.llm_model,
                    base_url=cfg.llm_base_url,
                    timeout_seconds=cfg.llm_timeout_seconds,
                    temperature=cfg.llm_temperature,
                    seed=cfg.llm_seed,
                    max_output_tokens=cfg.llm_max_output_tokens,
                )
                logger.info(f"LLM provider created with model: {cfg.llm_model}")
            else:
                logger.warning("No LLM API key found!")

            logger.info("Creating LiveService...")
            live_service = LiveService(generator=generator)
            logger.info("✓ LiveService initialized successfully!")
        except Exception as exc:
            logger.error(f"✗ Failed to initialize LiveService: {exc}", exc_info=True)

    if retrieval_service is None and demo_service is not None:
        try:
            from app.retrieval.demo import create_demo_service
            retrieval_service = create_demo_service()
        except Exception as exc:
            import logging
            logging.getLogger("whycode").warning(
                "Could not initialize default retrieval service: %s", exc
            )

    # Model selection (server default + per-client custom models in Neo4j)
    # and real token-usage accounting. Built from the environment; falls
    # back to an in-memory store when Neo4j is not configured.
    model_service = None
    try:
        from app.models import build_model_service

        model_service = build_model_service()
    except Exception as exc:
        logger.warning("Model service unavailable: %s", exc)

    app = FastAPI(title="why-code", version=VERSION)
    config = workspace_config or WorkspaceConfig.from_env()
    manager = ingestion_manager or IngestionJobManager(config)
    app.state.settings = settings
    app.state.retrieval_service = retrieval_service
    app.state.demo_service = demo_service or retrieval_service
    app.state.live_service = live_service
    app.state.model_service = model_service
    app.state.workspace_config = config
    app.state.ingestion_manager = manager
    origins = list(dict.fromkeys((*_DEMO_ORIGINS, config.frontend_origin)))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        # Only the headers the frontend actually sends (JSON bodies and
        # Bearer auth) — a wildcard here was flagged in the security review.
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def _security_headers(request, call_next):
        response = await call_next(request)
        # Baseline hardening for a JSON API: no MIME sniffing, no framing,
        # no referrer leakage, and HSTS (Render terminates TLS in front of
        # the app, so the header is meaningful in production).
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
        return response

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"service": "why-code", "status": "ok", "version": VERSION}

    app.include_router(
        build_router(
            retrieval_service,
            live_service=live_service,
            model_service=model_service,
            rate_limiter=SlidingWindowRateLimiter(config.max_questions_per_minute),
        )
    )
    # User accounts: identity is verified by Clerk; this service keeps
    # the session bridge and the account records. Built from the
    # environment like the model service; a failure here must never
    # take the answer service down with it.
    try:
        from app.auth import build_auth_service
        from app.auth.routes import build_auth_router

        auth_service = build_auth_service()
        app.state.auth_service = auth_service
        app.include_router(build_auth_router(auth_service))
    except Exception as exc:  # noqa: BLE001 - degrade, never block startup
        logger.warning("Auth service unavailable: %s", exc)

    # Model routes mount after auth so /usage can require a session
    # (it reports consumption against the shared provider key). If the
    # auth service failed to start, the router mounts without the
    # check — the same degrade-never-block posture, and the failure is
    # already logged above.
    if model_service is not None:
        from app.models.routes import build_models_router

        app.include_router(
            build_models_router(
                model_service, getattr(app.state, "auth_service", None)
            )
        )

    # Shared chat links (public, or private with a handle whitelist).
    # Needs the auth service to resolve viewer sessions; degrades the
    # same way — a failure here never takes the app down.
    try:
        if getattr(app.state, "auth_service", None) is not None:
            from app.shares import build_share_service
            from app.shares.routes import build_share_router

            share_service = build_share_service(app.state.auth_service)
            app.state.share_service = share_service
            app.include_router(build_share_router(share_service))
    except Exception as exc:  # noqa: BLE001 - degrade, never block startup
        logger.warning("Share service unavailable: %s", exc)

    # The decision ledger: the system of record for *why*. SQLite, so it
    # needs no external service; a failure degrades, never blocks startup.
    ledger = None
    try:
        from app.ledger import LedgerStore
        from app.ledger.routes import build_ledger_router

        ledger = LedgerStore(os.environ.get("WHYCODE_LEDGER_DB", "artifacts/ledger.db"))
        app.state.ledger = ledger
        app.include_router(build_ledger_router(ledger))
        if live_service is not None:
            live_service.ledger = ledger
    except Exception as exc:  # noqa: BLE001
        logger.warning("Decision ledger unavailable: %s", exc)

    from app.features.routes import build_webhook_router
    from app.features.webhooks import WebhookStore

    app.include_router(
        build_webhook_router(
            webhook_store=WebhookStore(
                os.environ.get("WHYCODE_WEBHOOK_DB", "artifacts/webhooks.db")
            ),
            webhook_secret=os.environ.get("WHYCODE_WEBHOOK_SECRET") or None,
            ledger=ledger,
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
