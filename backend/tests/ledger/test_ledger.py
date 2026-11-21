"""Decision ledger: mining, verification, currency, authority, delivery."""

from __future__ import annotations

import io
import json
import sqlite3
import subprocess
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.features.webhooks import WebhookStore, handle_github_event
from app.ledger import LedgerError, LedgerStore, WhyEngine
from app.ledger.cli import main as cli
from app.ledger.git import Git
from app.ledger.indexer import index_repository
from app.ledger.mcp_server import LedgerMCP
from app.ledger.miners import mine_commits, parse_decision_block
from app.ledger.models import Action, AuthorityEvent, SignerKind, Status, Verification
from app.ledger.pr_check import check_change, render_markdown
from app.ledger.routes import build_ledger_router

REPO = "acme/shop"

ADR = """---
status: accepted
scope:
  - shop/payments/
---
# ADR-0003: Use idempotency keys for payment calls

## Context

Retried card charges double-billed customers during the 2024 outage.

## Decision

Every payment call carries an idempotency key derived from the order id.

## Considered Options

- Disable retries entirely
- Deduplicate in the ledger after the fact

## Consequences

- Payment adapters must accept a key.
"""

CLIENT = """class Client:
    # WHY: retries are off by default because retrying POSTs duplicated orders.
    # Callers opt in per request when the call is idempotent.
    retries = 0

    # TODO: not a decision
    timeout = 5
"""


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(root), "-c", "user.name=Dev", "-c", "user.email=dev@example.com", *args],
        check=True,
        capture_output=True,
        text=True,
    ).stdout


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    root = tmp_path / "shop"
    (root / "docs/adr").mkdir(parents=True)
    (root / "shop/payments").mkdir(parents=True)
    (root / "docs/adr/0003-idempotency.md").write_text(ADR)
    (root / "shop/client.py").write_text(CLIENT)
    (root / "shop/payments/charge.py").write_text("def charge(order):\n    return order\n")
    (root / "shop/cache.py").write_text("CACHE = {}\n")
    git(root, "init", "-q", "-b", "main")
    git(root, "add", ".")
    git(root, "commit", "-qm", "Initial layout")
    (root / "shop/cache.py").write_text("CACHE = None\n")
    git(root, "add", ".")
    git(
        root,
        "commit",
        "-qm",
        "Switch to Redis for the cart cache\n\nIn-process dicts were lost on every deploy, "
        "so carts vanished; Redis survives restarts.",
    )
    return root


@pytest.fixture
def store(repo: Path) -> LedgerStore:
    s = LedgerStore()
    index_repository(repo, s, repo=REPO)
    return s


def by_source(store: LedgerStore, source: str):
    return [d for d in store.list_decisions(REPO) if d.source.value == source]


# ------------------------------------------------------------------ mining


def test_adr_is_mined_in_force_with_scope_and_verified_evidence(store: LedgerStore) -> None:
    [adr] = by_source(store, "adr")
    assert adr.title == "Use idempotency keys for payment calls"
    assert adr.status is Status.ACCEPTED  # accepted + names its scope
    assert adr.scope == ["shop/payments/"]
    assert adr.alternatives == [
        "Disable retries entirely",
        "Deduplicate in the ledger after the fact",
    ]
    assert adr.evidence[0].verification is Verification.VERIFIED
    [event] = store.history(adr.decision_id)
    assert event.action is Action.ACCEPT and event.signer_kind is SignerKind.IMPORT


def test_inline_marker_spans_continuation_lines_and_ignores_todo(store: LedgerStore) -> None:
    [marker] = by_source(store, "inline_marker")
    assert marker.status is Status.PROPOSED  # background until confirmed
    assert marker.scope == ["shop/client.py"]
    assert "Callers opt in per request" in marker.decision
    ev = marker.evidence[0]
    assert (ev.start_line, ev.end_line) == (2, 3)
    assert ev.verification is Verification.VERIFIED


