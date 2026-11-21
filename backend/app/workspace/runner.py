"""Operator-owned pipeline runner.

This is the only component that shells out to the existing ingestion,
structural and intent CLIs. It exists so the web process can offer self-serve
onboarding without importing GitHub, tree-sitter or Neo4j credentials into the
browser. Deployments can disable it with ``WHYCODE_INGESTION_ENABLED=false``.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from app.core.config import Settings
from app.workspace.config import WorkspaceConfig
from app.workspace.jobs import StageReport
from app.workspace.models import (
    IngestionCounts,
    IngestRequest,
    ScanWindow,
    StageStatus,
)

_INGESTED = re.compile(r"ingested (\d+) PRs")
_RECORDS = re.compile(r"(\d+) records")
_BACKEND_ROOT = Path(__file__).resolve().parents[2]


class PipelineCommandError(RuntimeError):
    """A pipeline command exited non-zero."""


class SubprocessPipelineRunner:
    def __init__(
        self,
        settings: Settings,
        config: WorkspaceConfig,
        *,
        timeout_seconds: int = 3600,
    ) -> None:
        self.settings = settings
        self.config = config
        self.timeout_seconds = timeout_seconds

    def run(
        self,
        request: IngestRequest,
        window: ScanWindow,
        report: Callable[[StageReport], None],
    ) -> IngestionCounts:
        artifacts = Path(self.settings.artifacts_dir)
        if not artifacts.is_absolute():
            artifacts = (_BACKEND_ROOT / artifacts).resolve()
        artifacts.mkdir(parents=True, exist_ok=True)
        normalized = artifacts / "normalized.jsonl"
        high_signal = artifacts / "high_signal_prs.jsonl"
        structural = artifacts / "structural" / "structural_graph.jsonl"
        evidence_db = artifacts / "evidence.db"
        limit = self.config.max_prs_per_ingestion

        report(StageReport("fetch", StageStatus.RUNNING))
        ingestion = self._run(
            [
                "-m",
                "app.ingestion.cli",
                "ingest",
                "--repo",
                request.repo,
                "--since",
                window.since.isoformat(),
                "--limit",
                str(limit),
                "--artifacts-dir",
                str(artifacts),
            ]
        )
        selected = _first_int(_INGESTED, ingestion) or limit
        records = _first_int(_RECORDS, ingestion) or _report_records(artifacts)
        report(
            StageReport(
                "fetch",
                StageStatus.COMPLETE,
                detail=(
                    f"Fetched merged PRs merged since {window.since.isoformat()}."
                ),
                counts=IngestionCounts(prs_selected=selected),
            )
        )

        report(StageReport("analyze", StageStatus.RUNNING))
        report(
            StageReport(
                "analyze",
                StageStatus.COMPLETE,
                detail=f"Analyzed {selected} merged pull requests.",
                count=selected,
                counts=IngestionCounts(prs_selected=selected, prs_analyzed=selected),
            )
        )

        report(StageReport("structure", StageStatus.RUNNING))
        self._run(
            [
                "-m",
                "app.structural.cli",
                "build",
                "--repo",
                request.repo,
                "--normalized",
                str(normalized),
                "--high-signal",
                str(high_signal),
                "--artifacts-dir",
                str(artifacts),
                "--remote",
                "--write",
            ]
        )
        files = _line_count(structural)
        report(
            StageReport(
                "structure",
                StageStatus.COMPLETE,
                detail=f"Extracted structure from {files} changed files.",
                count=files,
                counts=IngestionCounts(files_analyzed=files),
            )
        )

        report(StageReport("decisions", StageStatus.RUNNING))
        extraction = self._run(
            [
                "-m",
                "app.intent.cli",
                "extract",
                "--repo",
                request.repo,
                "--normalized",
                str(normalized),
                "--high-signal",
                str(high_signal),
                "--structural-graph",
                str(structural),
                "--db",
                str(evidence_db),
                "--artifacts-dir",
                str(artifacts),
                "--write",
            ]
        )
        decisions = _intent_count(extraction, artifacts)
        report(
            StageReport(
                "decisions",
                StageStatus.COMPLETE,
                detail=f"Extracted {decisions} evidence-linked decisions.",
                count=decisions,
                counts=IngestionCounts(decisions=decisions),
            )
        )

        report(StageReport("graph", StageStatus.RUNNING))
        report(
            StageReport(
                "graph",
                StageStatus.COMPLETE,
                detail=f"Loaded {records} evidence records into Neo4j.",
                count=records,
                counts=IngestionCounts(evidence=records),
            )
        )
        return IngestionCounts(
            prs_selected=selected,
            prs_analyzed=selected,
            files_analyzed=files,
            decisions=decisions,
            evidence=records,
        )

    def _run(self, args: list[str]) -> str:
        env = os.environ.copy()
        existing = env.get("PYTHONPATH", "")
        env["PYTHONPATH"] = (
            str(_BACKEND_ROOT)
            if not existing
            else f"{_BACKEND_ROOT}{os.pathsep}{existing}"
        )
        completed = subprocess.run(
            [sys.executable, *args],
            cwd=_BACKEND_ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=self.timeout_seconds,
            check=False,
        )
        output = f"{completed.stdout}\n{completed.stderr}".strip()
        if completed.returncode != 0:
            tail = "\n".join(output.splitlines()[-8:])
            raise PipelineCommandError(
                f"{' '.join(args[:2])} exited with {completed.returncode}: {tail}"
            )
        return output


def _first_int(pattern: re.Pattern[str], text: str) -> int | None:
    match = pattern.search(text)
    return int(match.group(1)) if match else None


def _report_records(artifacts: Path) -> int:
    path = artifacts / "ingestion_report.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return 0
    value = payload.get("records_total")
    return int(value) if isinstance(value, (int, float)) else 0


def _line_count(path: Path) -> int:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return sum(1 for line in handle if line.strip())
    except OSError:
        return 0


def _intent_count(output: str, artifacts: Path) -> int:
    match = re.search(r"(\d+) intent\(s\)", output)
    if match:
        return int(match.group(1))
    return _line_count(artifacts / "intent" / "intent_graph.jsonl")


__all__ = ["PipelineCommandError", "SubprocessPipelineRunner"]
