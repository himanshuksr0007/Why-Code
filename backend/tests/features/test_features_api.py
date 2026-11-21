"""Signed webhook receiver and retirement of the Decisions APIs."""

from __future__ import annotations

import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from app.main import create_demo_app

REPO = "encode/httpx"


@pytest.fixture()
def client() -> TestClient:
    return TestClient(create_demo_app())


def _sign(secret: str, body: bytes) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


@pytest.fixture()
def webhook_client(tmp_path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("WHYCODE_WEBHOOK_SECRET", "test-secret")
    monkeypatch.setenv("WHYCODE_WEBHOOK_DB", str(tmp_path / "hooks.db"))
    return TestClient(create_demo_app())


def test_webhook_rejects_bad_signature(webhook_client: TestClient) -> None:
    body = json.dumps({"action": "closed"}).encode()
    response = webhook_client.post(
        "/api/v1/webhooks/github",
        content=body,
        headers={
            "x-hub-signature-256": "sha256=deadbeef",
            "x-github-event": "pull_request",
            "x-github-delivery": "d-1",
        },
    )
    assert response.status_code == 401


def test_webhook_merged_pr_records_event_and_dedupes(
    webhook_client: TestClient,
) -> None:
    payload = {
        "action": "closed",
        "repository": {"full_name": REPO},
        "pull_request": {"number": 1525, "title": "Retry defaults", "merged": True},
    }
    body = json.dumps(payload).encode()
    headers = {
        "x-hub-signature-256": _sign("test-secret", body),
        "x-github-event": "pull_request",
        "x-github-delivery": "d-2",
    }
    first = webhook_client.post("/api/v1/webhooks/github", content=body, headers=headers)
    assert first.status_code == 202
    assert first.json()["recorded"] is True
    assert first.json()["job_id"] is None

    again = webhook_client.post("/api/v1/webhooks/github", content=body, headers=headers)
    assert again.json()["recorded"] is False

    events = webhook_client.get("/api/v1/webhooks/events").json()
    assert len(events["events"]) == 1
    assert events["events"][0]["pr_number"] == 1525
    assert events["jobs"] == []


def test_webhook_unconfigured_is_503(client: TestClient) -> None:
    response = client.post("/api/v1/webhooks/github", content=b"{}")
    assert response.status_code == 503


@pytest.mark.parametrize(
    "method, path",
    [
        ("GET", "/api/v1/decisions"),
        ("GET", "/api/v1/decisions/dec_001"),
        ("GET", "/decisions/dec_001"),
        ("GET", "/api/v1/records"),
        ("GET", "/api/v1/records/dec_001"),
        ("GET", "/api/v1/records/dec_001/export"),
        ("GET", "/api/v1/search"),
        ("GET", "/api/v1/supersessions"),
        ("GET", "/api/v1/audit"),
        ("POST", "/api/v1/repos/refresh"),
    ],
)
def test_retired_decision_routes_return_404(client: TestClient, method: str, path: str) -> None:
    assert client.request(method, path, params={"repo": REPO}).status_code == 404