def test_commit_needs_a_choice_and_a_reason(store: LedgerStore, repo: Path) -> None:
    [commit] = by_source(store, "commit")
    assert commit.title == "Switch to Redis for the cart cache"
    assert commit.scope == ["shop/cache.py"]
    assert "carts vanished" in commit.rationale
    assert commit.evidence[0].verification is Verification.VERIFIED
    commits = Git(repo).commits()
    assert mine_commits([c for c in commits if c.subject == "Initial layout"], REPO, set()) == []


def test_reindex_is_idempotent_and_dismissed_is_a_tombstone(store: LedgerStore, repo: Path) -> None:
    before = {d.decision_id for d in store.list_decisions(REPO)}
    [marker] = by_source(store, "inline_marker")
    store.act(
        marker.decision_id,
        AuthorityEvent(
            decision_id=marker.decision_id,
            action=Action.DISMISS,
            reason="not a decision",
            signer="Dev",
            signer_kind=SignerKind.PERSON,
        ),
    )
    stats = index_repository(repo, store, repo=REPO)
    assert {d.decision_id for d in store.list_decisions(REPO)} == before
    assert stats.created == 0 and stats.tombstoned == 1
    assert store.get(marker.decision_id).status is Status.DISMISSED


def test_revert_supersedes_the_reverted_commit_decision(store: LedgerStore, repo: Path) -> None:
    [commit] = by_source(store, "commit")
    sha = commit.evidence[0].commit_sha
    git(repo, "revert", "--no-edit", sha)
    index_repository(repo, store, repo=REPO)
    assert store.get(commit.decision_id).status is Status.SUPERSEDED


# ---------------------------------------------------- verification/currency


def test_moved_quote_is_fuzzy_and_relocated(store: LedgerStore, repo: Path) -> None:
    (repo / "shop/client.py").write_text("# header\n\n" + CLIENT)
    git(repo, "commit", "-qam", "Add header")
    index_repository(repo, store, repo=REPO)
    [marker] = by_source(store, "inline_marker")
    # Re-mined at the new lines (verified) — the old row is fuzzy-relocated.
    levels = {e.verification for e in marker.evidence}
    assert Verification.VERIFIED in levels


def test_currency_needs_review_then_reaffirm_then_stale(store: LedgerStore, repo: Path) -> None:
    engine = WhyEngine(store)
    [adr] = by_source(store, "adr")
    assert engine.card(adr, *engine._git(REPO))["currency"] == "active"
    (repo / "shop/payments/charge.py").write_text("def charge(order, key):\n    return order\n")
    git(repo, "commit", "-qam", "Thread the key")
    assert engine.card(adr, *engine._git(REPO))["currency"] == "needs_review"
    head = git(repo, "rev-parse", "HEAD").strip()
    store.act(
        adr.decision_id,
        AuthorityEvent(
            decision_id=adr.decision_id,
            action=Action.REAFFIRM,
            reason="still holds",
            signer="Dev",
            signer_kind=SignerKind.PERSON,
            evidence_ref=head,
        ),
    )
    adr = store.get(adr.decision_id)
    assert engine.card(adr, *engine._git(REPO))["currency"] == "active"
    git(repo, "rm", "-rq", "shop/payments")
    git(repo, "commit", "-qm", "Remove payments")
    assert engine.card(adr, *engine._git(REPO))["currency"] == "stale"


# ------------------------------------------------------------- authority


def test_authority_log_is_append_only_in_the_database(store: LedgerStore) -> None:
    with pytest.raises(sqlite3.DatabaseError, match="append-only"):
        store._db.execute("UPDATE authority_log SET signer = 'mallory'")
    with pytest.raises(sqlite3.DatabaseError, match="append-only"):
        store._db.execute("DELETE FROM authority_log")


