"""In-memory ingestion jobs and their real stage timeline.

A prepared repository (the hackathon fixture index) is ready immediately.
Self-serve repositories only move forward when an operator has wired a real
pipeline runner; otherwise the job fails with the product's honest boundary
message instead of pretending work is happening.
"""

from __future__ import annotations

import threading
import uuid
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Protocol

from app.workspace.config import WorkspaceConfig
from app.workspace.models import (
    IngestionCounts,
    IngestionJob,
    IngestRequest,
    JobStage,
    JobState,
    ScanWindow,
    StageStatus,
)

PREPARED_MESSAGE = "Pre-ingested repository is ready."
NOT_INGESTED_MESSAGE = (
    "This repository has not been ingested yet. Self-serve ingestion is not "
    "enabled on this deployment."
)
NOT_INGESTED_ERROR = (
    "This repository has not been ingested yet, or it does not contain enough "
    "evidence to answer questions defensibly."
)

_STAGE_DEFS: tuple[tuple[str, str], ...] = (
    ("fetch", "Fetching repository history…"),
    ("analyze", "Analyzing merged pull requests…"),
    ("structure", "Extracting code structure…"),
    ("decisions", "Identifying decisions and evidence…"),
    ("graph", "Building decision graph…"),
    ("ready", "Ready."),
)


class StageUpdate(Protocol):
    pass


class PipelineRunner(Protocol):
    """The only seam that performs real ingestion work.

    Implementations are operator-owned. They must report every stage they
    actually enter and must raise on failure; the job manager turns that into
    a failed timeline rather than a fabricated success.
    """

    def run(
        self,
        request: IngestRequest,
        window: ScanWindow,
        report: Callable[["StageReport"], None],
    ) -> IngestionCounts: ...


class StageReport:
    def __init__(
        self,
        stage_id: str,
        status: StageStatus,
        *,
        detail: str = "",
        count: int | None = None,
        counts: IngestionCounts | None = None,
    ) -> None:
        self.stage_id = stage_id
        self.status = status
        self.detail = detail
        self.count = count
        self.counts = counts


