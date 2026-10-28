"""Feature endpoints over the demo app: records, search, supersessions,
audit, ADR export, and the signed webhook receiver."""

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


def test_records_list_flattens_demo_decisions(client: TestClient) -> None:
    response = client.get("/api/v1/records", params={"repo": REPO})
    assert response.status_code == 200
    page = response.json()
    assert page["total"] >= 3
    ids = {r["decision_id"] for r in page["records"]}
    assert "dec_httpx_retry_default_off" in ids
    record = next(
        r for r in page["records"] if r["decision_id"] == "dec_httpx_retry_default_on"
    )
    assert record["superseded_by"] == "dec_httpx_retry_default_off"
    assert record["status"] == "reversed"
    assert record["evidence_ids"], "record must carry its evidence ids"
    assert record["evidence"], "demo records embed evidence refs"
    successor = next(
        r for r in page["records"] if r["decision_id"] == "dec_httpx_retry_default_off"
    )
    assert "dec_httpx_retry_default_on" in successor["supersedes"]


def test_records_filters_and_pagination(client: TestClient) -> None:
    reversed_page = client.get(
        "/api/v1/records", params={"repo": REPO, "status": "reversed"}
    ).json()
    assert reversed_page["total"] >= 1
    assert all(r["status"] == "reversed" for r in reversed_page["records"])

    first = client.get(
        "/api/v1/records", params={"repo": REPO, "limit": 1, "offset": 0}
    ).json()
    second = client.get(
        "/api/v1/records", params={"repo": REPO, "limit": 1, "offset": 1}
    ).json()
    assert first["records"][0]["decision_id"] != second["records"][0]["decision_id"]

    by_target = client.get(
        "/api/v1/records", params={"repo": REPO, "target": "retry"}
    ).json()
    assert by_target["total"] >= 1
    assert all(
        any("retry" in t.lower() for t in r["target_ids"])
        for r in by_target["records"]
    )


def test_record_detail_and_404(client: TestClient) -> None:
    ok = client.get(
        "/api/v1/records/dec_httpx_retry_default_off", params={"repo": REPO}
    )
    assert ok.status_code == 200
    assert ok.json()["claim"]
    missing = client.get("/api/v1/records/nope", params={"repo": REPO})
    assert missing.status_code == 404


def test_search_matches_claim_text(client: TestClient) -> None:
    payload = client.get(
        "/api/v1/search", params={"q": "retries", "repo": REPO}
    ).json()
    assert payload["total"] >= 1
    assert all(r["repo"] == REPO for r in payload["results"])


def test_search_cross_repo_includes_demo_repo(client: TestClient) -> None:
    payload = client.get("/api/v1/search", params={"q": "timeout"}).json()
    assert REPO in payload["repos"]
    assert payload["total"] >= 1


def test_supersessions_pairs_are_real(client: TestClient) -> None:
    pairs = client.get("/api/v1/supersessions", params={"repo": REPO}).json()
    assert pairs, "demo data contains genuine supersession links"
    pair = next(
        p
        for p in pairs
        if p["earlier"]["decision_id"] == "dec_httpx_retry_default_on"
    )
    assert pair["later"]["decision_id"] == "dec_httpx_retry_default_off"
    assert pair["relation"] == "REVERSED_BY"


def test_audit_report_counts_match_records(client: TestClient) -> None:
    records = client.get("/api/v1/records", params={"repo": REPO}).json()
    audit = client.get("/api/v1/audit", params={"repo": REPO}).json()
    assert audit["total"] == records["total"]
    assert audit["by_status"], "audit groups by status"
    assert 0.0 <= audit["with_evidence_pct"] <= 100.0
    assert audit["superseded"] >= 1


def test_export_adr_markdown(client: TestClient) -> None:
    response = client.get(
        "/api/v1/records/dec_httpx_retry_default_off/export",
        params={"repo": REPO},
    )
    assert response.status_code == 200
    assert "text/markdown" in response.headers["content-type"]
    assert "attachment" in response.headers["content-disposition"]
    body = response.text
    assert "# dec_httpx_retry_default_off" in body
    assert "## Decision" in body
    assert "## Evidence" in body

    as_json = client.get(
        "/api/v1/records/dec_httpx_retry_default_off/export",
        params={"repo": REPO, "format": "json"},
    )
    assert as_json.json()["decision_id"] == "dec_httpx_retry_default_off"


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


def test_webhook_merged_pr_records_event_job_and_dedupes(
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
    assert first.json()["job_id"] is not None

    again = webhook_client.post("/api/v1/webhooks/github", content=body, headers=headers)
    assert again.json()["recorded"] is False

    events = webhook_client.get("/api/v1/webhooks/events").json()
    assert len(events["events"]) == 1
    assert events["events"][0]["pr_number"] == 1525
    assert events["jobs"][0]["kind"] == "incremental_refresh"


def test_webhook_unconfigured_is_503(client: TestClient) -> None:
    response = client.post("/api/v1/webhooks/github", content=b"{}")
    assert response.status_code == 503
