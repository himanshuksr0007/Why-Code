"""A failing live answer must not be shown as an evidence refusal."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.retrieval.api.routes import LIVE_UNAVAILABLE, build_router
from app.retrieval.demo import create_demo_service


class FailingLive:
    generator = object()

    def answer_question(self, params: Any, **_: Any) -> Any:
        raise RuntimeError("LLM provider rate limit exceeded")


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(build_router(create_demo_service(), live_service=FailingLive()))
    return TestClient(app)


def test_live_failure_with_only_a_refusal_to_fall_back_on_is_a_retryable_error() -> None:
    response = _client().post(
        "/api/v1/ask",
        json={"question": "Why does the billing module round down?", "repo": "encode/httpx"},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == LIVE_UNAVAILABLE


def test_live_failure_still_falls_back_to_an_answer_the_graph_can_give() -> None:
    response = _client().post(
        "/api/v1/ask",
        json={"question": "Why are retries disabled by default?", "repo": "encode/httpx"},
    )
    assert response.status_code == 200
    assert response.json()["answer_status"] == "answered"
