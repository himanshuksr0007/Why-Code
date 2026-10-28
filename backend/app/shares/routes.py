"""HTTP routes for shared chats, under /api/v1/shares."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.shares.service import ShareError, ShareService


class ShareTurn(BaseModel):
    question: str = Field(max_length=8_000)
    answer: str = Field(default="", max_length=120_000)
    answer_status: str = Field(default="", max_length=40)
    repo: str = Field(default="", max_length=200)
    mode: str = Field(default="", max_length=20)
    error: str = Field(default="", max_length=2_000)
    attachments: list[dict[str, Any]] = Field(default_factory=list, max_length=12)


class PublishShareRequest(BaseModel):
    chat_id: str = Field(min_length=1, max_length=120)
    title: str = Field(default="", max_length=300)
    repo: str = Field(default="", max_length=200)
    visibility: str = Field(default="public", max_length=10)
    whitelist: list[str] = Field(default_factory=list, max_length=60)
    turns: list[ShareTurn] = Field(default_factory=list, max_length=200)


def _bearer(authorization: str | None) -> str:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


def _error(exc: ShareError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status, content={"detail": exc.detail, "code": exc.code}
    )


def build_share_router(service: ShareService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/shares", tags=["shares"])

    @router.post("")
    def publish(
        body: PublishShareRequest,
        authorization: str | None = Header(default=None),
    ) -> JSONResponse:
        try:
            payload = service.publish(
                token=_bearer(authorization),
                chat_id=body.chat_id,
                title=body.title,
                repo=body.repo,
                visibility=body.visibility,
                whitelist=body.whitelist,
                turns=[turn.model_dump() for turn in body.turns],
            )
        except ShareError as exc:
            return _error(exc)
        return JSONResponse(content=payload)

    @router.get("/by-chat/{chat_id}")
    def my_share(
        chat_id: str, authorization: str | None = Header(default=None)
    ) -> JSONResponse:
        try:
            payload = service.my_share(
                token=_bearer(authorization), chat_id=chat_id
            )
        except ShareError as exc:
            return _error(exc)
        return JSONResponse(content=payload)

    @router.get("/{share_id}")
    def view(
        share_id: str, authorization: str | None = Header(default=None)
    ) -> JSONResponse:
        try:
            payload = service.view(
                token=_bearer(authorization), share_id=share_id
            )
        except ShareError as exc:
            return _error(exc)
        return JSONResponse(content=payload)

    @router.delete("/{share_id}")
    def unpublish(
        share_id: str, authorization: str | None = Header(default=None)
    ) -> JSONResponse:
        try:
            service.unpublish(token=_bearer(authorization), share_id=share_id)
        except ShareError as exc:
            return _error(exc)
        return JSONResponse(status_code=204, content=None)

    return router
