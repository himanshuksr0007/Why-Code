"""Resolve the visitor's scan depth into a concrete, honest date window."""

from __future__ import annotations

import calendar
from datetime import date

from app.workspace.config import WorkspaceConfig
from app.workspace.models import IngestRequest, ScanDepth, ScanWindow


class WindowError(ValueError):
    """The requested window is missing or outside the operator's policy."""


def resolve_window(
    request: IngestRequest,
    config: WorkspaceConfig,
    *,
    today: date | None = None,
) -> ScanWindow:
    current = today or date.today()

    if request.depth is ScanDepth.CUSTOM:
        if request.since is None or request.until is None:
            raise WindowError("custom scan requires both a start and an end date")
        window = ScanWindow(since=request.since, until=request.until)
    else:
        months = (
            config.default_window_months
            if request.depth is ScanDepth.QUICK
            else config.deep_window_months
        )
        window = ScanWindow(since=_months_before(current, months), until=current)

    if window.since > window.until:
        raise WindowError("the start date must be on or before the end date")
    if window.until > current:
        raise WindowError("the end date cannot be in the future")
    if _months_between(window.since, window.until) > config.max_window_months:
        raise WindowError(
            f"the selected window is longer than {config.max_window_months} months"
        )
    return window


def _months_before(value: date, months: int) -> date:
    total = value.year * 12 + (value.month - 1) - months
    year, month_index = divmod(total, 12)
    month = month_index + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _months_between(start: date, end: date) -> int:
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(0, months)


__all__ = ["WindowError", "resolve_window"]
