"""GitHub webhook delivery and event history routes."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from app.features.webhooks import WebhookStore, handle_github_event, verify_signature


def build_webhook_router(
    *,
    webhook_store: WebhookStore | None = None,
    webhook_secret: str | None = None,
    ledger: Any = None,
) -> APIRouter:
    router = APIRouter(tags=["webhooks"])

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
            ledger=ledger,
        )

    @router.get("/api/v1/webhooks/events")
    def webhook_events(
        limit: int = Query(default=20, ge=1, le=100),
    ) -> dict[str, Any]:
        if webhook_store is None:
            return {"events": [], "jobs": []}
        return webhook_store.recent(limit=limit)

    return router
