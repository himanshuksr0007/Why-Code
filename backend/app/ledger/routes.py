"""HTTP API over the decision ledger.

Reads are public for indexed repositories. Writes (authority actions,
recording) require ``Authorization: Bearer $WHYCODE_LEDGER_ADMIN_TOKEN``; with
no token configured, writes are disabled (503) rather than open.
"""

from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.ledger.models import (
    Action,
    AuthorityEvent,
    Currency,
    Decision,
    Evidence,
    SignerKind,
    Source,
    Status,
    first_sentence,
)
from app.ledger.pr_check import check_change, render_markdown
from app.ledger.store import LedgerError, LedgerStore
from app.ledger.why import WhyEngine


class RecordBody(BaseModel):
    repo: str
    decision: str = Field(min_length=3)
    rationale: str = ""
    title: str | None = None
    context: str = ""
    alternatives: list[str] = Field(default_factory=list)
    affects: list[str] = Field(default_factory=list)
    evidence_commit: str | None = None
    signer: str
    signer_kind: SignerKind = SignerKind.PERSON
    accept: bool = False


class ActionBody(BaseModel):
    reason: str = ""
    signer: str
    signer_kind: SignerKind = SignerKind.PERSON
    scope: list[str] = Field(default_factory=list)
    evidence_ref: str | None = None
    superseded_by: str | None = None
    force: bool = False


class CheckBody(BaseModel):
    repo: str
    changed_files: list[str]
    pr_body: str | None = None


def build_ledger_router(store: LedgerStore, *, admin_token: str | None = None) -> APIRouter:
    router = APIRouter(prefix="/api/v1/ledger", tags=["ledger"])
    engine = WhyEngine(store)
    token = admin_token if admin_token is not None else os.environ.get("WHYCODE_LEDGER_ADMIN_TOKEN")

    def require_admin(authorization: str | None) -> None:
        if not token:
            raise HTTPException(status_code=503, detail="ledger writes are not configured")
        supplied = (authorization or "").removeprefix("Bearer ").strip()
        if not supplied or not hmac.compare_digest(supplied, token):
            raise HTTPException(status_code=401, detail="invalid ledger token")

    @router.get("/repos")
    def repos() -> dict[str, Any]:
        return {"repos": store.repos()}

    @router.get("/why")
    def why(
        repo: str,
        query: str | None = None,
        targets: list[str] = Query(default=[]),  # noqa: B008 - FastAPI idiom
        include_history: bool = False,
    ) -> dict[str, Any]:
        return engine.get_why(repo, query=query, targets=targets, include_history=include_history)

    @router.get("/decisions")
    def decisions(
        repo: str,
        status: Status | None = None,
        currency: Currency | None = None,
    ) -> dict[str, Any]:
        rows = store.list_decisions(
            repo,
            statuses=[status] if status else None,
            currencies=[currency] if currency else None,
        )
        return {"repo": repo, "decisions": [engine.card(d) for d in rows]}

    @router.get("/decisions/{decision_id}")
    def decision(decision_id: str) -> dict[str, Any]:
        found = store.get(decision_id)
        if found is None:
            raise HTTPException(status_code=404, detail="decision not found")
        card = engine.card(found, *engine._git(found.repo))
        card["authority_log"] = [e.model_dump() for e in store.history(found.decision_id)]
        return card

    @router.post("/check")
    def check(body: CheckBody) -> dict[str, Any]:
        result = check_change(engine, body.repo, body.changed_files, body.pr_body)
        return {**result.as_dict(), "markdown": render_markdown(result)}

    @router.post("/decisions", status_code=201)
    def record(
        body: RecordBody, authorization: str | None = Header(default=None)
    ) -> dict[str, Any]:
        require_admin(authorization)
        accepted = body.accept and body.signer_kind is SignerKind.PERSON
        decision = Decision(
            repo=body.repo,
            title=body.title or first_sentence(body.decision),
            decision=body.decision,
            rationale=body.rationale,
            context=body.context,
            alternatives=body.alternatives,
            scope=body.affects,
            source=Source.AGENT if body.signer_kind is SignerKind.AGENT else Source.MANUAL,
            status=Status.ACCEPTED if accepted else Status.PROPOSED,
            confidence=0.9 if accepted else 0.7,
            evidence=(
                [Evidence(kind="commit", quote=body.decision, commit_sha=body.evidence_commit)]
                if body.evidence_commit
                else []
            ),
        )
        try:
            stored = store.record(
                decision,
                AuthorityEvent(
                    decision_id="",
                    action=Action.ACCEPT if accepted else Action.RECORD,
                    reason="recorded through the API",
                    signer=body.signer,
                    signer_kind=body.signer_kind,
                    scope=body.affects,
                ),
            )
        except LedgerError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from None
        return engine.card(stored)

    @router.post("/decisions/{decision_id}/{action}")
    def act(
        decision_id: str,
        action: Action,
        body: ActionBody,
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        require_admin(authorization)
        if action in {Action.RECORD, Action.MERGE}:
            raise HTTPException(status_code=400, detail=f"{action.value} is not a direct action")
        try:
            updated = store.act(
                decision_id,
                AuthorityEvent(
                    decision_id=decision_id,
                    action=action,
                    reason=body.reason,
                    signer=body.signer,
                    signer_kind=body.signer_kind,
                    scope=body.scope,
                    evidence_ref=body.evidence_ref,
                ),
                superseded_by=body.superseded_by,
                force=body.force,
            )
        except LedgerError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from None
        return engine.card(updated)

    return router


__all__ = ["build_ledger_router"]
