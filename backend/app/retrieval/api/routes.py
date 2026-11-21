"""Answer API routes. Mounted by ``app.main.create_app``."""

from __future__ import annotations

import threading

from fastapi import APIRouter, HTTPException, Query, Request

from app.retrieval.api.schemas import (
    AskRequest,
    AskResponse,
    DecisionDetail,
    EntityHistoryResponse,
    EvidenceDetail,
    FeedbackRequest,
    FeedbackResponse,
    RepoInfo,
    RepoListResponse,
    Suggestion,
    SuggestionResponse,
)
from app.retrieval.models import NearestCandidate
from app.retrieval.service import RetrievalService
from app.workspace.ratelimit import SlidingWindowRateLimiter


def build_router(
    service: RetrievalService | None,
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
        current = require()
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
        repo_or_400(current, body.repo)
        return current.ask(body.parameters())

    @router.get("/decisions/{decision_id}", response_model=DecisionDetail)
    @router.get(
        "/api/v1/decisions/{decision_id}",
        response_model=DecisionDetail,
        include_in_schema=False,
    )
    def decision(
        decision_id: str, repo: str | None = Query(default=None)
    ) -> DecisionDetail:
        current = require()
        resolved = repo_or_400(current, repo)
        context = current.get_decision(decision_id, repo=resolved)
        if context is None:
            raise HTTPException(status_code=404, detail="decision not found")
        return DecisionDetail.from_context(context)

    @router.get("/evidence/{evidence_id}", response_model=EvidenceDetail)
    @router.get(
        "/api/v1/evidence/{evidence_id}",
        response_model=EvidenceDetail,
        include_in_schema=False,
    )
    def evidence(
        evidence_id: str, repo: str | None = Query(default=None)
    ) -> EvidenceDetail:
        current = require()
        resolved = repo_or_400(current, repo)
        item = current.get_evidence(evidence_id, repo=resolved)
        if item is None:
            raise HTTPException(status_code=404, detail="evidence not found")
        return EvidenceDetail(
            evidence_id=item.evidence_id,
            kind=item.kind,
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
        current = require()
        resolved = repo_or_400(current, repo)
        contexts = current.entity_history(entity_id, repo=resolved)
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

    @router.post("/feedback", response_model=FeedbackResponse)
    @router.post(
        "/api/v1/feedback", response_model=FeedbackResponse, include_in_schema=False
    )
    def submit_feedback(request: FeedbackRequest) -> FeedbackResponse:
        with lock:
            feedback.append(request)
            number = len(feedback)
        return FeedbackResponse(feedback_id=f"fb_{number}")

    # Retained for the demo UI's "what did the judge say?" panel.
    return router


__all__ = ["build_router"]
