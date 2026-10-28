"""Policy gate rules and the decision-suggestion classifier."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

from app.features.policy import evaluate_candidates

BACKEND = Path(__file__).resolve().parents[2]


def _load_tool(name: str):
    spec = importlib.util.spec_from_file_location(name, BACKEND / "tools" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_incident_without_postmortem_violates() -> None:
    violations = evaluate_candidates(
        [{"candidate_id": "c1", "candidate_class": "INCIDENT_CANDIDATE", "reasons": ["crash in prod"]}]
    )
    assert len(violations) == 1
    assert violations[0]["rule"] == "incident_requires_postmortem"


def test_incident_with_postmortem_passes() -> None:
    violations = evaluate_candidates(
        [
            {
                "candidate_id": "c1",
                "candidate_class": "INCIDENT_CANDIDATE",
                "links": ["https://example.com/postmortem/2026-01"],
            }
        ]
    )
    assert violations == []


def test_reversal_without_evidence_violates() -> None:
    violations = evaluate_candidates(
        [{"candidate_id": "c2", "candidate_class": "REVERSAL_CANDIDATE", "evidence_ids": []}]
    )
    assert len(violations) == 1
    assert violations[0]["rule"] == "reversal_requires_evidence"


def test_plain_decision_candidate_passes() -> None:
    assert evaluate_candidates([{"candidate_class": "DECISION_CANDIDATE"}]) == []


def test_policy_gate_cli_exit_codes(tmp_path: Path) -> None:
    bad = tmp_path / "candidates.jsonl"
    bad.write_text(
        json.dumps({"candidate_id": "c9", "candidate_class": "INCIDENT_CANDIDATE"}) + "\n"
    )
    result = subprocess.run(
        [sys.executable, str(BACKEND / "tools" / "policy_gate.py"), str(bad)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "incident_requires_postmortem" in result.stdout

    good = tmp_path / "ok.jsonl"
    good.write_text(json.dumps({"candidate_class": "DECISION_CANDIDATE"}) + "\n")
    result = subprocess.run(
        [sys.executable, str(BACKEND / "tools" / "policy_gate.py"), str(good)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    assert "PASS" in result.stdout


def test_suggest_decision_classification() -> None:
    suggest = _load_tool("suggest_decision")
    assert suggest.classify("Revert retry defaults", "") == "REVERSAL"
    assert suggest.classify("Add limits", "Clients must not exceed 100 rps") == "CONSTRAINT"
    assert suggest.classify("Fix crash on startup", "stack trace attached") == "INCIDENT"
    assert suggest.classify("Add dark mode toggle", "Adds a toggle in settings.") is None
    text = suggest.suggestion("Revert retry defaults", "")
    assert text is not None and "D-XXXX" in text
