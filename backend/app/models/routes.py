"""HTTP routes for model selection and token usage.

Mounted by ``app.main.create_app`` alongside the retrieval routes. Every
route is also served under ``/api/v1`` for symmetry with the answer API.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query

from app.auth.service import AuthError, AuthService
from app.models.schemas import (
    CustomModelCreate,
    CustomModelView,
    ModelsResponse,
    UsageResponse,
)
from app.models.service import ModelService


def build_models_router(
    service: ModelService, auth_service: AuthService | None = None
) -> APIRouter:
    router = APIRouter(tags=["models"])

    @router.get("/models", response_model=ModelsResponse)
    @router.get("/api/v1/models", response_model=ModelsResponse, include_in_schema=False)
    def list_models(client_id: str = Query(default="")) -> ModelsResponse:
        return service.list_models(client_id)

    @router.post("/models/custom", response_model=CustomModelView, status_code=201)
    @router.post(
        "/api/v1/models/custom",
        response_model=CustomModelView,
        status_code=201,
        include_in_schema=False,
    )
    def create_custom(payload: CustomModelCreate) -> CustomModelView:
        return service.create_custom(payload)

    @router.delete("/models/custom/{model_id}")
    @router.delete("/api/v1/models/custom/{model_id}", include_in_schema=False)
    def delete_custom(
        model_id: str, client_id: str = Query(min_length=1)
    ) -> dict[str, bool]:
        if not service.delete_custom(client_id, model_id):
            raise HTTPException(status_code=404, detail="custom model not found")
        return {"deleted": True}

    @router.get("/usage", response_model=UsageResponse)
    @router.get("/api/v1/usage", response_model=UsageResponse, include_in_schema=False)
    def usage(
        client_id: str = Query(default=""),
        model_id: str = Query(default="default"),
        authorization: str | None = Header(default=None),
    ) -> UsageResponse:
        # Usage figures are the caller's own consumption against the
        # shared provider key — operational data, not public content.
        # When the auth service is wired (production), a valid app
        # session is required; without one the request is refused
        # rather than answered for an arbitrary client_id.
        if auth_service is not None:
            token = ""
            if authorization and authorization.lower().startswith("bearer "):
                token = authorization[7:].strip()
            try:
                auth_service.me(token)
            except AuthError as exc:
                raise HTTPException(
                    status_code=exc.status, detail=exc.detail
                ) from exc
        return service.usage(client_id, model_id)

    return router


__all__ = ["build_models_router"]
