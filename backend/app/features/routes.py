"""HTTP routes for the features package.

Mounted alongside the retrieval router by ``create_app``. Read
endpoints serve only data the retrieval layer has already
materialized, so they stay fast; the webhook endpoint is inert (503)
until ``WHYCODE_WEBHOOK_SECRET`` is configured, and rejects unsigned
or badly signed deliveries with 401.
"""

from __future__ import annotations

import json
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from app.features.records import (
    AuditReport,
    DecisionRecord,
    RecordProvider,
    RecordsPage,
    SupersessionPair,
    audit_report,
    filter_records,
    supersession_pairs,
    to_adr_markdown,
)
from app.features.webhooks import WebhookStore, handle_github_event, verify_signature


def build_feature_router(
    service: Any,
    *,
    live_service: Any = None,
    webhook_store: WebhookStore | None = None,
    webhook_secret: str | None = None,
) -> APIRouter:
    router = APIRouter(tags=["features"])
    provider = RecordProvider(service, live_service)

    def resolve_repo(repo: str | None) -> str:
        if repo:
            return repo
        known = provider.known_repos()
        if known:
            return known[0]
        if service is not None:
            return service.resolve_repo(None)
        raise HTTPException(status_code=400, detail="repo is required")

    @router.get("/api/v1/records", response_model=RecordsPage)
    def list_records(
        repo: str | None = Query(default=None),
        q: str | None = Query(default=None),
        status: str | None = Query(default=None),
        kind: str | None = Query(default=None),
        target: str | None = Query(default=None),
        date_from: str | None = Query(default=None),
        date_to: str | None = Query(default=None),
        limit: int = Query(default=25, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ) -> RecordsPage:
        resolved = resolve_repo(repo)
        filtered = filter_records(
            provider.records_for(resolved),
            q=q,
            status=status,
            kind=kind,
            target=target,
            date_from=date_from,
            date_to=date_to,
        )
        return RecordsPage(
            total=len(filtered),
            limit=limit,
            offset=offset,
            records=filtered[offset : offset + limit],
        )

    @router.get("/api/v1/records/{decision_id}", response_model=DecisionRecord)
    def get_record(
        decision_id: str, repo: str | None = Query(default=None)
    ) -> DecisionRecord:
        resolved = resolve_repo(repo)
        for record in provider.records_for(resolved):
            if record.decision_id == decision_id:
                return record
        raise HTTPException(status_code=404, detail="decision record not found")

    @router.get("/api/v1/search")
    def search(
        q: str = Query(min_length=1),
        repo: str | None = Query(default=None),
        limit: int = Query(default=25, ge=1, le=100),
    ) -> dict[str, Any]:
        """Cross-repo decision search over every repo the server holds."""
        repos = [repo] if repo else provider.known_repos()
        results: list[DecisionRecord] = []
        for candidate_repo in repos:
            results.extend(
                filter_records(provider.records_for(candidate_repo), q=q)
            )
        results.sort(key=lambda r: r.created_at or "", reverse=True)
        return {
            "query": q,
            "repos": repos,
            "total": len(results),
            "results": results[:limit],
        }

    @router.get("/api/v1/supersessions", response_model=list[SupersessionPair])
    def list_supersessions(
        repo: str | None = Query(default=None),
    ) -> list[SupersessionPair]:
        resolved = resolve_repo(repo)
        return supersession_pairs(provider.records_for(resolved))

    @router.get("/api/v1/audit", response_model=AuditReport)
    def get_audit(repo: str | None = Query(default=None)) -> AuditReport:
        resolved = resolve_repo(repo)
        return audit_report(provider.records_for(resolved), resolved)

    @router.get("/api/v1/records/{decision_id}/export")
    def export_record(
        decision_id: str,
        repo: str | None = Query(default=None),
        format: str = Query(default="md", pattern="^(md|json)$"),
    ) -> Any:
        resolved = resolve_repo(repo)
        for record in provider.records_for(resolved):
            if record.decision_id == decision_id:
                if format == "json":
                    return record
                return PlainTextResponse(
                    to_adr_markdown(record),
                    media_type="text/markdown",
                    headers={
                        "Content-Disposition": (
                            f'attachment; filename="{decision_id}.md"'
                        )
                    },
                )
        raise HTTPException(status_code=404, detail="decision record not found")

    @router.post("/api/v1/webhooks/github", status_code=202)
    async def github_webhook(request: Request) -> dict[str, Any]:
        if webhook_store is None or not webhook_secret:
            raise HTTPException(
                status_code=503,
                detail="webhook receiver is not configured",
            )
        body = await request.body()
        signature = request.headers.get("x-hub-signature-256")
        if not verify_signature(webhook_secret, body, signature):
            raise HTTPException(status_code=401, detail="invalid signature")
        try:
            payload = json.loads(body or b"{}")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="invalid JSON") from None
        return handle_github_event(
            webhook_store,
            delivery_id=request.headers.get("x-github-delivery") or "",
            event=request.headers.get("x-github-event") or "",
            payload=payload,
            invalidate=provider.invalidate,
        )

    @router.get("/api/v1/webhooks/events")
    def webhook_events(
        limit: int = Query(default=20, ge=1, le=100),
    ) -> dict[str, Any]:
        if webhook_store is None:
            return {"events": [], "jobs": []}
        return webhook_store.recent(limit=limit)

    # Manual refresh: the no-setup alternative to webhooks. Invalidating
    # a repo makes the next read re-derive its decisions; a per-repo
    # cooldown keeps the endpoint from being used to force expensive
    # re-derivation in a loop.
    refresh_cooldown_seconds = 60.0
    last_refresh: dict[str, float] = {}

    @router.post("/api/v1/repos/refresh")
    def refresh_repo(repo: str = Query(min_length=1)) -> dict[str, Any]:
        now = time.monotonic()
        previous = last_refresh.get(repo, 0.0)
        if now - previous < refresh_cooldown_seconds:
            retry_after = int(refresh_cooldown_seconds - (now - previous)) + 1
            raise HTTPException(
                status_code=429,
                detail="this repository was refreshed just now",
                headers={"Retry-After": str(retry_after)},
            )
        last_refresh[repo] = now
        provider.invalidate(repo)
        job_id = (
            webhook_store.record_job(
                kind="manual_refresh",
                repo=repo,
                detail=(
                    "Refresh requested from the site; cached decision"
                    " threads invalidated, decisions re-derive on next read."
                ),
            )
            if webhook_store is not None
            else None
        )
        return {"repo": repo, "refreshed": True, "job_id": job_id}

    return router
