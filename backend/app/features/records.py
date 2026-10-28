"""Normalized decision records over both retrieval backends.

The fixture/demo backend enumerates full graph contexts; the live
service synthesizes decision *threads* per repository. Both flatten
into one :class:`DecisionRecord` shape so list, search, supersession,
audit and export behave identically in either mode.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.intent.selection.candidate_detector import INCIDENT_MARKERS

_TOKEN = re.compile(r"[a-z0-9_./-]+")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EvidenceRef(_Strict):
    evidence_id: str
    kind: str = ""
    path: str | None = None
    url: str | None = None
    author: str | None = None


class DecisionRecord(_Strict):
    decision_id: str
    repo: str
    title: str | None = None
    claim: str = ""
    rationale: str = ""
    status: str = "active"
    confidence: str = "medium"
    kind: str = "decision"  # origin | revision | reversal | decision
    topic: str | None = None
    target_ids: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    evidence: list[EvidenceRef] = Field(default_factory=list)
    superseded_by: str | None = None
    supersedes: list[str] = Field(default_factory=list)
    pr_number: int | None = None
    created_at: str | None = None


class RecordsPage(_Strict):
    total: int
    limit: int
    offset: int
    records: list[DecisionRecord]


class SupersessionPair(_Strict):
    repo: str
    earlier: DecisionRecord
    later: DecisionRecord
    relation: str = "SUPERSEDED_BY"


class AuditReport(_Strict):
    repo: str
    generated_at: str
    total: int
    by_status: dict[str, int]
    by_kind: dict[str, int]
    with_rationale_pct: float
    with_evidence_pct: float
    superseded: int
    security_flagged: int
    security_missing_rationale: list[str]
    missing_evidence: list[str]


def _tokens(text: str) -> set[str]:
    return set(_TOKEN.findall(text.lower()))


def _record_text(record: DecisionRecord) -> str:
    parts = [
        record.title or "",
        record.claim,
        record.rationale,
        record.topic or "",
        " ".join(record.target_ids),
    ]
    return " ".join(parts).lower()


class RecordProvider:
    """Flattens demo contexts and live threads into decision records."""

    def __init__(self, service: Any, live_service: Any) -> None:
        self._service = service
        self._live = live_service
        self._live_flat_cache: dict[str, list[DecisionRecord]] = {}

    # -- sources ------------------------------------------------------

    def known_repos(self) -> list[str]:
        repos: list[str] = []
        backend = getattr(self._service, "backend", None)
        if backend is not None and getattr(backend, "contexts", None):
            repos.append(self._service.resolve_repo(None))
        if self._live is not None:
            for repo in getattr(self._live, "_decision_cache", {}):
                if repo not in repos:
                    repos.append(repo)
        return repos

    def records_for(self, repo: str) -> list[DecisionRecord]:
        records = self._demo_records(repo)
        if records:
            return records
        return self._live_records(repo)

    def _demo_records(self, repo: str) -> list[DecisionRecord]:
        service = self._service
        backend = getattr(service, "backend", None)
        contexts = getattr(backend, "contexts", None)
        if not contexts:
            return []
        try:
            resolved = service.resolve_repo(repo)
        except Exception:
            resolved = repo
        records: list[DecisionRecord] = []
        seen: set[str] = set()
        for context in contexts.values():
            decision = context.decision
            # The demo index aliases one context under several keys
            # (retrieval entry points); a decision is one record.
            if decision.decision_id in seen:
                continue
            seen.add(decision.decision_id)
            evidence = [
                EvidenceRef(
                    evidence_id=item.evidence_id,
                    kind=item.kind,
                    path=item.path,
                    url=item.url,
                    author=item.author,
                )
                for item in context.evidence
            ]
            pr_number = decision.pr_number if hasattr(decision, "pr_number") else None
            if pr_number is None:
                for item in context.evidence:
                    if item.pr_number is not None:
                        pr_number = item.pr_number
                        break
            kind = (
                "reversal"
                if decision.status == "reversed"
                else "revision"
                if decision.status == "superseded"
                else "origin"
            )
            records.append(
                DecisionRecord(
                    decision_id=decision.decision_id,
                    repo=resolved,
                    title=getattr(decision, "title", None),
                    claim=decision.claim,
                    rationale=decision.rationale,
                    status=str(decision.status),
                    confidence=str(decision.confidence),
                    kind=kind,
                    target_ids=list(decision.target_ids),
                    evidence_ids=list(decision.evidence_ids),
                    evidence=evidence,
                    superseded_by=decision.superseded_by,
                    pr_number=pr_number,
                    created_at=decision.created_at,
                )
            )
        return _with_supersedes(records)

    def _live_records(self, repo: str) -> list[DecisionRecord]:
        if self._live is None:
            return []
        if repo in self._live_flat_cache:
            return self._live_flat_cache[repo]
        threads = self._live.list_decisions(repo)
        records: list[DecisionRecord] = []
        for thread in threads or []:
            steps = thread.get("steps", [])
            topic = thread.get("topic")
            for index, step in enumerate(steps):
                d = step.get("decision", {})
                if not d.get("decision_id"):
                    continue
                status = str(d.get("status", "active"))
                superseded_by = d.get("superseded_by")
                if superseded_by is None and status in {"superseded", "reversed"}:
                    # Thread steps are chronological: the next step is the
                    # decision that replaced this one.
                    for later in steps[index + 1 :]:
                        later_id = later.get("decision", {}).get("decision_id")
                        if later_id:
                            superseded_by = later_id
                            break
                targets = [
                    f"{t.get('type')}:{t.get('identifier')}"
                    for t in d.get("targets", [])
                    if t.get("identifier")
                ]
                records.append(
                    DecisionRecord(
                        decision_id=d["decision_id"],
                        repo=repo,
                        title=d.get("title"),
                        claim=d.get("claim", ""),
                        rationale=d.get("rationale") or d.get("claim", ""),
                        status=status,
                        confidence=str(d.get("confidence", "medium")),
                        kind=step.get("kind") or "decision",
                        topic=topic,
                        target_ids=targets,
                        evidence_ids=list(d.get("evidence_ids", [])),
                        superseded_by=superseded_by,
                        pr_number=d.get("pr_number"),
                        created_at=d.get("created_at"),
                    )
                )
        records = _with_supersedes(records)
        self._live_flat_cache[repo] = records
        return records

    def invalidate(self, repo: str) -> None:
        """Drop flattened records and the live thread cache for a repo."""
        self._live_flat_cache.pop(repo, None)
        cache = getattr(self._live, "_decision_cache", None)
        if isinstance(cache, dict):
            cache.pop(repo, None)


def _with_supersedes(records: list[DecisionRecord]) -> list[DecisionRecord]:
    by_id = {record.decision_id: record for record in records}
    for record in records:
        if record.superseded_by and record.superseded_by in by_id:
            successor = by_id[record.superseded_by]
            if record.decision_id not in successor.supersedes:
                successor.supersedes.append(record.decision_id)
    return records


# -- queries ----------------------------------------------------------


def filter_records(
    records: list[DecisionRecord],
    *,
    q: str | None = None,
    status: str | None = None,
    kind: str | None = None,
    target: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[DecisionRecord]:
    out = list(records)
    if status:
        out = [r for r in out if r.status == status]
    if kind:
        out = [r for r in out if r.kind == kind]
    if target:
        needle = target.lower()
        out = [
            r for r in out if any(needle in t.lower() for t in r.target_ids)
        ]
    if date_from:
        out = [r for r in out if (r.created_at or "") >= date_from]
    if date_to:
        out = [r for r in out if (r.created_at or "") <= date_to]
    if q:
        wanted = _tokens(q)
        scored: list[tuple[int, DecisionRecord]] = []
        for record in out:
            haystack = _tokens(_record_text(record))
            if wanted and wanted.issubset(haystack):
                scored.append((len(wanted & haystack), record))
        scored.sort(key=lambda pair: (-pair[0], pair[1].created_at or ""))
        out = [record for _, record in scored]
    else:
        out.sort(key=lambda r: r.created_at or "", reverse=True)
    return out


def supersession_pairs(records: list[DecisionRecord]) -> list[SupersessionPair]:
    by_id = {record.decision_id: record for record in records}
    pairs: list[SupersessionPair] = []
    for record in records:
        successor = by_id.get(record.superseded_by or "")
        if successor is not None:
            pairs.append(
                SupersessionPair(
                    repo=record.repo,
                    earlier=record,
                    later=successor,
                    relation=(
                        "REVERSED_BY"
                        if record.status == "reversed"
                        else "SUPERSEDED_BY"
                    ),
                )
            )
    return pairs


def audit_report(records: list[DecisionRecord], repo: str) -> AuditReport:
    total = len(records)
    by_status: dict[str, int] = {}
    by_kind: dict[str, int] = {}
    for record in records:
        by_status[record.status] = by_status.get(record.status, 0) + 1
        by_kind[record.kind] = by_kind.get(record.kind, 0) + 1

    def has_rationale(record: DecisionRecord) -> bool:
        return bool(record.rationale.strip()) and record.rationale != record.claim

    with_rationale = sum(1 for r in records if has_rationale(r))
    with_evidence = sum(1 for r in records if r.evidence_ids)
    flagged = [
        r
        for r in records
        if INCIDENT_MARKERS.search(f"{r.claim} {r.rationale}")
    ]
    return AuditReport(
        repo=repo,
        generated_at=datetime.now(timezone.utc).isoformat(),
        total=total,
        by_status=by_status,
        by_kind=by_kind,
        with_rationale_pct=round(100.0 * with_rationale / total, 1) if total else 0.0,
        with_evidence_pct=round(100.0 * with_evidence / total, 1) if total else 0.0,
        superseded=sum(
            1 for r in records if r.status in {"superseded", "reversed"}
        ),
        security_flagged=len(flagged),
        security_missing_rationale=[
            r.decision_id for r in flagged if not has_rationale(r)
        ],
        missing_evidence=[r.decision_id for r in records if not r.evidence_ids],
    )


def to_adr_markdown(record: DecisionRecord) -> str:
    """Render a record as an Architecture Decision Record document."""
    title = record.title or record.claim or record.decision_id
    lines = [
        f"# {record.decision_id}: {title}",
        "",
        f"- **Status:** {record.status}"
        + (
            f" (superseded by {record.superseded_by})"
            if record.superseded_by
            else ""
        ),
        f"- **Repository:** {record.repo}",
        f"- **Confidence:** {record.confidence}",
    ]
    if record.created_at:
        lines.append(f"- **Date:** {record.created_at}")
    if record.pr_number is not None:
        lines.append(f"- **Pull request:** #{record.pr_number}")
    if record.topic:
        lines.append(f"- **Topic:** {record.topic}")
    lines += ["", "## Decision", "", record.claim or "_(no claim recorded)_", ""]
    lines += [
        "## Rationale",
        "",
        record.rationale or "_(no rationale recorded)_",
        "",
    ]
    if record.target_ids:
        lines += ["## Targets", ""]
        lines += [f"- `{target}`" for target in record.target_ids]
        lines.append("")
    if record.evidence:
        lines += ["## Evidence", ""]
        for ref in record.evidence:
            label = ref.path or ref.evidence_id
            suffix = f" ({ref.url})" if ref.url else ""
            lines.append(f"- [{ref.kind or 'evidence'}] {label}{suffix}")
        lines.append("")
    elif record.evidence_ids:
        lines += ["## Evidence", ""]
        lines += [f"- {evidence_id}" for evidence_id in record.evidence_ids]
        lines.append("")
    if record.supersedes:
        lines += [
            "## Supersedes",
            "",
            *[f"- {decision_id}" for decision_id in record.supersedes],
            "",
        ]
    return "\n".join(lines).rstrip() + "\n"
