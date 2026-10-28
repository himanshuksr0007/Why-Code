#!/usr/bin/env python3
"""Golden-set regression runner.

Evaluates a predictions file against the golden corpus with the same
metrics the test-suite contracts pin (candidate recall, decision
precision/recall, evidence precision/recall, supersession, refusal
correctness) and optionally fails when a metric drops below a floor —
the CI-friendly way to catch detector/extraction regressions.

Usage:
    python tools/run_golden.py --predictions predictions.jsonl
    python tools/run_golden.py --predictions p.jsonl --min-decision-recall 0.8
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.intent.evaluation.runner import evaluate_files  # noqa: E402

_METRIC_NAMES = (
    "candidate_recall",
    "decision_precision",
    "decision_recall",
    "evidence_precision",
    "evidence_recall",
    "supersession_precision",
    "supersession_recall",
    "refusal_correctness",
)


def _rate(stats: object) -> float | None:
    for attr in ("rate", "value", "score"):
        value = getattr(stats, attr, None)
        if isinstance(value, (int, float)):
            return float(value)
    dumped = stats.model_dump() if hasattr(stats, "model_dump") else {}
    for value in dumped.values():
        if isinstance(value, (int, float)):
            return float(value)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--predictions", required=True)
    parser.add_argument("--golden", default=None)
    parser.add_argument("--repo", default=None)
    parser.add_argument("--corpus", default="all")
    parser.add_argument("--min-decision-recall", type=float, default=None)
    args = parser.parse_args()

    reports = evaluate_files(
        predictions_path=args.predictions,
        golden_path=args.golden,
        repo=args.repo,
        corpus=args.corpus,
    )
    failed = False
    for name, report in sorted(reports.items()):
        print(f"[{name}] {report.case_count} case(s)")
        for metric in _METRIC_NAMES:
            stats = getattr(report.metrics, metric, None)
            if stats is None:
                continue
            rate = _rate(stats)
            print(f"  {metric}: {'n/a' if rate is None else f'{rate:.3f}'}")
            if (
                metric == "decision_recall"
                and args.min_decision_recall is not None
                and rate is not None
                and rate < args.min_decision_recall
            ):
                failed = True
                print(
                    f"  !! decision_recall {rate:.3f} below floor"
                    f" {args.min_decision_recall:.3f}"
                )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
