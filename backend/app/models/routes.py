"""HTTP routes for model selection and token usage.

Mounted by ``app.main.create_app`` alongside the retrieval routes. Every
route is also served under ``/api/v1`` for symmetry with the answer API.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    CustomModelCreate,
    CustomModelView,
    ModelsResponse,
    UsageResponse,
)
from app.models.service import ModelService


def build_models_router(service: ModelService) -> APIRouter:
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
    ) -> UsageResponse:
        return service.usage(client_id, model_id)

    return router


__all__ = ["build_models_router"]
