"""A dependency-free MCP server (stdio, JSON-RPC 2.0) over the decision ledger.

Coding agents (Claude Code, Cursor, Codex, ...) call these tools before they
edit code, so the reasons behind the code reach the agent at the moment they
matter::

    claude mcp add whycode -- python -m app.ledger mcp --db artifacts/ledger.db --repo owner/name

Tools: ``get_why``, ``search_decisions``, ``check_change``, ``record_decision``.
``record_decision`` stores an agent's decision as *proposed*; it comes into
force only when a person accepts it or its commit lands (``accept`` with the
commit as evidence) — an agent cannot grant itself authority.
"""

from __future__ import annotations

import json
import sys
from collections.abc import Callable
from typing import Any, TextIO

from app.ledger.models import Action, AuthorityEvent, Decision, Evidence, SignerKind, Source, Status
from app.ledger.pr_check import check_change
from app.ledger.store import LedgerError, LedgerStore
from app.ledger.why import WhyEngine

PROTOCOL_VERSION = "2025-06-18"
SERVER_INFO = {"name": "whycode-ledger", "version": "0.1.0"}

_REPO = {"type": "string", "description": "owner/name; defaults to the server's --repo"}
TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_why",
        "description": (
            "Why is the code like this? With no arguments: governance health (stale decisions, "
            "ungoverned hotspots). With targets (file or folder paths): the decisions in force "
            "over them, with verbatim evidence and whether each still holds; falls back to the "
            "file's git history when no decision exists. With query: ranked decision search. "
            "Call before editing a file you did not write."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "repo": _REPO,
                "query": {"type": "string"},
                "targets": {"type": "array", "items": {"type": "string"}},
                "include_history": {"type": "boolean"},
            },
        },
    },
    {
        "name": "search_decisions",
        "description": "Ranked search over recorded decisions (title, decision, rationale, scope).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repo": _REPO,
                "query": {"type": "string"},
                "limit": {"type": "integer"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "check_change",
        "description": (
            "Before committing: which decisions in force govern these changed files, which are "
            "pinned (need 'Decision-Ack: <id>' in the PR), and which already need review."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "repo": _REPO,
                "changed_files": {"type": "array", "items": {"type": "string"}},
                "pr_body": {"type": "string"},
            },
            "required": ["changed_files"],
        },
    },
    {
        "name": "record_decision",
        "description": (
            "Record a decision you just made, with its rationale and the files it governs. "
            "Stored as proposed; it comes into force when its commit lands or a person accepts it."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "repo": _REPO,
                "title": {"type": "string"},
                "decision": {"type": "string"},
                "rationale": {"type": "string"},
                "alternatives": {"type": "array", "items": {"type": "string"}},
                "affects": {"type": "array", "items": {"type": "string"}},
                "evidence_commit": {"type": "string"},
                "agent": {"type": "string", "description": "your agent slug, e.g. claude_code"},
            },
            "required": ["decision", "rationale", "affects", "agent"],
        },
    },
]


class LedgerMCP:
    def __init__(self, store: LedgerStore, default_repo: str | None = None) -> None:
        self.store = store
        self.engine = WhyEngine(store)
        self.default_repo = default_repo
        self._tools: dict[str, Callable[[dict[str, Any]], Any]] = {
            "get_why": self._get_why,
            "search_decisions": self._search,
            "check_change": self._check,
            "record_decision": self._record,
        }

    def _repo(self, args: dict[str, Any]) -> str:
        repo = args.get("repo") or self.default_repo
        if not repo:
            known = [str(r["repo"]) for r in self.store.repos()]
            if len(known) == 1:
                return known[0]
            raise LedgerError("repo is required (indexed: " + ", ".join(known) + ")")
        return str(repo)

    def _get_why(self, args: dict[str, Any]) -> Any:
        return self.engine.get_why(
            self._repo(args),
            query=args.get("query"),
            targets=args.get("targets"),
            include_history=bool(args.get("include_history")),
        )

    def _search(self, args: dict[str, Any]) -> Any:
        return self.engine.search(
            self._repo(args), str(args["query"]), limit=int(args.get("limit") or 8)
        )

    def _check(self, args: dict[str, Any]) -> Any:
        return check_change(
            self.engine, self._repo(args), list(args["changed_files"]), args.get("pr_body")
        ).as_dict()

    def _record(self, args: dict[str, Any]) -> Any:
        from app.ledger.models import first_sentence

        repo = self._repo(args)
        evidence = []
        if args.get("evidence_commit"):
            evidence.append(
                Evidence(
                    kind="commit",
                    quote=str(args["decision"]),
                    commit_sha=str(args["evidence_commit"]),
                )
            )
        decision = Decision(
            repo=repo,
            title=str(args.get("title") or first_sentence(str(args["decision"]))),
            decision=str(args["decision"]),
            rationale=str(args["rationale"]),
            alternatives=list(args.get("alternatives") or []),
            scope=list(args["affects"]),
            source=Source.AGENT,
            status=Status.PROPOSED,
            confidence=0.7,
            evidence=evidence,
        )
        stored = self.store.record(
            decision,
            AuthorityEvent(
                decision_id="",
                action=Action.RECORD,
                reason="recorded by a coding agent",
                signer=str(args["agent"]),
                signer_kind=SignerKind.AGENT,
                scope=decision.scope,
            ),
        )
        return {"decision_id": stored.decision_id, "status": stored.status.value}

    # ------------------------------------------------------------ protocol

    def handle(self, message: dict[str, Any]) -> dict[str, Any] | None:
        method = message.get("method")
        msg_id = message.get("id")
        if msg_id is None:  # a notification: never answered
            return None
        try:
            if method == "initialize":
                result: Any = {
                    "protocolVersion": PROTOCOL_VERSION,
                    "capabilities": {"tools": {"listChanged": False}},
                    "serverInfo": SERVER_INFO,
                    "instructions": (
                        "Call get_why with the paths you are about to edit to learn the decisions "
                        "that govern them. Respect pinned decisions."
                    ),
                }
            elif method == "ping":
                result = {}
            elif method == "tools/list":
                result = {"tools": TOOLS}
            elif method == "tools/call":
                params = message.get("params") or {}
                name = params.get("name")
                handler = self._tools.get(str(name))
                if handler is None:
                    return _error(msg_id, -32602, f"unknown tool {name}")
                try:
                    payload = handler(params.get("arguments") or {})
                    result = {
                        "content": [
                            {"type": "text", "text": json.dumps(payload, indent=1, default=str)}
                        ],
                        "structuredContent": payload
                        if isinstance(payload, dict)
                        else {"result": payload},
                        "isError": False,
                    }
                except (LedgerError, KeyError, ValueError) as exc:
                    result = {
                        "content": [{"type": "text", "text": f"error: {exc}"}],
                        "isError": True,
                    }
            else:
                return _error(msg_id, -32601, f"method not found: {method}")
        except Exception as exc:  # noqa: BLE001 - a tool bug must not kill the server
            return _error(msg_id, -32603, str(exc))
        return {"jsonrpc": "2.0", "id": msg_id, "result": result}

    def serve(self, stdin: TextIO = sys.stdin, stdout: TextIO = sys.stdout) -> None:
        for line in stdin:
            line = line.strip()
            if not line:
                continue
            try:
                message = json.loads(line)
            except json.JSONDecodeError:
                reply: dict[str, Any] | None = _error(None, -32700, "parse error")
            else:
                reply = self.handle(message)
            if reply is not None:
                stdout.write(json.dumps(reply) + "\n")
                stdout.flush()


def _error(msg_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


__all__ = ["TOOLS", "LedgerMCP"]
