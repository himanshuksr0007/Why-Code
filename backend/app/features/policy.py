"""Policy-as-code gates over detector candidates.

The hard rule mirrors the audit story the product tells: an incident
candidate may not ship without a linked postmortem. Candidates arrive
as plain dicts (the JSONL the ingestion pipeline emits, or the shape
``CandidateDetector`` produces), so the gate runs anywhere — CI, a
pre-merge hook, or the bundled CLI in ``backend/tools/policy_gate.py``.
"""

from __future__ import annotations

from typing import Any

POSTMORTEM_MARKERS = ("postmortem", "post-mortem", "post_mortem", "rca", "root-cause", "root cause")


def _candidate_text(candidate: dict[str, Any]) -> str:
    parts = [
        str(candidate.get("title", "")),
        str(candidate.get("claim", "")),
        " ".join(str(r) for r in candidate.get("reasons", [])),
        " ".join(str(e) for e in candidate.get("evidence_ids", [])),
        " ".join(str(link) for link in candidate.get("links", [])),
    ]
    return " ".join(parts).lower()


def _has_postmortem(candidate: dict[str, Any]) -> bool:
    text = _candidate_text(candidate)
    return any(marker in text for marker in POSTMORTEM_MARKERS)


def evaluate_candidates(
    candidates: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Return policy violations, one dict per breach (empty = pass)."""
    violations: list[dict[str, str]] = []
    for candidate in candidates:
        candidate_class = str(candidate.get("candidate_class", ""))
        candidate_id = str(
            candidate.get("candidate_id") or candidate.get("decision_id") or "?"
        )
        if candidate_class == "INCIDENT_CANDIDATE" and not _has_postmortem(candidate):
            violations.append(
                {
                    "candidate_id": candidate_id,
                    "rule": "incident_requires_postmortem",
                    "detail": (
                        "INCIDENT_CANDIDATE has no linked postmortem;"
                        " link the postmortem/RCA in the PR before merging."
                    ),
                }
            )
        if candidate_class == "REVERSAL_CANDIDATE" and not candidate.get(
            "evidence_ids"
        ):
            violations.append(
                {
                    "candidate_id": candidate_id,
                    "rule": "reversal_requires_evidence",
                    "detail": (
                        "REVERSAL_CANDIDATE carries no evidence; a reversal"
                        " must cite the decision it overturns."
                    ),
                }
            )
    return violations
