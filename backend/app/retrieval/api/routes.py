"""Answer API routes. Mounted by ``app.main.create_app``."""

from __future__ import annotations

import os

import threading
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from app.retrieval.api.schemas import (
    AskRequest,
    AskResponse,
    EntityHistoryResponse,
    EvidenceDetail,
    FeedbackRequest,
    FeedbackResponse,
    RepoInfo,
    RepoListResponse,
    Suggestion,
    SuggestionResponse,
)
from app.retrieval.models import (
    AnswerConfidence,
    AnswerStatus,
    AskMode,
    NearestCandidate,
)
from app.retrieval.plan import build_plan
from app.retrieval.service import RetrievalService
from app.retrieval.structure import (
    build_structure_graph,
    is_structure_question,
    paths_from_contexts,
    summarize_structure,
)
from app.workspace.ratelimit import SlidingWindowRateLimiter

# Shown when the live answer path failed for a transient reason; distinct
# from an evidence refusal so users retry instead of concluding "no evidence".
LIVE_UNAVAILABLE = (
    "Why-Code couldn't finish this answer because a service it depends on "
    "(the language model or GitHub) failed or is busy. Please try again in a moment."
)


def build_router(
    service: RetrievalService | None,
    live_service: Any = None,
    model_service: Any = None,
    rate_limiter: SlidingWindowRateLimiter | None = None,
) -> APIRouter:
    router = APIRouter(tags=["retrieval"])
    feedback: list[FeedbackRequest] = []
    lock = threading.Lock()

    def require() -> RetrievalService:
        if service is None:
            raise HTTPException(
                status_code=503,
                detail="retrieval service is not configured",
            )
        return service

    def repo_or_400(current: RetrievalService, repo: str | None) -> str:
        try:
            return current.resolve_repo(repo)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    def resolve_custom_provider(request: AskRequest) -> Any:
        """The provider for the request's selected custom model, or None
        for the server default. A model id that names nothing the client
        owns is a client error, never a silent fall-back."""
        if not request.model_id or request.model_id == "default":
            return None
        if model_service is None:
            raise HTTPException(status_code=503, detail="model service is not configured")
        if not request.client_id:
            raise HTTPException(
                status_code=400, detail="client_id is required for a custom model"
            )
        from app.models.service import StoredKeyUnreadable

        try:
            provider = model_service.resolve_provider(request.client_id, request.model_id)
        except StoredKeyUnreadable:
            raise HTTPException(
                status_code=409,
                detail="this model's stored key cannot be read; delete and re-add the model",
            ) from None
        if provider is None:
            raise HTTPException(status_code=404, detail="custom model not found")
        return provider

    def record_usage(request: AskRequest, totals: dict[str, int]) -> None:
        if model_service is not None and request.client_id and totals:
            try:
                model_service.record_usage(request.client_id, totals)
            except Exception:
                import logging

                logging.getLogger("whycode").warning(
                    "usage recording failed", exc_info=True
                )

    def with_plan(request: AskRequest, response: AskResponse) -> AskResponse:
        """Plan mode: attach the structured plan built from the response's
        own retrieval, whichever pipeline produced the response."""
        if request.mode is AskMode.PLAN and response.plan is None:
            try:
                plan = build_plan(request.question, response)
            except Exception:
                import logging

                logging.getLogger("whycode").warning(
                    "plan construction failed", exc_info=True
                )
                return response
            return response.model_copy(update={"plan": plan})
        return response

    def with_structure(request: AskRequest, response: AskResponse) -> AskResponse:
        """Structure questions: attach the repository tree built from the
        file paths the retrieval surfaced — the response's own first,
        then every path the demo backend holds for the repo (a structure
        question matches no single decision, so per-question retrieval
        alone would refuse it). When the tree exists but the answer was
        a refusal, the answer becomes the tree's grounded summary."""
        if response.structure is None and is_structure_question(request.question):
            try:
                repo = resolve_repo_name(request.repo)
                extra: list[str] = []
                backend = getattr(service, "backend", None) if service else None
                contexts = getattr(backend, "contexts", None)
                if contexts:
                    extra = paths_from_contexts(contexts)
                graph = build_structure_graph(repo, response, extra_paths=extra)
            except Exception:
                import logging

                logging.getLogger("whycode").warning(
                    "structure construction failed", exc_info=True
                )
                return response
            if graph is not None:
                updates: dict[str, Any] = {"structure": graph}
                if response.answer_status is not AnswerStatus.ANSWERED:
                    updates.update(
                        {
                            "answer": summarize_structure(repo, graph),
                            "answer_status": AnswerStatus.ANSWERED,
                            "confidence": AnswerConfidence.MEDIUM,
                            "refusal_mode": None,
                            "caveats": [
                                *response.caveats,
                                "Structure derived from the files the index"
                                " has retrieved for this repository.",
                            ],
                        }
                    )
                return response.model_copy(update=updates)
        return response

    def finish(request: AskRequest, response: AskResponse) -> AskResponse:
        return with_structure(request, with_plan(request, response))

    def resolve_repo_name(repo: str | None) -> str:
        if repo and repo.strip():
            return repo.strip()
        if service is not None:
            try:
                return service.resolve_repo(repo)
            except Exception:
                pass
        default = os.environ.get("WHYCODE_DEFAULT_REPO", "").strip()
        if default:
            return default
        if getattr(live_service, "generator", None) is not None:
            # The hosted app's historical default; override per deploy.
            return "encode/httpx"
        raise HTTPException(status_code=400, detail="repo is required")

    @router.get("/repos", response_model=RepoListResponse)
    @router.get(
        "/api/v1/repos",
        response_model=RepoListResponse,
        include_in_schema=False,
    )
    def repos() -> RepoListResponse:
        current = require()
        items = [
            RepoInfo(**item)
            for item in current.list_repos()
            if isinstance(item, dict) and item.get("repo")
        ]
        return RepoListResponse(repos=items)

    @router.get("/suggestions", response_model=SuggestionResponse)
    @router.get(
        "/api/v1/suggestions",
        response_model=SuggestionResponse,
        include_in_schema=False,
    )
    def suggestions(repo: str | None = Query(default=None)) -> SuggestionResponse:
        current = require()
        resolved = repo_or_400(current, repo)
        items = [
            Suggestion(**item)
            for item in current.suggestions(resolved)
            if isinstance(item, dict) and item.get("question")
        ]
        return SuggestionResponse(repo=resolved, suggestions=items)

    @router.post("/ask", response_model=AskResponse)
    @router.post(
        "/api/v1/ask", response_model=AskResponse, include_in_schema=False
    )
    def ask(body: AskRequest, request: Request) -> AskResponse:
        if rate_limiter is not None:
            client = request.client.host if request.client else "unknown"
            allowed, retry_after = rate_limiter.check(client)
            if not allowed:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "Too many questions. Wait a moment before asking again; "
                        "this limit protects the operator's model quota."
                    ),
                    headers={"Retry-After": str(retry_after)},
                )
        repo = resolve_repo_name(body.repo)
        custom_provider = resolve_custom_provider(body)
        params = body.parameters()
        if not params.repo:
            params = params.model_copy(update={"repo": repo})
        live_failed = False
        if live_service is not None and (
            getattr(live_service, "generator", None) is not None
            or custom_provider is not None
        ):
            usage_sink: dict[str, int] = {}
            try:
                response = live_service.answer_question(
                    params, generator=custom_provider, usage_sink=usage_sink
                )
            except Exception as exc:
                import logging
                logging.getLogger("whycode").error("LiveService answer error: %s", exc, exc_info=True)
                live_failed = True
            else:
                return finish(body, response)
            finally:
                # Recorded once, here: on success it holds the call's full
                # usage; on failure, whatever was billed before the error.
                if usage_sink:
                    record_usage(body, usage_sink)
        if service is not None:
            response = service.ask(params)
            # WHY: after a live failure (model rate limit, bad JSON, GitHub
            # outage) the graph service can only refuse for a repository it
            # has not ingested. Showing that refusal told users "no evidence"
            # when the real cause was a transient error, so say so instead.
            if live_failed and response.answer_status is AnswerStatus.INSUFFICIENT_EVIDENCE:
                raise HTTPException(status_code=503, detail=LIVE_UNAVAILABLE)
            if custom_provider is not None and model_service is not None:
                from app.intent.llm.provider import RecordingProvider
                recorder = RecordingProvider(custom_provider)
                response = model_service.generate_custom_answer(
                    response, body.question, recorder
                )
                record_usage(body, recorder.totals())
            return finish(body, response)
        if live_failed:
            raise HTTPException(status_code=503, detail=LIVE_UNAVAILABLE)
        raise HTTPException(status_code=503, detail="retrieval service is not configured")

    @router.get("/evidence/{evidence_id}", response_model=EvidenceDetail)
    @router.get(
        "/api/v1/evidence/{evidence_id}",
        response_model=EvidenceDetail,
        include_in_schema=False,
    )
    def evidence(
        evidence_id: str, repo: str | None = Query(default=None)
    ) -> EvidenceDetail:
        resolved = resolve_repo_name(repo)
        if service is not None:
            item = service.get_evidence(evidence_id, repo=resolved)
            if item is not None:
                return EvidenceDetail(
                    evidence_id=item.evidence_id,
                    kind=item.kind,
                    record_type=item.kind,
                    source_type=item.kind,
                    url=item.url,
                    excerpt=item.excerpt,
                    author=item.author,
                    created_at=item.created_at,
                    pr_number=item.pr_number,
                    issue_number=item.issue_number,
                    commit_sha=item.commit_sha,
                    path=item.path,
                    start_line=item.start_line,
                    end_line=item.end_line,
                )
        # Only real records are served. A file is served when its content
        # was actually fetched from the repository; anything else is a 404,
        # never a synthesized placeholder.
        if live_service is not None and getattr(live_service, "gh", None) is not None:
            clean_path = evidence_id.split(":", 2)[-1] if ":" in evidence_id else evidence_id
            if "/" in clean_path or "." in clean_path:
                content = live_service.gh.file_content(resolved, clean_path)
                if content:
                    kind_val = "doc_file" if clean_path.endswith(".md") else "changed_file"
                    return EvidenceDetail(
                        evidence_id=evidence_id,
                        kind=kind_val,
                        record_type=kind_val,
                        source_type=kind_val,
                        url=f"https://github.com/{resolved}/blob/HEAD/{clean_path}",
                        excerpt="\n".join(content.splitlines()[:50]),
                        author=None,
                        created_at=None,
                        path=clean_path,
                    )
        raise HTTPException(status_code=404, detail="evidence not found")

    @router.get("/people")
    @router.get("/api/v1/people", include_in_schema=False)
    def list_people(repo: str | None = Query(default=None)):
        resolved = resolve_repo_name(repo)
        if live_service is not None:
            return live_service.get_people(resolved)
        return []

    @router.get("/people/{login}")
    @router.get("/api/v1/people/{login}", include_in_schema=False)
    def get_person(login: str, repo: str | None = Query(default=None)):
        resolved = resolve_repo_name(repo)
        if live_service is not None:
            return live_service.get_person_profile(resolved, login)
        raise HTTPException(status_code=404, detail="person not found")

    @router.get("/changes")
    @router.get("/api/v1/changes", include_in_schema=False)
    def list_changes(
        repo: str | None = Query(default=None),
        limit: int = Query(default=20, ge=1, le=100),
    ):
        resolved = resolve_repo_name(repo)
        if live_service is not None:
            return live_service.get_changes(resolved, limit=limit)
        return []

    @router.get("/pull-requests/{number}")
    @router.get("/api/v1/pull-requests/{number}", include_in_schema=False)
    def get_pull_request(number: int, repo: str | None = Query(default=None)):
        resolved = resolve_repo_name(repo)
        if live_service is not None:
            pr = live_service.get_pull_request(resolved, number)
            if pr:
                return pr
        raise HTTPException(status_code=404, detail=f"pull request #{number} not found")

    @router.get(
        "/entities/{entity_id:path}/history", response_model=EntityHistoryResponse
    )
    @router.get(
        "/api/v1/entities/{entity_id:path}/history",
        response_model=EntityHistoryResponse,
        include_in_schema=False,
    )
    def entity_history(
        entity_id: str, repo: str | None = Query(default=None)
    ) -> EntityHistoryResponse:
        resolved = resolve_repo_name(repo)
        if service is not None:
            contexts = service.entity_history(entity_id, repo=resolved)
            return EntityHistoryResponse(
                entity_id=entity_id,
                decisions=[
                    NearestCandidate(
                        decision_id=context.decision.decision_id,
                        claim=context.decision.claim,
                        status=context.decision.status,
                    )
                    for context in contexts
                ],
            )
        return EntityHistoryResponse(entity_id=entity_id, decisions=[])

    @router.post("/feedback", response_model=FeedbackResponse)
    @router.post(
        "/api/v1/feedback", response_model=FeedbackResponse, include_in_schema=False
    )
    def submit_feedback(request: FeedbackRequest) -> FeedbackResponse:
        with lock:
            feedback.append(request)
            number = len(feedback)
        return FeedbackResponse(feedback_id=f"fb_{number}")

    return router


__all__ = ["build_router"]
