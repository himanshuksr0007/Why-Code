"""The auth HTTP surface: status codes and payload shapes."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.routes import build_auth_router
from app.auth.service import AuthService, RateLimiter
from app.auth.store import SQLiteAuthStore


class CapturingMailer:
    """Records the codes the service mails, for assertions."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    def send_otp(self, to: str, code: str, *, purpose: str) -> None:
        self.sent.append((to, code))

    def code_for(self, email: str) -> str:
        return [code for to, code in self.sent if to == email][-1]


@pytest.fixture()
def client(tmp_path) -> tuple[TestClient, CapturingMailer]:
    mailer = CapturingMailer()
    service = AuthService(
        SQLiteAuthStore(str(tmp_path / "auth.db")),
        mailer,
        secret="route-secret",
        limiter=RateLimiter(),
    )
    app = FastAPI()
    app.include_router(build_auth_router(service))
    return TestClient(app), mailer


def test_http_lifecycle(client) -> None:
    http, mailer = client
    response = http.post(
        "/api/v1/auth/signup",
        json={"name": "Ada", "email": "ada@example.com", "password": "passw0rd9"},
    )
    assert response.status_code == 201, response.text
    assert response.json() == {"email": "ada@example.com", "otp_sent": True}

    response = http.post(
        "/api/v1/auth/verify-email",
        json={"email": "ada@example.com", "code": "999999"},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "code_mismatch"

    response = http.post(
        "/api/v1/auth/verify-email",
        json={"email": "ada@example.com", "code": mailer.code_for("ada@example.com")},
    )
    assert response.status_code == 200
    token = response.json()["token"]

    response = http.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "ada@example.com"

    assert http.get("/api/v1/auth/me").status_code == 401
    assert http.post("/api/v1/auth/logout").status_code == 204

    response = http.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "passw0rd9"},
    )
    assert response.status_code == 200
    assert response.json()["user"]["name"] == "Ada"


def test_http_validation_errors(client) -> None:
    http, _ = client
    response = http.post(
        "/api/v1/auth/signup",
        json={"name": "Ada", "email": "ada@example.com", "password": "weak"},
    )
    assert response.status_code == 422
    response = http.post(
        "/api/v1/auth/login",
        json={"email": "ghost@example.com", "password": "passw0rd9"},
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Invalid email or password.",
        "code": "invalid_credentials",
    }
