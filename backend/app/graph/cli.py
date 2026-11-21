"""Load normalized GitHub evidence into Neo4j.

The ingestion exporter writes a repo-scoped ``normalized.jsonl``. This CLI is
the missing base-graph step between that export and the structural/intent
writers: it creates the PR, review, commit, issue, person and evidence nodes
that later components attach to. It is intentionally separate from the
read-only retrieval service and does not require a GitHub token.

    PYTHONPATH=. python -m app.graph.cli load \\
        --repo encode/httpx \\
        --normalized ../artifacts/live/httpx/normalized.jsonl
"""

from __future__ import annotations

import argparse
import json
import os
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from app.graph.builder import GraphBuilder
from app.graph.neo4j_driver import Neo4jClient


def main(argv: Sequence[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    if args.command != "load":
        parser.print_help()
        return 2

    high_signal = (
        _read_pr_numbers(Path(args.high_signal)) if args.high_signal else None
    )
    client = _client(args)
    try:
        builder = GraphBuilder(client)
        builder.prepare_schema()
        report = builder.load_jsonl_file(
            args.normalized,
            repo=args.repo,
            dry_run=args.dry_run,
            high_signal_pr_numbers=high_signal,
        )
        print(json.dumps(report.as_dict(), indent=2, sort_keys=True))
        return 0
    finally:
        client.close()


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="app.graph.cli")
    sub = parser.add_subparsers(dest="command")
    load = sub.add_parser("load", help="load normalized evidence JSONL into Neo4j")
    load.add_argument("--repo", required=True)
    load.add_argument("--normalized", required=True)
    load.add_argument("--high-signal", default=None)
    load.add_argument("--uri", default=None)
    load.add_argument("--database", default=None)
    load.add_argument("--dry-run", action="store_true")
    return parser


def _client(args: argparse.Namespace) -> Neo4jClient:
    uri = args.uri or os.environ.get("WHYCODE_NEO4J_URI", "").strip()
    user = os.environ.get("WHYCODE_NEO4J_USER", "").strip()
    password = os.environ.get("WHYCODE_NEO4J_PASSWORD", "").strip()
    database = (
        args.database
        or os.environ.get("WHYCODE_NEO4J_DATABASE", "").strip()
        or "neo4j"
    )
    missing = [
        name
        for name, value in (
            ("WHYCODE_NEO4J_URI", uri),
            ("WHYCODE_NEO4J_USER", user),
            ("WHYCODE_NEO4J_PASSWORD", password),
        )
        if not value
    ]
    if missing:
        raise SystemExit(
            "missing Neo4j environment variables: " + ", ".join(missing)
        )
    return Neo4jClient.connect(
        uri=uri, database=database, user=user, password=password
    )


def _read_pr_numbers(path: Path) -> set[int]:
    numbers: set[int] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        payload: Any = json.loads(line)
        if not isinstance(payload, dict):
            continue
        number = payload.get("pr_number", payload.get("number"))
        if isinstance(number, int) and number > 0:
            numbers.add(number)
    return numbers


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())


__all__ = ["main"]
