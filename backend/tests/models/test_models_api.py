"""End-to-end over HTTP: model CRUD, custom-model ask routing, and the
usage meter — against the demo retrieval service and a stub
OpenAI-compatible endpoint standing in for the visitor's own model API.
"""

from __future__ import annotations

import json
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
from cryptography.fernet import Fernet
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.crypto import KeyCipher
from app.models.routes import build_models_router
from app.models.service import DefaultModelInfo, ModelService
from app.models.store import InMemoryModelStore
from app.retrieval.api.routes import build_router
from app.retrieval.demo import create_demo_service

CLIENT = "client-test-0001"
QUESTION = "Why are retries disabled by default in httpx?"


class _StubHandler(BaseHTTPRequestHandler):
    def log_message(self, *args: object) -> None:
        pass

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        self.rfile.read(length)
        payload = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(
                            {"answer": "Answer from the visitor's own model [E1]."}
                        ),
                    }
                }
            ],
            "usage": {"prompt_tokens": 111, "completion_tokens": 22, "total_tokens": 133},
        }
        raw = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


@pytest.fixture()
def stub_endpoint() -> Iterator[str]:
    server = HTTPServer(("127.0.0.1", 0), _StubHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}/v1"
    server.shutdown()


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    # The provider builds a real httpx client; ambient proxy variables in
    # the environment must not reroute the loopback stub.
    for name in (
        "http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
        "ALL_PROXY", "all_proxy", "no_proxy", "NO_PROXY",
    ):
        monkeypatch.delenv(name, raising=False)
    service = ModelService(
        store=InMemoryModelStore(),
        cipher=KeyCipher(Fernet(Fernet.generate_key())),
        default=DefaultModelInfo(
            model="nvidia/llama-3.1-nemotron-ultra-253b-v1",
            base_url="https://integrate.api.nvidia.com/v1",
            context_tokens=131_072,
        ),
    )
    app = FastAPI()
    app.include_router(build_router(create_demo_service(), model_service=service))
    app.include_router(build_models_router(service))
    return TestClient(app)


def _create(client: TestClient, endpoint: str) -> dict:
    response = client.post(
        "/api/v1/models/custom",
        json={
            "client_id": CLIENT,
            "name": "My model",
            "model": "stub-v1",
            "endpoint": endpoint,
            "api_key": "sk-test-1234567890",
            "context_tokens": 64_000,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_default_model_is_the_configured_one(client: TestClient) -> None:
    body = client.get("/api/v1/models", params={"client_id": CLIENT}).json()
    assert body["default"]["name"] == "NVIDIA Nemotron Ultra"
    assert body["default"]["model"] == "nvidia/llama-3.1-nemotron-ultra-253b-v1"
    assert body["default"]["context_tokens"] == 131_072
    assert body["custom"] == []


def test_create_never_returns_the_key(client: TestClient, stub_endpoint: str) -> None:
    created = _create(client, stub_endpoint)
    assert created["key_hint"] == "7890"
    assert "sk-test" not in json.dumps(created)
    listed = client.get("/api/v1/models", params={"client_id": CLIENT}).json()
    assert [m["id"] for m in listed["custom"]] == [created["id"]]
    assert "sk-test" not in json.dumps(listed)


def test_custom_model_answers_and_usage_is_real(
    client: TestClient, stub_endpoint: str
) -> None:
    created = _create(client, stub_endpoint)

    default_ask = client.post(
        "/api/v1/ask", json={"question": QUESTION, "client_id": CLIENT}
    )
    assert default_ask.status_code == 200
    usage = client.get("/api/v1/usage", params={"client_id": CLIENT}).json()
    assert usage["used_tokens"] == 0  # the fixture path makes no LLM call

    custom_ask = client.post(
        "/api/v1/ask",
        json={
            "question": QUESTION,
            "client_id": CLIENT,
            "model_id": created["id"],
        },
    )
    assert custom_ask.status_code == 200, custom_ask.text
    assert custom_ask.json()["answer"] == "Answer from the visitor's own model [E1]."

    usage = client.get(
        "/api/v1/usage",
        params={"client_id": CLIENT, "model_id": created["id"]},
    ).json()
    assert usage["prompt_tokens"] == 111
    assert usage["completion_tokens"] == 22
    assert usage["used_tokens"] == 133
    assert usage["context_tokens"] == 64_000
    assert usage["percent"] == pytest.approx(0.21, abs=0.01)
    assert usage["requests"] == 1


def test_delete_then_ask_is_404(client: TestClient, stub_endpoint: str) -> None:
    created = _create(client, stub_endpoint)
    deleted = client.delete(
        f"/api/v1/models/custom/{created['id']}", params={"client_id": CLIENT}
    )
    assert deleted.status_code == 200
    ask = client.post(
        "/api/v1/ask",
        json={"question": QUESTION, "client_id": CLIENT, "model_id": created["id"]},
    )
    assert ask.status_code == 404


def test_unknown_model_is_404_not_a_silent_default(client: TestClient) -> None:
    ask = client.post(
        "/api/v1/ask",
        json={"question": QUESTION, "client_id": CLIENT, "model_id": "cm_nope"},
    )
    assert ask.status_code == 404


def test_plain_http_endpoint_off_localhost_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/models/custom",
        json={
            "client_id": CLIENT,
            "name": "Bad",
            "model": "m",
            "endpoint": "http://api.example.com/v1",
            "api_key": "sk-x",
        },
    )
    assert response.status_code == 422


def test_custom_model_requires_a_client_id(client: TestClient) -> None:
    ask = client.post(
        "/api/v1/ask", json={"question": QUESTION, "model_id": "cm_whatever"}
    )
    assert ask.status_code == 400
