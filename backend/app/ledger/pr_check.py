"""Decision check for a change set — the merge-path gate.

Given the files a pull request touches (and its description), report the
decisions in force that govern them, which of those are pinned, which are
already stale or need review, and whether the description's decisions block
is well-formed. Policy: touching a *pinned* decision's scope requires an
explicit acknowledgement in the description (``Decision-Ack: <id>``), so a
change that knowingly breaks a held decision says so on the record.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.ledger.miners import parse_decision_block
from app.ledger.why import WhyEngine, _governs

_ACK = re.compile(r"Decision-Ack:\s*(dec_[0-9a-f]{4,12})", re.IGNORECASE)


@dataclass
class CheckResult:
    repo: str
    changed_files: list[str]
    governing: list[dict[str, Any]] = field(default_factory=list)
    violations: list[dict[str, str]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    declared: list[dict[str, Any]] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.violations

    def as_dict(self) -> dict[str, Any]:
        return {
            "repo": self.repo,
            "passed": self.passed,
            "changed_files": self.changed_files,
            "governing": self.governing,
            "violations": self.violations,
            "warnings": self.warnings,
            "declared": self.declared,
        }


def check_change(
    engine: WhyEngine, repo: str, changed_files: list[str], pr_body: str | None = None
) -> CheckResult:
    result = CheckResult(repo=repo, changed_files=changed_files)
    git, tracked = engine._git(repo)
    acks = {a.lower() for a in _ACK.findall(pr_body or "")}
    for decision in engine.store.list_decisions(repo):
        touched = [f for f in changed_files if _governs(decision, f)]
        if not touched:
            continue
        card = engine.card(decision, git, tracked)
        if not card["in_force"]:
            continue
        card["touched_files"] = touched
        result.governing.append(card)
        acknowledged = any(decision.decision_id.lower().startswith(a) for a in acks)
        if decision.pinned and not acknowledged:
            result.violations.append(
                {
                    "decision_id": decision.decision_id,
                    "rule": "pinned_decision_requires_ack",
                    "detail": (
                        f"Changes {', '.join(touched)} governed by pinned decision "
                        f"'{decision.title}'. Add 'Decision-Ack: {decision.decision_id}' to the "
                        "description with the reason, or supersede the decision."
                    ),
                }
            )
        if card["currency"] == "needs_review":
            result.warnings.append(
                f"{decision.decision_id} '{decision.title}' already needs review "
                f"({int((card.get('changed_fraction') or 0) * 100)}% of its files "
                "changed since it was settled)."
            )
    block = parse_decision_block(pr_body)
    for entry in block.entries:
        result.declared.append({"title": entry.title, "reason": entry.reason, "files": entry.files})
    for error in block.errors:
        result.warnings.append(f"decisions block: {error}")
    return result


def render_markdown(result: CheckResult) -> str:
    lines = ["<!-- whycode:pr-check -->", "### Why-Code decision check", ""]
    if not result.governing and not result.declared:
        lines.append("No recorded decision governs the files in this change.")
    if result.violations:
        lines.append("**Blocked:**")
        lines += [f"- {v['detail']}" for v in result.violations]
        lines.append("")
    if result.governing:
        lines.append("**Decisions in force over this change**")
        lines.append("")
        lines.append("| Decision | Files touched | State | Evidence |")
        lines.append("| --- | --- | --- | --- |")
        for card in result.governing:
            pin = " 📌" if card["pinned"] else ""
            ver = card["verification"]
            lines.append(
                f"| `{card['decision_id']}` {_cell(card['title'])}{pin} "
                f"| {', '.join(f'`{f}`' for f in card['touched_files'][:5])} "
                f"| {card['currency']} | {ver['verified']}/{ver['total']} verified |"
            )
        lines.append("")
        for card in result.governing[:5]:
            why = card["rationale"] or card["decision"]
            lines.append(
                f"<details><summary><code>{card['decision_id']}</code> — "
                f"{_cell(card['title'])}</summary>\n"
            )
            lines.append(f"{why}\n")
            for item in card["evidence"][:3]:
                where = (
                    item.get("path")
                    or (item.get("commit_sha") or "")[:12]
                    or (f"PR #{item['pr_number']}" if item.get("pr_number") else "")
                )
                lines.append(f"> {item['quote']}  \n> — `{where}` ({item['verification']})\n")
            lines.append("</details>\n")
    if result.declared:
        lines.append("**Decisions declared by this PR** (come into force when it merges)")
        lines += [
            f"- {d['title']} — _{d['reason']}_ ({', '.join(d['files'])})" for d in result.declared
        ]
        lines.append("")
    if result.warnings:
        lines.append("**Warnings**")
        lines += [f"- {w}" for w in result.warnings]
    return "\n".join(lines).rstrip() + "\n"


def _cell(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ")


__all__ = ["CheckResult", "check_change", "render_markdown"]