def test_accept_refuses_without_scope_or_reason(store: LedgerStore) -> None:
    from app.ledger.models import Decision, Source

    d = store.record(
        Decision(repo=REPO, title="Unscoped idea", decision="Do a thing", source=Source.MANUAL),
        AuthorityEvent(
            decision_id="",
            action=Action.RECORD,
            reason="r",
            signer="Dev",
            signer_kind=SignerKind.PERSON,
        ),
    )
    with pytest.raises(LedgerError, match="no scope"):
        store.act(
            d.decision_id,
            AuthorityEvent(
                decision_id=d.decision_id,
                action=Action.ACCEPT,
                reason="ok",
                signer="Dev",
                signer_kind=SignerKind.PERSON,
                evidence_ref="x",
            ),
        )
    with pytest.raises(LedgerError, match="no reason"):
        store.act(
            d.decision_id,
            AuthorityEvent(
                decision_id=d.decision_id,
                action=Action.ACCEPT,
                reason="",
                signer="Dev",
                signer_kind=SignerKind.PERSON,
                scope=["shop/"],
                evidence_ref="x",
            ),
        )


def test_pinned_decision_cannot_be_retired_by_an_agent(store: LedgerStore) -> None:
    [adr] = by_source(store, "adr")
    pin = AuthorityEvent(
        decision_id=adr.decision_id,
        action=Action.PIN,
        reason="law",
        signer="Dev",
        signer_kind=SignerKind.PERSON,
    )
    store.act(adr.decision_id, pin)
    dismiss = AuthorityEvent(
        decision_id=adr.decision_id,
        action=Action.DISMISS,
        reason="nah",
        signer="claude_code",
        signer_kind=SignerKind.AGENT,
    )
    with pytest.raises(LedgerError, match="pinned"):
        store.act(adr.decision_id, dismiss)
    with pytest.raises(LedgerError, match="only a person"):
        store.act(adr.decision_id, dismiss, force=True)
    store.act(
        adr.decision_id, dismiss.model_copy(update={"signer_kind": SignerKind.PERSON}), force=True
    )
    actions = [e.action for e in store.history(adr.decision_id)]
    assert actions == [Action.ACCEPT, Action.PIN, Action.DISMISS]


# ------------------------------------------------------------------ get_why


def test_get_why_modes(store: LedgerStore) -> None:
    engine = WhyEngine(store)
    path = engine.get_why(REPO, targets=["shop/payments/charge.py"])
    assert path["targets"][0]["in_force"][0]["title"].startswith("Use idempotency keys")
    background = engine.get_why(REPO, targets=["shop/client.py"])["targets"][0]
    assert background["in_force"] == [] and len(background["background"]) == 1
    assert background["background"][0]["label"].startswith("background")
    ungoverned = engine.get_why(REPO, targets=["shop/__init__.py"])["targets"][0]
    assert ungoverned["archaeology"]["available"] is True
    search = engine.get_why(REPO, query="why redis cart cache")
    assert search["decisions"][0]["title"] == "Switch to Redis for the cart cache"
    health = engine.get_why(REPO)
    assert health["mode"] == "health" and health["in_force"] == 1
    assert engine.get_why("other/repo")["mode"] == "not_indexed"


# --------------------------------------------------------------- PR block


def test_decision_block_parsing_and_validation() -> None:
    body = """Intro
<!-- whycode:decisions -->
- Retries live in the HTTP client, not in callers. Why: callers set different
  timeouts and three of them forgot to retry. Files: shop/client.py, shop/jobs/
- Bad one. Why: short. Files: /etc/passwd
<!-- /whycode:decisions -->"""
    result = parse_decision_block(body)
    assert len(result.entries) == 1
    entry = result.entries[0]
    assert entry.title == "Retries live in the HTTP client, not in callers"
    assert entry.files == ["shop/client.py", "shop/jobs/"]
    assert "forgot to retry" in entry.reason
    assert (
        len(result.errors) == 1 and "15-1000" in result.errors[0] and "absolute" in result.errors[0]
    )
    assert parse_decision_block("no block").entries == []


