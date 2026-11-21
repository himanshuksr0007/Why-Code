"""``get_why``: one entry point, three modes picked from the call shape.

* ``get_why(repo)`` — governance health: counts, stale and needs-review
  decisions, and busy files no decision governs.
* ``get_why(repo, targets=[path])`` — decisions in force over the path first,
  then at most two labelled background records; when nothing governs the
  path, the git history of the file (archaeology), never an invention.
* ``get_why(repo, query=...)`` — ranked decision search, optionally anchored
  to paths.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

from app.ledger.git import Git
from app.ledger.models import IN_FORCE, Currency, Decision, Status
from app.ledger.store import LedgerStore
from app.ledger.verify import currency

MAX_BACKGROUND = 2
_TOKEN = re.compile(r"[a-z0-9_]+")
_STOP = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "to",
    "in",
    "is",
    "are",
    "was",
    "why",
    "what",
    "how",
    "does",
    "do",
    "we",
    "this",
    "that",
    "it",
    "for",
    "on",
    "with",
    "by",
    "be",
    "use",
    "used",
    "using",
    "code",
    "our",
    "its",
    "there",
    "when",
    "which",
    "who",
}


class WhyEngine:
    def __init__(self, store: LedgerStore) -> None:
        self.store = store

    # ------------------------------------------------------------ helpers

    def _git(self, repo: str) -> tuple[Git | None, set[str] | None]:
        info = self.store.repo(repo)
        root = info.get("root") if info else None
        if root and Path(root).is_dir():
            git = Git(root)
            if git.is_repo():
                return git, set(git.ls_files())
        return None, None

    def _currency(
        self, decision: Decision, git: Git | None, tracked: set[str] | None
    ) -> dict[str, Any]:
        if git is not None:
            report = currency(decision, git, tracked)
            return report.model_dump()
        cached, fraction = self.store.cached_currency(decision.decision_id)
        fallback = currency(decision, None, None).currency.value
        return {"currency": cached or fallback, "changed_fraction": fraction}

    def card(
        self,
        decision: Decision,
        git: Git | None = None,
        tracked: set[str] | None = None,
        *,
        label: str | None = None,
    ) -> dict[str, Any]:
        cur = self._currency(decision, git, tracked)
        verified = sum(1 for e in decision.evidence if e.verification.value == "verified")
        return {
            "decision_id": decision.decision_id,
            "title": decision.title,
            "decision": decision.decision,
            "rationale": decision.rationale,
            "context": decision.context,
            "alternatives": decision.alternatives,
            "consequences": decision.consequences,
            "scope": decision.scope,
            "source": decision.source.value,
            "status": decision.status.value,
            "pinned": decision.pinned,
            "superseded_by": decision.superseded_by,
            "confidence": decision.confidence,
            "in_force": Currency(cur["currency"]) in IN_FORCE,
            "label": label
            or ("in force" if Currency(cur["currency"]) in IN_FORCE else cur["currency"]),
            **cur,
            "verification": {
                "verified": verified,
                "total": len(decision.evidence),
                "level": _level(decision),
            },
            "evidence": [e.model_dump() for e in decision.evidence],
        }

    # --------------------------------------------------------------- modes

    def get_why(
        self,
        repo: str,
        *,
        query: str | None = None,
        targets: list[str] | None = None,
        include_history: bool = False,
        limit: int = 8,
    ) -> dict[str, Any]:
        targets = [t.strip().lstrip("./") for t in (targets or []) if t.strip()]
        if not self.store.has_repo(repo) and not self.store.repo(repo):
            return {
                "mode": "not_indexed",
                "repo": repo,
                "message": f"{repo} has no decision ledger yet. Index it first: "
                "`python -m app.ledger index <path-to-checkout>`.",
                "decisions": [],
            }
        if query:
            return self.search(repo, query, targets=targets, limit=limit)
        if targets:
            return self.for_paths(repo, targets, include_history=include_history)
        return self.health(repo)

    def for_paths(
        self, repo: str, targets: list[str], *, include_history: bool = False
    ) -> dict[str, Any]:
        git, tracked = self._git(repo)
        decisions = self.store.list_decisions(repo)
        results: list[dict[str, Any]] = []
        for target in targets:
            governing = [d for d in decisions if _governs(d, target)]
            cards = [self.card(d, git, tracked) for d in governing]
            in_force = [c for c in cards if c["in_force"]]
            background = [c for c in cards if c["currency"] == Currency.BACKGROUND.value][
                :MAX_BACKGROUND
            ]
            for c in background:
                c["label"] = "background: mined, not confirmed by a person or agent"
            history = (
                [c for c in cards if c["currency"] in {"superseded", "dismissed", "stale"}]
                if include_history
                else []
            )
            entry: dict[str, Any] = {
                "target": target,
                "in_force": in_force,
                "background": background,
                "history": history,
            }
            if not in_force and not background:
                entry["archaeology"] = self._archaeology(git, target)
            results.append(entry)
        return {"mode": "path", "repo": repo, "targets": results}

    def search(
        self, repo: str, query: str, *, targets: list[str] | None = None, limit: int = 8
    ) -> dict[str, Any]:
        git, tracked = self._git(repo)
        decisions = [d for d in self.store.list_decisions(repo) if d.status is not Status.DISMISSED]
        ranked = rank(decisions, query, targets=targets or [])
        cards = []
        for score, decision in ranked[:limit]:
            card = self.card(decision, git, tracked)
            card["score"] = round(score, 3)
            cards.append(card)
        return {"mode": "search", "repo": repo, "query": query, "decisions": cards}

    def health(self, repo: str) -> dict[str, Any]:
        git, tracked = self._git(repo)
        decisions = self.store.list_decisions(repo)
        cards = [self.card(d, git, tracked) for d in decisions]
        counts = Counter(c["currency"] for c in cards)
        governed: set[str] = set()
        for c in cards:
            if c["in_force"]:
                governed.update(c["scope"])
        hotspots: list[dict[str, Any]] = []
        if git is not None:
            churn = git.churn(limit=300)
            for path, count in sorted(churn.items(), key=lambda kv: -kv[1]):
                if tracked is not None and path not in tracked:
                    continue
                if any(path == g or (g.endswith("/") and path.startswith(g)) for g in governed):
                    continue
                if re.search(r"(^|/)(tests?|docs?)/|\.(md|lock|json)$", path):
                    continue
                hotspots.append({"path": path, "commits": count})
                if len(hotspots) >= 10:
                    break
        weak = [c for c in cards if c["in_force"] and c["verification"]["level"] == "unverified"]
        return {
            "mode": "health",
            "repo": repo,
            "counts": dict(counts),
            "in_force": sum(1 for c in cards if c["in_force"]),
            "pinned": sum(1 for c in cards if c["pinned"]),
            "needs_review": [_brief(c) for c in cards if c["currency"] == "needs_review"],
            "stale": [_brief(c) for c in cards if c["currency"] == "stale"],
            "unverified_in_force": [_brief(c) for c in weak],
            "ungoverned_hotspots": hotspots,
            "recent_activity": self.store.recent_events(repo, limit=10),
        }

    def _archaeology(self, git: Git | None, target: str) -> dict[str, Any]:
        if git is None:
            return {"available": False, "reason": "no local checkout for this repository"}
        commits = git.commits(limit=5, paths=[target])
        return {
            "available": True,
            "note": "No recorded decision governs this path. Recent history, verbatim:",
            "commits": [
                {"sha": c.sha, "author": c.author, "date": c.date, "subject": c.subject}
                for c in commits
            ],
        }


# --------------------------------------------------------------- ranking


def _tokens(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in _STOP and len(t) > 1]


def _doc(decision: Decision) -> list[str]:
    parts = [decision.title] * 3 + [
        decision.decision,
        decision.rationale,
        decision.context,
        " ".join(decision.tags),
        " ".join(decision.alternatives),
        " ".join(s.replace("/", " ").replace(".", " ").replace("_", " ") for s in decision.scope),
    ]
    return _tokens(" ".join(parts))


def rank(
    decisions: list[Decision], query: str, *, targets: list[str]
) -> list[tuple[float, Decision]]:
    """BM25 over decision text, boosted by scope match, currency and pinning."""
    terms = _tokens(query)
    if not decisions or (not terms and not targets):
        return []
    docs = [_doc(d) for d in decisions]
    avg = sum(len(d) for d in docs) / max(len(docs), 1)
    df: Counter[str] = Counter()
    for d in docs:
        df.update(set(d))
    n = len(docs)
    k1, b = 1.4, 0.75
    out: list[tuple[float, Decision]] = []
    for decision, doc in zip(decisions, docs, strict=True):
        tf = Counter(doc)
        score = 0.0
        for term in terms:
            if term not in tf:
                continue
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            score += (
                idf * tf[term] * (k1 + 1) / (tf[term] + k1 * (1 - b + b * len(doc) / max(avg, 1)))
            )
        if targets and any(_governs(decision, t) for t in targets):
            score += 2.0
        if score <= 0:
            continue
        if decision.status is Status.ACCEPTED:
            score *= 1.3
        if decision.pinned:
            score *= 1.2
        if decision.status is Status.SUPERSEDED:
            score *= 0.6
        out.append((score, decision))
    out.sort(key=lambda pair: -pair[0])
    return out


def _governs(decision: Decision, path: str) -> bool:
    path = path.strip().lstrip("./")
    for scope in decision.scope:
        if path == scope or path.rstrip("/") == scope.rstrip("/"):
            return True
        if scope.endswith("/") and path.startswith(scope):
            return True
        if path.endswith("/") and scope.startswith(path):
            return True
    return False


def _level(decision: Decision) -> str:
    levels = {e.verification.value for e in decision.evidence}
    if "verified" in levels:
        return "verified"
    if "fuzzy" in levels:
        return "fuzzy"
    return "unverified"


def _brief(card: dict[str, Any]) -> dict[str, Any]:
    return {
        "decision_id": card["decision_id"],
        "title": card["title"],
        "scope": card["scope"],
        "currency": card["currency"],
        "changed_fraction": card.get("changed_fraction"),
    }


__all__ = ["WhyEngine", "rank"]
