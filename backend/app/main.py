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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings
from app.retrieval.api.demo_routes import build_demo_router
from app.retrieval.api.routes import build_router
from app.retrieval.service import RetrievalService

VERSION = "0.0.1"

_DEMO_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)


def create_app(
    settings: Settings | None = None,
    retrieval_service: RetrievalService | None = None,
    demo_service: RetrievalService | None = None,
) -> FastAPI:
    live_service = None
    if demo_service is None:
        try:
            logger.info("Attempting to initialize LiveService...")
            from app.intent.llm.provider import OpenAICompatibleProvider
            from app.retrieval.config import RetrievalConfig
            from app.retrieval.live_service import LiveService

            cfg = RetrievalConfig.from_env(repo="encode/httpx")
            logger.info(f"RetrievalConfig loaded - Neo4j URI present: {bool(cfg.neo4j_uri)}")
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

    app = FastAPI(title="why-code", version=VERSION)
    app.state.settings = settings
    app.state.retrieval_service = retrieval_service
    app.state.demo_service = demo_service or retrieval_service
    app.state.live_service = live_service
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(_DEMO_ORIGINS),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"service": "why-code", "status": "ok", "version": VERSION}

    app.include_router(build_router(retrieval_service, live_service=live_service))
    if demo_service is not None:
        app.include_router(build_demo_router(demo_service))
    return app


def create_demo_app() -> FastAPI:
    """The prepared, offline judge demo.

    The same service serves ``/ask`` and ``/demo/*``. The demo route only
    accepts the script; ``/ask`` remains available for direct inspection.
    """

    from app.retrieval.demo import create_demo_service

    service = create_demo_service()
    return create_app(retrieval_service=service, demo_service=service)


__all__ = ["VERSION", "create_app", "create_demo_app"]