def test_pr_check_requires_ack_for_pinned_decisions(store: LedgerStore) -> None:
    [adr] = by_source(store, "adr")
    store.act(
        adr.decision_id,
        AuthorityEvent(
            decision_id=adr.decision_id,
            action=Action.PIN,
            reason="law",
            signer="Dev",
            signer_kind=SignerKind.PERSON,
        ),
    )
    engine = WhyEngine(store)
    result = check_change(engine, REPO, ["shop/payments/charge.py", "README.md"])
    assert not result.passed
    assert result.violations[0]["rule"] == "pinned_decision_requires_ack"
    assert "Why-Code decision check" in render_markdown(result)
    acked = check_change(
        engine,
        REPO,
        ["shop/payments/charge.py"],
        f"Decision-Ack: {adr.decision_id} because we add a key param",
    )
    assert acked.passed and len(acked.governing) == 1
    assert check_change(engine, REPO, ["docs/x.md"]).governing == []


# -------------------------------------------------------------- delivery


def test_mcp_protocol_roundtrip(store: LedgerStore) -> None:
    server = LedgerMCP(store, REPO)
    lines = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "get_why", "arguments": {"targets": ["shop/payments/charge.py"]}},
        },
        {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "record_decision",
                "arguments": {
                    "decision": "Use structured logging everywhere",
                    "rationale": "grep-able incidents",
                    "affects": ["shop/"],
                    "agent": "claude_code",
                },
            },
        },
        {"jsonrpc": "2.0", "id": 5, "method": "nope"},
    ]
    out = io.StringIO()
    server.serve(io.StringIO("\n".join(json.dumps(m) for m in lines) + "\n"), out)
    replies = [json.loads(line) for line in out.getvalue().splitlines()]
    assert [r["id"] for r in replies] == [1, 2, 3, 4, 5]  # the notification got no reply
    assert replies[0]["result"]["serverInfo"]["name"] == "whycode-ledger"
    assert {t["name"] for t in replies[1]["result"]["tools"]} >= {"get_why", "check_change"}
    why = replies[2]["result"]["structuredContent"]
    assert why["targets"][0]["in_force"][0]["scope"] == ["shop/payments/"]
    assert (
        replies[3]["result"]["structuredContent"]["status"] == "proposed"
    )  # agents can't self-grant
    assert replies[4]["error"]["code"] == -32601


def test_api_reads_public_writes_need_the_token(store: LedgerStore) -> None:
    app = FastAPI()
    app.include_router(build_ledger_router(store, admin_token="s3cret"))
    client = TestClient(app)
    assert client.get("/api/v1/ledger/repos").json()["repos"][0]["repo"] == REPO
    listed = client.get("/api/v1/ledger/decisions", params={"repo": REPO}).json()["decisions"]
    assert len(listed) == 3
    [adr] = by_source(store, "adr")
    detail = client.get(f"/api/v1/ledger/decisions/{adr.decision_id}").json()
    assert detail["authority_log"][0]["action"] == "accept"
    body = {"reason": "law", "signer": "Dev"}
    assert (
        client.post(f"/api/v1/ledger/decisions/{adr.decision_id}/pin", json=body).status_code == 401
    )
    ok = client.post(
        f"/api/v1/ledger/decisions/{adr.decision_id}/pin",
        json=body,
        headers={"Authorization": "Bearer s3cret"},
    )
    assert ok.status_code == 200 and ok.json()["pinned"] is True
    closed = FastAPI()
    closed.include_router(build_ledger_router(store, admin_token=""))
    assert (
        TestClient(closed)
        .post(f"/api/v1/ledger/decisions/{adr.decision_id}/pin", json=body)
        .status_code
        == 503
    )


