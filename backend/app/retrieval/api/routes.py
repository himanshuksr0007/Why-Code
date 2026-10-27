"""Answer API routes. Mounted by ``app.main.create_app``."""

from __future__ import annotations

import threading
from typing import Any

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


def build_router(
    service: RetrievalService | None,
    live_service: Any = None,
    model_service: Any = None,
) -> APIRouter:
    router = APIRouter(tags=["retrieval"])
    feedback: list[FeedbackRequest] = []
    lock = threading.Lock()

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

    def resolve_repo_name(repo: str | None) -> str:
        if repo and repo.strip():
            return repo.strip()
        if service is not None:
            try:
                return service.resolve_repo(repo)
            except Exception:
                pass
        return "encode/httpx"

    @router.post("/ask", response_model=AskResponse)
    @router.post(
        "/api/v1/ask", response_model=AskResponse, include_in_schema=False
    )
    def ask(request: AskRequest) -> AskResponse:
        repo = resolve_repo_name(request.repo)
        custom_provider = resolve_custom_provider(request)
        params = request.parameters()
        if not params.repo:
            params = params.model_copy(update={"repo": repo})
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
            else:
                return response
            finally:
                # Recorded once, here: on success it holds the call's full
                # usage; on failure, whatever was billed before the error.
                if usage_sink:
                    record_usage(request, usage_sink)
        if service is not None:
            response = service.ask(params)
            if custom_provider is not None and model_service is not None:
                from app.intent.llm.provider import RecordingProvider

                recorder = RecordingProvider(custom_provider)
                response = model_service.generate_custom_answer(
                    response, request.question, recorder
                )
                record_usage(request, recorder.totals())
            return response
        raise HTTPException(status_code=503, detail="retrieval service is not configured")

    @router.get("/decisions")
    @router.get("/api/v1/decisions", include_in_schema=False)
    def list_decisions(repo: str | None = Query(default=None)):
        resolved = resolve_repo_name(repo)
        if live_service is not None:
            return live_service.list_decisions(resolved)
        return []

    @router.get("/decisions/{decision_id}", response_model=DecisionDetail)
    @router.get(
        "/api/v1/decisions/{decision_id}",
        response_model=DecisionDetail,
        include_in_schema=False,
    )
    def decision(
        decision_id: str, repo: str | None = Query(default=None)
    ) -> DecisionDetail:
        resolved = resolve_repo_name(repo)
        if service is not None:
            context = service.get_decision(decision_id, repo=resolved)
            if context is not None:
                return DecisionDetail.from_context(context)
        if live_service is not None:
            threads = live_service.list_decisions(resolved)
            for thread in threads:
                for step in thread.get("steps", []):
                    d = step.get("decision", {})
                    if d.get("decision_id") == decision_id:
                        targets = [
                            f"{t.get('type')}:{t.get('identifier')}"
                            for t in d.get("targets", [])
                        ]
                        return DecisionDetail(
                            decision_id=decision_id,
                            claim=d.get("claim", ""),
                            rationale=d.get("rationale") or d.get("claim", ""),
                            status=d.get("status", "active"),
                            confidence=d.get("confidence", "high"),
                            targets=targets,
                            evidence=[],
                            graph_path=targets,
                            supersession=[],
                        )
        raise HTTPException(status_code=404, detail="decision not found")

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
        excerpt = evidence_id
        path = evidence_id if ("/" in evidence_id or "." in evidence_id) else None
        if live_service is not None and getattr(live_service, "gh", None) is not None:
            clean_path = evidence_id.split(":", 2)[-1] if ":" in evidence_id else evidence_id
            if "/" in clean_path or "." in clean_path:
                content = live_service.gh.file_content(resolved, clean_path)
                if content:
                    excerpt = "\n".join(content.splitlines()[:50])
                    path = clean_path
        url = f"https://github.com/{resolved}"
        if path:
            url = f"https://github.com/{resolved}/blob/main/{path}"
        kind_val = "doc_file" if (evidence_id.endswith(".md") or "doc" in evidence_id.lower()) else "changed_file"
        return EvidenceDetail(
            evidence_id=evidence_id,
            kind=kind_val,
            record_type=kind_val,
            source_type=kind_val,
            url=url,
            excerpt=excerpt,
            author="maintainers",
            created_at=None,
            path=path,
        )

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
