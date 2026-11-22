"""``python -m app.ledger`` — index, query and govern the decision ledger.

index PATH                 mine ADRs, WHY:-style markers, commits (and PRs with
                           --pull-requests); verify; assess
why [PATH ...] [-q TEXT]   decisions over paths, a search, or governance health
list / show ID             browse the ledger (show includes the authority log)
add                        record a decision (flags; in force only with --accept)
accept|reaffirm|pin|unpin|dismiss|supersede ID   authority actions, all logged
check [--base REF]         decision check for a change set (exit 1 on violation)
export / import            the committed manifest (.whycode/decisions.yaml)
mcp                        stdio MCP server for coding agents
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml

from app.ledger.git import Git
from app.ledger.indexer import index_repository
from app.ledger.models import (
    Action,
    AuthorityEvent,
    Decision,
    Evidence,
    SignerKind,
    Source,
    Status,
    first_sentence,
)
from app.ledger.pr_check import check_change, render_markdown
from app.ledger.store import LedgerError, LedgerStore
from app.ledger.why import WhyEngine

DEFAULT_DB = os.environ.get("WHYCODE_LEDGER_DB", "artifacts/ledger.db")
MANIFEST = ".whycode/decisions.yaml"


def _person() -> str:
    try:
        name = subprocess.run(
            ["git", "config", "user.name"], capture_output=True, text=True, timeout=5, check=False
        ).stdout.strip()
    except OSError:
        name = ""
    return name or os.environ.get("USER", "unknown")


def _repo(args: argparse.Namespace, store: LedgerStore) -> str:
    if getattr(args, "repo", None):
        return str(args.repo)
    slug = Git(Path(args.path if hasattr(args, "path") and args.path else ".")).remote_slug()
    known = [str(r["repo"]) for r in store.repos()]
    if slug and slug in known:
        return slug
    if len(known) == 1:
        return known[0]
    raise SystemExit("--repo is required (indexed: " + (", ".join(known) or "none") + ")")


def _print(data: Any, as_json: bool) -> None:
    if as_json:
        print(json.dumps(data, indent=2, default=str))
        return
    if isinstance(data, dict) and data.get("mode") == "path":
        for entry in data["targets"]:
            print(f"\n{entry['target']}")
            for card in entry["in_force"]:
                _print_card(card)
            for card in entry["background"]:
                _print_card(card)
            arch = entry.get("archaeology")
            if arch and arch.get("available"):
                print("  no recorded decision; recent history:")
                for c in arch["commits"]:
                    print(f"    {c['sha'][:10]} {c['date'][:10]} {c['subject']}")
        return
    if isinstance(data, dict) and data.get("mode") == "search":
        for card in data["decisions"]:
            _print_card(card)
        if not data["decisions"]:
            print("no matching decision")
        return
    print(json.dumps(data, indent=2, default=str))


def _print_card(card: dict[str, Any]) -> None:
    pin = " [pinned]" if card["pinned"] else ""
    ver = card["verification"]
    print(f"  {card['decision_id']}  {card['title']}{pin}")
    print(
        f"    {card['label']} · {card['source']} · "
        f"evidence {ver['verified']}/{ver['total']} verified"
    )
    if card["rationale"]:
        print(f"    why: {card['rationale'][:240]}")
    for item in card["evidence"][:2]:
        where = item.get("path") or (item.get("commit_sha") or "")[:12]
        line = f":{item['start_line']}" if item.get("start_line") else ""
        print(f"    > {item['quote'][:160]}  ({where}{line}, {item['verification']})")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="whycode-ledger",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--repo")
    parser.add_argument("--json", action="store_true")
    # The same flags are accepted after the subcommand too.
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--db", default=argparse.SUPPRESS)
    common.add_argument("--repo", default=argparse.SUPPRESS)
    common.add_argument("--json", action="store_true", default=argparse.SUPPRESS)
    sub = parser.add_subparsers(dest="cmd", required=True)
    _add = sub.add_parser

    def add_parser(name: str, **kw: Any) -> argparse.ArgumentParser:
        return _add(name, parents=[common], **kw)

    sub.add_parser = add_parser  # type: ignore[method-assign]

    p = sub.add_parser("index")
    p.add_argument("path")
    p.add_argument("--commits", type=int, default=1000)
    p.add_argument(
        "--pull-requests",
        action="store_true",
        help="also mine reasons from merged PR descriptions and reviews "
        "(needs WHYCODE_GITHUB_TOKEN, GITHUB_TOKEN or GH_TOKEN)",
    )
    p.add_argument("--pr-limit", type=int, default=500)

    p = sub.add_parser("why")
    p.add_argument("targets", nargs="*")
    p.add_argument("-q", "--query")
    p.add_argument("--history", action="store_true")

    sub.add_parser("list").add_argument("--status", choices=[s.value for s in Status])
    sub.add_parser("show").add_argument("id")

    p = sub.add_parser("add")
    p.add_argument("--title")
    p.add_argument("--decision", required=True)
    p.add_argument("--rationale", default="")
    p.add_argument("--context", default="")
    p.add_argument("--alternative", action="append", default=[])
    p.add_argument("--consequence", action="append", default=[])
    p.add_argument("--affects", action="append", default=[])
    p.add_argument("--tag", action="append", default=[])
    p.add_argument("--evidence-commit", action="append", default=[])
    p.add_argument("--agent", help="sign as this coding agent (stored as proposed)")
    p.add_argument("--accept", action="store_true", help="put in force now, signed by you")
    p.add_argument("--as", dest="signer")

    for name in ("accept", "reaffirm", "pin", "unpin", "dismiss", "supersede"):
        p = sub.add_parser(name)
        p.add_argument("id")
        p.add_argument("--reason", default="")
        p.add_argument("--scope", action="append", default=[])
        p.add_argument("--evidence", help="evidence reference (commit sha, PR #, file:line)")
        p.add_argument("--as", dest="signer")
        p.add_argument("--force", action="store_true")
        if name == "supersede":
            p.add_argument("--by", required=True)

    p = sub.add_parser("check")
    p.add_argument("--path", default=".")
    p.add_argument("--base", default="origin/HEAD")
    p.add_argument("--head", default="HEAD")
    p.add_argument("--files", nargs="*")
    p.add_argument("--body-file")
    p.add_argument("--markdown", action="store_true")

    p = sub.add_parser("export")
    p.add_argument("--path", default=".")
    p = sub.add_parser("import")
    p.add_argument("--path", default=".")

    sub.add_parser("mcp")

    args = parser.parse_args(argv)
    store = LedgerStore(args.db)
    engine = WhyEngine(store)
    try:
        return _dispatch(args, store, engine)
    except LedgerError as exc:
        print(f"refused: {exc}", file=sys.stderr)
        return 2


def _dispatch(args: argparse.Namespace, store: LedgerStore, engine: WhyEngine) -> int:
    cmd = args.cmd
    if cmd == "index":
        sources = None
        token = None
        if args.pull_requests:
            sources = {Source.ADR, Source.INLINE_MARKER, Source.COMMIT, Source.PULL_REQUEST}
            token = next(
                (
                    os.environ[k].strip()
                    for k in ("WHYCODE_GITHUB_TOKEN", "GITHUB_TOKEN", "GH_TOKEN")
                    if os.environ.get(k, "").strip()
                ),
                None,
            )
        stats = index_repository(
            args.path,
            store,
            repo=args.repo,
            commit_limit=args.commits,
            sources=sources,
            github_token=token,
            pr_limit=args.pr_limit,
            pr_cache=f"{args.db}.prs.json" if args.pull_requests else None,
        )
        _print(stats.as_dict(), True)
        return 0
    if cmd == "mcp":
        from app.ledger.mcp_server import LedgerMCP

        LedgerMCP(store, args.repo).serve()
        return 0
    repo = _repo(args, store)
    if cmd == "why":
        _print(
            engine.get_why(
                repo, query=args.query, targets=args.targets, include_history=args.history
            ),
            args.json,
        )
        return 0
    if cmd == "list":
        statuses = [Status(args.status)] if args.status else None
        rows = [engine.card(d) for d in store.list_decisions(repo, statuses=statuses)]
        if args.json:
            _print(rows, True)
        else:
            for card in rows:
                print(
                    f"{card['decision_id']}  {card['currency']:<13} "
                    f"{card['source']:<13} {card['title']}"
                )
        return 0
    if cmd == "show":
        decision = store.get(args.id)
        if decision is None:
            print(f"no decision {args.id}", file=sys.stderr)
            return 1
        card = engine.card(decision, *engine._git(repo))
        card["authority_log"] = [e.model_dump() for e in store.history(decision.decision_id)]
        _print(card, True)
        return 0
    if cmd == "add":
        evidence = [
            Evidence(kind="commit", quote=args.decision, commit_sha=sha)
            for sha in args.evidence_commit
        ]
        accepted = bool(args.accept) and not args.agent
        decision = Decision(
            repo=repo,
            title=args.title or first_sentence(args.decision),
            decision=args.decision,
            rationale=args.rationale,
            context=args.context,
            alternatives=args.alternative,
            consequences=args.consequence,
            scope=args.affects,
            tags=args.tag,
            source=Source.AGENT if args.agent else Source.MANUAL,
            status=Status.ACCEPTED if accepted else Status.PROPOSED,
            confidence=0.9 if accepted else 0.7,
            evidence=evidence,
        )
        stored = store.record(
            decision,
            AuthorityEvent(
                decision_id="",
                action=Action.ACCEPT if accepted else Action.RECORD,
                reason="recorded by hand" if not args.agent else "recorded by a coding agent",
                signer=args.agent or args.signer or _person(),
                signer_kind=SignerKind.AGENT if args.agent else SignerKind.PERSON,
                scope=args.affects,
            ),
        )
        print(f"{stored.decision_id} {stored.status.value}: {stored.title}")
        return 0
    if cmd in {"accept", "reaffirm", "pin", "unpin", "dismiss", "supersede"}:
        decision = store.get(args.id)
        if decision is None:
            print(f"no decision {args.id}", file=sys.stderr)
            return 1
        evidence_ref = args.evidence or (
            decision.evidence[0].evidence_id if decision.evidence else None
        )
        updated = store.act(
            decision.decision_id,
            AuthorityEvent(
                decision_id=decision.decision_id,
                action=Action(cmd),
                reason=args.reason or ("" if cmd == "accept" else f"{cmd} by hand"),
                signer=args.signer or _person(),
                signer_kind=SignerKind.PERSON,
                scope=args.scope,
                evidence_ref=evidence_ref,
            ),
            superseded_by=getattr(args, "by", None),
            force=args.force,
        )
        print(f"{updated.decision_id} {updated.status.value}{' pinned' if updated.pinned else ''}")
        return 0
    if cmd == "check":
        files = args.files
        if files is None:
            files = Git(args.path).changed_files(args.base, args.head)
        body = Path(args.body_file).read_text(encoding="utf-8") if args.body_file else None
        result = check_change(engine, repo, files, body)
        if args.markdown:
            print(render_markdown(result))
        else:
            _print(result.as_dict(), True)
        return 0 if result.passed else 1
    if cmd == "export":
        rows = []
        for d in store.list_decisions(repo, statuses=[Status.ACCEPTED]):
            rows.append(
                {
                    "id": d.decision_id,
                    "title": d.title,
                    "decision": d.decision,
                    "rationale": d.rationale,
                    "alternatives": d.alternatives,
                    "scope": d.scope,
                    "pinned": d.pinned,
                    "source": d.source.value,
                }
            )
        target = Path(args.path) / MANIFEST
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            "# Decisions in force. Generated by `python -m app.ledger export`;"
            " edit and re-import.\n"
            + yaml.safe_dump(
                {"repo": repo, "decisions": rows}, sort_keys=False, allow_unicode=True
            ),
            encoding="utf-8",
        )
        print(f"wrote {len(rows)} decisions to {target}")
        return 0
    if cmd == "import":
        data = yaml.safe_load((Path(args.path) / MANIFEST).read_text(encoding="utf-8")) or {}
        count = 0
        for row in data.get("decisions", []):
            decision = Decision(
                repo=repo,
                title=row["title"],
                decision=row.get("decision") or row["title"],
                rationale=row.get("rationale", ""),
                alternatives=row.get("alternatives", []),
                scope=row.get("scope", []),
                source=Source.MANUAL,
                status=Status.ACCEPTED,
                pinned=bool(row.get("pinned")),
                confidence=0.9,
                evidence=[Evidence(kind="file_span", quote=row["title"], path=MANIFEST)],
            )
            store.record(
                decision,
                AuthorityEvent(
                    decision_id="",
                    action=Action.ACCEPT,
                    reason="imported from the committed manifest",
                    signer=MANIFEST,
                    signer_kind=SignerKind.IMPORT,
                    scope=decision.scope,
                    evidence_ref=MANIFEST,
                ),
            )
            current = store.get(decision.decision_id)
            if row.get("pinned") and current is not None and not current.pinned:
                store.act(
                    decision.decision_id,
                    AuthorityEvent(
                        decision_id=decision.decision_id,
                        action=Action.PIN,
                        reason="pinned in the committed manifest",
                        signer=MANIFEST,
                        signer_kind=SignerKind.IMPORT,
                    ),
                )
            count += 1
        print(f"imported {count} decisions")
        return 0
    raise SystemExit(f"unknown command {cmd}")


if __name__ == "__main__":
    raise SystemExit(main())