class IngestionJobManager:
    def __init__(
        self,
        config: WorkspaceConfig,
        *,
        prepared_counts: Mapping[str, IngestionCounts] | None = None,
        runner: PipelineRunner | None = None,
        on_ready: Callable[[str], None] | None = None,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self.config = config
        self.prepared_counts = dict(prepared_counts or {})
        self.runner = runner
        self.on_ready = on_ready
        self._now = now or (lambda: datetime.now(UTC))
        self._jobs: dict[str, IngestionJob] = {}
        self._latest: dict[str, str] = {}
        self._lock = threading.RLock()

    # -- queries --------------------------------------------------------
    def get(self, job_id: str) -> IngestionJob | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return job.model_copy(deep=True) if job is not None else None

    def latest_for(self, repo: str) -> IngestionJob | None:
        with self._lock:
            job_id = self._latest.get(repo)
            if job_id is None:
                return None
            job = self._jobs.get(job_id)
            return job.model_copy(deep=True) if job is not None else None

    def prepared(self) -> dict[str, IngestionCounts]:
        return dict(self.prepared_counts)

    # -- commands -------------------------------------------------------
    def submit(self, repo: str, request: IngestRequest, window: ScanWindow) -> IngestionJob:
        now = self._now().isoformat()
        job = IngestionJob(
            job_id=f"job_{uuid.uuid4().hex[:12]}",
            repo=repo,
            depth=request.depth,
            window=window,
            focus=list(request.focus),
            prepared=repo in self.prepared_counts,
            created_at=now,
            updated_at=now,
            stages=[
                JobStage(id=stage_id, label=label) for stage_id, label in _STAGE_DEFS
            ],
        )
        with self._lock:
            self._jobs[job.job_id] = job
            self._latest[repo] = job.job_id

        if job.prepared:
            self._complete_prepared(job)
        elif self.runner is None or not self.config.ingestion_enabled:
            self._fail_unavailable(job)
        else:
            self._start(job, request, window)
        with self._lock:
            return job.model_copy(deep=True)

    # -- internals ------------------------------------------------------
    def _complete_prepared(self, job: IngestionJob) -> None:
        counts = self.prepared_counts[job.repo]
        with self._lock:
            for stage in job.stages:
                stage.status = StageStatus.COMPLETE
                stage.detail = PREPARED_MESSAGE
                stage.count = _stage_count(stage.id, counts)
            _set_counts(job, counts)
            job.state = JobState.READY
            job.current_stage = "ready"
            job.progress = 100
            job.message = PREPARED_MESSAGE
            job.updated_at = self._now().isoformat()

    def _fail_unavailable(self, job: IngestionJob) -> None:
        with self._lock:
            fetch = _stage(job, "fetch")
            fetch.status = StageStatus.FAILED
            fetch.detail = NOT_INGESTED_MESSAGE
            job.state = JobState.FAILED
            job.current_stage = "fetch"
            job.message = NOT_INGESTED_MESSAGE
            job.error = NOT_INGESTED_ERROR
            job.updated_at = self._now().isoformat()

    def _start(
        self, job: IngestionJob, request: IngestRequest, window: ScanWindow
    ) -> None:
        with self._lock:
            job.state = JobState.RUNNING
            _mark_running(job, "fetch")
            job.progress = 0
            job.updated_at = self._now().isoformat()
        thread = threading.Thread(
            target=self._run,
            args=(job.job_id, request, window),
            name=f"whycode-ingest-{job.job_id}",
            daemon=True,
        )
        thread.start()

    def _run(
        self, job_id: str, request: IngestRequest, window: ScanWindow
    ) -> None:
        def report(update: StageReport) -> None:
            with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    return
                stage = _stage(job, update.stage_id)
                if update.status is StageStatus.RUNNING:
                    _settle_running(job)
                    stage.status = StageStatus.RUNNING
                    job.current_stage = stage.id
                elif update.status in {StageStatus.COMPLETE, StageStatus.FAILED}:
                    stage.status = update.status
                    if update.detail:
                        stage.detail = update.detail
                    if update.count is not None:
                        stage.count = update.count
                if update.counts is not None:
                    _merge_counts(job, update.counts)
                    _refresh_analyze_label(job)
                job.progress = _progress(job)
                job.updated_at = self._now().isoformat()

        try:
            runner = self.runner
            if runner is None:
                raise RuntimeError("ingestion runner is not configured")
            counts = runner.run(request, window, report)
            with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    return
                _set_counts(job, counts)
                for stage in job.stages:
                    stage.status = StageStatus.COMPLETE
                    stage.detail = stage.detail or "Complete."
                    stage.count = _stage_count(stage.id, counts)
                job.state = JobState.READY
                job.current_stage = "ready"
                job.progress = 100
                job.message = PREPARED_MESSAGE.replace("Pre-ingested", "Ingested")
                job.error = None
                job.updated_at = self._now().isoformat()
            if self.on_ready is not None:
                self.on_ready(job.repo)
        except Exception as error:  # noqa: BLE001 - surfaced to the operator/UI
            message = f"{type(error).__name__}: {error}"
            with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    return
                running = next(
                    (item for item in job.stages if item.status is StageStatus.RUNNING),
                    None,
                )
                if running is not None:
                    running.status = StageStatus.FAILED
                    running.detail = job.error or message
                    job.current_stage = running.id
                job.state = JobState.FAILED
                job.message = "Ingestion stopped before the repository was ready."
                job.error = message
                job.updated_at = self._now().isoformat()


def _stage(job: IngestionJob, stage_id: str) -> JobStage:
    for stage in job.stages:
        if stage.id == stage_id:
            return stage
    raise KeyError(stage_id)


def _mark_running(job: IngestionJob, stage_id: str) -> None:
    _settle_running(job)
    stage = _stage(job, stage_id)
    stage.status = StageStatus.RUNNING
    job.current_stage = stage_id


def _settle_running(job: IngestionJob) -> None:
    for stage in job.stages:
        if stage.status is StageStatus.RUNNING:
            stage.status = StageStatus.COMPLETE


def _progress(job: IngestionJob) -> int:
    measurable = [stage for stage in job.stages if stage.id != "ready"]
    done = sum(1 for stage in measurable if stage.status is StageStatus.COMPLETE)
    if job.state is JobState.READY:
        return 100
    return round(done / len(measurable) * 100)


def _set_counts(job: IngestionJob, counts: IngestionCounts) -> None:
    job.counts = counts
    _refresh_analyze_label(job)


def _merge_counts(job: IngestionJob, counts: IngestionCounts) -> None:
    current = job.counts.model_dump()
    for key, value in counts.model_dump().items():
        if value:
            current[key] = value
    job.counts = IngestionCounts(**current)


def _refresh_analyze_label(job: IngestionJob) -> None:
    analyze = _stage(job, "analyze")
    selected = job.counts.prs_selected or job.counts.prs_analyzed
    if selected:
        analyze.label = f"Analyzing {selected} merged pull request"
        analyze.label += "" if selected == 1 else "s"
        analyze.label += "…"


def _stage_count(stage_id: str, counts: IngestionCounts) -> int | None:
    return {
        "fetch": counts.prs_selected or None,
        "analyze": counts.prs_analyzed or None,
        "structure": counts.files_analyzed or None,
        "decisions": counts.decisions or None,
        "graph": counts.evidence or None,
        "ready": None,
    }[stage_id]


__all__ = [
    "IngestionJobManager",
    "NOT_INGESTED_ERROR",
    "NOT_INGESTED_MESSAGE",
    "PREPARED_MESSAGE",
    "PipelineRunner",
    "StageReport",
]
