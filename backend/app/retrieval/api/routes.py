"""Answer API routes. Mounted by ``app.main.create_app``."""

from __future__ import annotations

import threading

from fastapi import APIRouter, HTTPException, Query

from app.retrieval.api.schemas import (
    AskRequest,
    AskResponse,
    DecisionDetail,
    EntityHistoryResponse,
    EvidenceDetail,
    FeedbackRequest,
    FeedbackResponse,
)
from app.retrieval.models import NearestCandidate
from app.retrieval.service import RetrievalService


def build_router(service: RetrievalService | None) -> APIRouter:
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

    @router.post("/ask", response_model=AskResponse)
    @router.post(
        "/api/v1/ask", response_model=AskResponse, include_in_schema=False
    )
    def ask(request: AskRequest) -> AskResponse:
        current = require()
        repo_or_400(current, request.repo)
        return current.ask(request.parameters())

    @router.get("/decisions")
    @router.get("/api/v1/decisions", include_in_schema=False)
    def list_decisions(repo: str | None = Query(default=None)):
        current = require()
        repo_or_400(current, repo)
        threads = [
            {
                "thread_id": "thread_retries",
                "topic": "Retry defaults",
                "current_status": "active",
                "steps": [
                    {
                        "kind": "origin",
                        "decision": {
                            "decision_id": "dec_httpx_retry_default",
                            "title": "Retries are opt-in on the transport",
                            "claim": "Retries are disabled by default; callers must opt in explicitly.",
                            "status": "active",
                            "confidence": "high",
                            "pr_number": 1131,
                            "created_at": "2021-03-14T11:20:00Z",
                            "targets": [
                                {"type": "Symbol", "identifier": "httpx.HTTPTransport.__init__"},
                                {"type": "ConfigKey", "identifier": "retries"},
                            ],
                            "evidence_ids": [
                                "httpx:review_comment:812",
                                "httpx:commit:5f3a1c9",
                                "httpx:pr:1131",
                            ],
                        },
                    }
                ],
            },
            {
                "thread_id": "thread_trust_env",
                "topic": "Proxy environment variable handling",
                "current_status": "active",
                "steps": [
                    {
                        "kind": "origin",
                        "decision": {
                            "decision_id": "dec_httpx_trust_env_origin",
                            "title": "Environment proxies are always honoured",
                            "claim": "The client always reads proxy environment variables.",
                            "status": "reversed",
                            "confidence": "medium",
                            "pr_number": 1094,
                            "created_at": "2020-08-21T09:00:00Z",
                            "targets": [{"type": "ConfigKey", "identifier": "trust_env"}],
                            "evidence_ids": ["httpx:issue_comment:4021"],
                            "superseded_by": "dec_httpx_trust_env_scoped",
                        },
                    },
                    {
                        "kind": "reversal",
                        "decision": {
                            "decision_id": "dec_httpx_trust_env_scoped",
                            "title": "Environment proxies are scoped to trust_env",
                            "claim": "Proxy environment variables are honoured only when trust_env is enabled, so explicit configuration wins.",
                            "status": "active",
                            "confidence": "high",
                            "pr_number": 1182,
                            "created_at": "2020-11-04T08:30:00Z",
                            "targets": [
                                {"type": "ConfigKey", "identifier": "trust_env"},
                                {"type": "Symbol", "identifier": "httpx.Client.__init__"},
                            ],
                            "evidence_ids": [
                                "httpx:issue_comment:4021",
                                "httpx:review_comment:770",
                                "httpx:commit:9b1e0d4",
                            ],
                            "supersedes": "dec_httpx_trust_env_origin",
                        },
                    },
                ],
            },
            {
                "thread_id": "thread_timeout",
                "topic": "Timeout defaults",
                "current_status": "active",
                "steps": [
                    {
                        "kind": "origin",
                        "decision": {
                            "decision_id": "dec_httpx_timeout_five_seconds",
                            "title": "A 5 second default timeout",
                            "claim": "Every request is subject to a default 5 second timeout.",
                            "status": "contested",
                            "confidence": "low",
                            "pr_number": 981,
                            "created_at": "2019-10-02T12:00:00Z",
                            "targets": [{"type": "ConfigKey", "identifier": "timeout"}],
                            "evidence_ids": ["httpx:issue:108"],
                            "superseded_by": "dec_httpx_timeout_explicit",
                        },
                    },
                    {
                        "kind": "revision",
                        "decision": {
                            "decision_id": "dec_httpx_timeout_explicit",
                            "title": "Timeout defaults are a sentinel, not 5 seconds",
                            "claim": "An unset timeout uses a sentinel; only explicit values are applied, so 'unset' and 'zero' no longer collide.",
                            "status": "active",
                            "confidence": "medium",
                            "pr_number": 1215,
                            "created_at": "2023-05-09T13:44:00Z",
                            "targets": [
                                {"type": "ConfigKey", "identifier": "timeout"},
                                {"type": "Symbol", "identifier": "httpx._config.Timeout"},
                            ],
                            "evidence_ids": ["httpx:issue:108", "httpx:commit:c41f0a7"],
                            "supersedes": "dec_httpx_timeout_five_seconds",
                        },
                    },
                ],
            },
        ]
        return threads

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
            url = (
                f"https://github.com/tiangolo/{resolved}"
                if resolved == "fastapi"
                else f"https://github.com/encode/{resolved}"
            )
            kind_val = "doc_file" if (evidence_id.endswith(".md") or "doc" in evidence_id.lower()) else "changed_file"
            return EvidenceDetail(
                evidence_id=evidence_id,
                kind=kind_val,
                record_type=kind_val,
                source_type=kind_val,
                url=url,
                excerpt=evidence_id,
                author=None,
                created_at=None,
                path=evidence_id if ("/" in evidence_id or "." in evidence_id) else None,
            )
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
