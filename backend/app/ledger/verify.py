"""Evidence verification and decision currency, checked against git.

Verification answers *is this quote really there?*; currency answers *does
this decision still describe the code?*. Both are deterministic: no model.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.ledger.git import Git
from app.ledger.models import (
    Currency,
    CurrencyReport,
    Decision,
    Evidence,
    Status,
    Verification,
)

NEEDS_REVIEW_FRACTION = 0.5


def _squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def verify_evidence(item: Evidence, root: Path, git: Git | None) -> Evidence:
    """Return ``item`` with ``verification`` (and corrected lines) set."""
    quote = item.quote.strip()
    if item.path and quote:
        try:
            lines = (root / item.path).read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            return item.model_copy(update={"verification": Verification.UNVERIFIED})
        start = (item.start_line or 1) - 1
        end = item.end_line or start + 1
        window = "\n".join(lines[max(start, 0) : max(end, start + 1)])
        if quote in window:
            return item.model_copy(update={"verification": Verification.VERIFIED})
        needle = _squash(quote)
        for index, line in enumerate(lines):
            if needle and needle in _squash(line):
                # Found elsewhere (the file moved under it): fuzzy, with the
                # current location recorded.
                return item.model_copy(
                    update={
                        "verification": Verification.FUZZY,
                        "start_line": index + 1,
                        "end_line": index + 1,
                    }
                )
        if needle and needle in _squash("\n".join(lines)):
            return item.model_copy(update={"verification": Verification.FUZZY})
        return item.model_copy(update={"verification": Verification.UNVERIFIED})
    if item.commit_sha and git is not None:
        if not git.commit_exists(item.commit_sha):
            return item.model_copy(update={"verification": Verification.UNVERIFIED})
        try:
            message = git.run("log", "-1", "--format=%B", item.commit_sha)
        except Exception:  # noqa: BLE001 - verification degrades, never raises
            return item.model_copy(update={"verification": Verification.UNVERIFIED})
        if quote and quote in message:
            return item.model_copy(update={"verification": Verification.VERIFIED})
        if quote and _squash(quote) in _squash(message):
            return item.model_copy(update={"verification": Verification.FUZZY})
        return item.model_copy(update={"verification": Verification.UNVERIFIED})
    return item


def currency(decision: Decision, git: Git | None, tracked: set[str] | None) -> CurrencyReport:
    if decision.status is Status.DISMISSED:
        return CurrencyReport(currency=Currency.DISMISSED)
    if decision.status is Status.SUPERSEDED:
        return CurrencyReport(currency=Currency.SUPERSEDED)
    if decision.status is Status.PROPOSED:
        return CurrencyReport(currency=Currency.BACKGROUND)
    if not decision.scope:
        return CurrencyReport(currency=Currency.UNCHECKABLE)
    if git is None or tracked is None:
        return CurrencyReport(currency=Currency.ACTIVE)
    anchor = decision.anchor_commit or decision.anchor_at
    changed, renamed, _deleted = git.changed_since(anchor, decision.scope)

    def present(path: str) -> bool:
        if path.endswith("/"):
            return any(t.startswith(path) for t in tracked)
        return path in tracked or renamed.get(path, "") in tracked

    missing = [p for p in decision.scope if not present(p)]
    if len(missing) == len(decision.scope):
        return CurrencyReport(currency=Currency.STALE, missing_files=missing, renamed=renamed)
    touched = [
        p
        for p in decision.scope
        if (p in changed) or (p.endswith("/") and any(c.startswith(p) for c in changed))
    ]
    fraction = len(touched) / len(decision.scope)
    state = Currency.NEEDS_REVIEW if fraction >= NEEDS_REVIEW_FRACTION else Currency.ACTIVE
    return CurrencyReport(
        currency=state,
        changed_fraction=round(fraction, 3),
        changed_files=touched,
        missing_files=missing,
        renamed=renamed,
    )


__all__ = ["NEEDS_REVIEW_FRACTION", "currency", "verify_evidence"]