def test_merged_pr_block_comes_into_force_via_webhook(tmp_path: Path) -> None:
    ledger = LedgerStore()
    hooks = WebhookStore(tmp_path / "hooks.db")
    pr = {
        "number": 7,
        "title": "Client retries",
        "body": "<!-- whycode:decisions -->\n- Retries live in the client. Why: three callers "
        "forgot to retry and the fix belongs in one place. Files: shop/client.py\n"
        "<!-- /whycode:decisions -->",
        "user": {"login": "alice"},
        "merged": False,
    }
    opened = handle_github_event(
        hooks,
        delivery_id="d1",
        event="pull_request",
        payload={"action": "opened", "repository": {"full_name": REPO}, "pull_request": pr},
        ledger=ledger,
    )
    [decision_id] = opened["ledger"]["decision_ids"]
    assert ledger.get(decision_id).status is Status.PROPOSED
    merged_pr = {
        **pr,
        "merged": True,
        "merge_commit_sha": "abc1234def",
        "merged_by": {"login": "bob"},
    }
    handle_github_event(
        hooks,
        delivery_id="d2",
        event="pull_request",
        payload={"action": "closed", "repository": {"full_name": REPO}, "pull_request": merged_pr},
        ledger=ledger,
    )
    decision = ledger.get(decision_id)
    assert decision.status is Status.ACCEPTED
    assert ledger.history(decision_id)[-1].signer == "PR #7 merge by bob"
    # A redelivery is ignored.
    again = handle_github_event(
        hooks,
        delivery_id="d2",
        event="pull_request",
        payload={"action": "closed", "repository": {"full_name": REPO}, "pull_request": merged_pr},
        ledger=ledger,
    )
    assert again["recorded"] is False


def test_cli_roundtrip(repo: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    db = str(tmp_path / "ledger.db")
    assert cli(["index", str(repo), "--db", db, "--repo", REPO]) == 0
    capsys.readouterr()
    assert cli(["why", "shop/client.py", "--db", db, "--repo", REPO]) == 0
    assert "retries are off by default" in capsys.readouterr().out
    assert (
        cli(
            [
                "add",
                "--db",
                db,
                "--repo",
                REPO,
                "--decision",
                "Keep money in integer cents.",
                "--rationale",
                "floats rounded refunds",
                "--affects",
                "shop/payments/",
                "--accept",
                "--as",
                "Dev",
            ]
        )
        == 0
    )
    added = capsys.readouterr().out.split()[0]
    assert cli(["pin", added, "--db", db, "--repo", REPO, "--as", "Dev"]) == 0
    assert cli(["check", "--db", db, "--repo", REPO, "--files", "shop/payments/charge.py"]) == 1
    assert cli(["export", "--db", db, "--repo", REPO, "--path", str(repo)]) == 0
    assert "integer cents" in (repo / ".whycode/decisions.yaml").read_text()
    # CI path: a fresh ledger rebuilt from the checkout plus the committed
    # manifest still knows the pinned decision and blocks the change.
    fresh = str(tmp_path / "ci.db")
    assert cli(["index", str(repo), "--db", fresh, "--repo", REPO]) == 0
    assert cli(["import", "--db", fresh, "--repo", REPO, "--path", str(repo)]) == 0
    capsys.readouterr()
    assert (
        cli(
            [
                "check",
                "--db",
                fresh,
                "--repo",
                REPO,
                "--files",
                "shop/payments/charge.py",
                "--markdown",
            ]
        )
        == 1
    )
    assert "Blocked" in capsys.readouterr().out


def test_authority_action_refreshes_cached_currency(store: LedgerStore) -> None:
    [marker] = by_source(store, "inline_marker")
    assert store.cached_currency(marker.decision_id)[0] == "background"
    store.act(
        marker.decision_id,
        AuthorityEvent(
            decision_id=marker.decision_id,
            action=Action.ACCEPT,
            reason="confirmed",
            signer="Dev",
            signer_kind=SignerKind.PERSON,
            evidence_ref=marker.evidence[0].evidence_id,
        ),
    )
    # With no checkout available, the card must follow the new status,
    # not the stale cache from index time.
    card = WhyEngine(store).card(store.get(marker.decision_id))
    assert card["currency"] == "active" and card["in_force"] is True
