#!/usr/bin/env python3
"""Decision authoring assistant for pull requests.

Scans a PR title + body with the same deterministic markers the
candidate detector uses and, when the PR looks like it carries a
decision, constraint, reversal or incident, prints a ready-to-paste
decision record in the project's format. Prints nothing (and exits 0)
when there is no signal, so it is safe to run on every PR.

Usage:
    python tools/suggest_decision.py --title "..." --body "..."
    PR_TITLE=... PR_BODY=... python tools/suggest_decision.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.intent.selection.candidate_detector import (  # noqa: E402
    CONSTRAINT_MARKERS,
    INCIDENT_MARKERS,
    MOTIVATION_MARKERS,
    REVERSAL_TITLE,
)


def classify(title: str, body: str) -> str | None:
    text = f"{title}\n{body}"
    if REVERSAL_TITLE.search(title):
        return "REVERSAL"
    if CONSTRAINT_MARKERS.search(text):
        return "CONSTRAINT"
    if INCIDENT_MARKERS.search(text):
        return "INCIDENT"
    lowered = text.lower()
    if any(marker in lowered for marker in MOTIVATION_MARKERS):
        return "DECISION"
    return None


def suggestion(title: str, body: str) -> str | None:
    kind = classify(title, body)
    if kind is None:
        return None
    return (
        f"This PR looks like a **{kind}** candidate. Consider recording it"
        " as a decision before merging:\n\n"
        "```markdown\n"
        f"## D-XXXX: {title.strip()}\n\n"
        "- **Status:** active\n"
        f"- **Class:** {kind}\n"
        "- **Context:** <what prompted this change>\n"
        "- **Decision:** <what was decided, in one sentence>\n"
        "- **Rationale:** <why — link the discussion and evidence>\n"
        "- **Consequences:** <what this enables, forbids, or reverses>\n"
        "```\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--title", default=os.environ.get("PR_TITLE", ""))
    parser.add_argument("--body", default=os.environ.get("PR_BODY", ""))
    args = parser.parse_args()
    text = suggestion(args.title, args.body)
    if text:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
