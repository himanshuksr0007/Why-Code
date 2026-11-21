"""The auth HTTP surface: the Clerk bridge and session endpoints."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.routes import build_auth_router
from app.auth.service import AuthService, RateLimiter
from app.auth.store import SQLiteAuthStore


@pytest.fixture()
def client(tmp_path) -> TestClient:
    service = AuthService(
        SQLiteAuthStore(str(tmp_path / "auth.db")),
        secret="test-secret",
        limiter=RateLimiter(),
    )
    app = FastAPI()
    app.include_router(build_auth_router(service))
    return TestClient(app)


def test_social_exchange_503_until_clerk_configured(client) -> None:
    response = client.post(
        "/api/v1/auth/social", json={"token": "x" * 40}
    )
    assert response.status_code == 503
    assert response.json()["code"] == "social_not_configured"


def test_me_requires_a_session(client) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["code"] == "no_session"


def test_direct_auth_routes_are_gone(client) -> None:
    """Sign-up / login moved to Clerk; the old endpoints must not linger
    as a second, weaker front door."""
    for path in ("/api/v1/auth/signup", "/api/v1/auth/login",
                 "/api/v1/auth/verify-email", "/api/v1/auth/resend-otp"):
        response = client.post(path, json={})
        assert response.status_code == 404, path


def test_logout_is_a_noop_204(client) -> None:
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 204
