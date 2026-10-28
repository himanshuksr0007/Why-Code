#!/usr/bin/env python3
"""Policy-as-code gate for decision candidates.

Reads candidates as JSONL (one object per line, the shape the detector
emits: candidate_class, candidate_id, reasons, evidence_ids, links)
and fails when a policy rule is breached — an incident candidate with
no linked postmortem, or a reversal with no evidence.

Usage:
    python tools/policy_gate.py candidates.jsonl
    python tools/policy_gate.py --stdin < candidates.jsonl

Exit code 0 = pass, 1 = violations found, 2 = input error.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.features.policy import evaluate_candidates  # noqa: E402


def _load(source: str | None) -> list[dict]:
    text = sys.stdin.read() if source is None else Path(source).read_text()
    candidates = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            candidates.append(json.loads(line))
    return candidates


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", nargs="?", help="candidates JSONL (default: stdin)")
    args = parser.parse_args()
    try:
        candidates = _load(args.file)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"policy gate: could not read candidates: {exc}", file=sys.stderr)
        return 2
    violations = evaluate_candidates(candidates)
    for violation in violations:
        print(
            f"VIOLATION {violation['candidate_id']}: "
            f"{violation['rule']} — {violation['detail']}"
        )
    if violations:
        print(f"policy gate: {len(violations)} violation(s) across {len(candidates)} candidate(s)")
        return 1
    print(f"policy gate: PASS ({len(candidates)} candidate(s) checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
