"""Index a local git checkout into the ledger: mine, dedupe, verify, assess."""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

from app.ledger.git import Git, GitError
from app.ledger.miners import mine_adrs, mine_commits, mine_markers, reverted_shas
from app.ledger.models import Action, AuthorityEvent, SignerKind, Source, Status
from app.ledger.pr_miner import PullRequestSource, mine_pull_requests, pr_number
from app.ledger.store import LedgerError, LedgerStore
from app.ledger.verify import currency, verify_evidence


@dataclass
class IndexStats:
    repo: str
    head: str | None
    files: int = 0
    commits_scanned: int = 0
    mined: dict[str, int] = field(default_factory=dict)
    created: int = 0
    merged: int = 0
    tombstoned: int = 0
    reverted: int = 0
    verification: dict[str, int] = field(default_factory=dict)
    currency: dict[str, int] = field(default_factory=dict)
    seconds: float = 0.0
    prs_read: int = 0
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def index_repository(
    root: str | Path,
    store: LedgerStore,
    *,
    repo: str | None = None,
    commit_limit: int = 1000,
    sources: set[Source] | None = None,
    github_token: str | None = None,
    pr_limit: int = 500,
    pr_cache: str | Path | None = None,
) -> IndexStats:
    started = time.monotonic()
    root = Path(root).resolve()
    git = Git(root)
    if not git.is_repo():
        raise GitError(f"{root} is not a git work tree")
    slug = repo or git.remote_slug() or root.name
    enabled = sources or {Source.ADR, Source.INLINE_MARKER, Source.COMMIT}
    files = git.ls_files()
    tracked = set(files)
    stats = IndexStats(repo=slug, head=git.head(), files=len(files))

    mined = []
    if Source.ADR in enabled:
        adrs = mine_adrs(root, files, slug)
        for decision in adrs:
            # Measure an ADR's currency from the last commit that touched it.
            path = decision.evidence[0].path if decision.evidence else None
            if path:
                last = git.commits(limit=1, paths=[path])
                if last:
                    decision.anchor_commit = last[0].sha
                    decision.anchor_at = last[0].date
        mined += adrs
        stats.mined["adr"] = len(adrs)
    if Source.INLINE_MARKER in enabled:
        markers = mine_markers(root, files, slug)
        mined += markers
        stats.mined["inline_marker"] = len(markers)
    wants_prs = Source.PULL_REQUEST in enabled
    commits = (
        git.commits(limit=commit_limit) if (Source.COMMIT in enabled or wants_prs) else []
    )
    stats.commits_scanned = len(commits)
    if wants_prs:
        # Before the commit miner: when both describe the same change, the
        # PR's stated reason becomes the record's rationale.
        if not github_token:
            stats.mined["pull_request"] = 0
            stats.notes.append("pull requests skipped: no GitHub token")
        else:
            numbers = [n for n in (pr_number(c) for c in commits) if n is not None][:pr_limit]
            source = PullRequestSource(
                github_token, cache_path=Path(pr_cache) if pr_cache else None
            )
            fetched = source.fetch(slug, numbers)
            from_prs = mine_pull_requests(commits, fetched, slug, tracked)
            mined += from_prs
            stats.mined["pull_request"] = len(from_prs)
            stats.prs_read = len(fetched)
            stats.notes += source.errors[:5]
    if Source.COMMIT in enabled:
        from_commits = mine_commits(commits, slug, tracked)
        mined += from_commits
        stats.mined["commit"] = len(from_commits)

    for decision in mined:
        decision.evidence = [verify_evidence(e, root, git) for e in decision.evidence]
        outcome = store.upsert_mined(decision)
        setattr(stats, outcome, getattr(stats, outcome) + 1)

    # Lineage from commit reversals only — never inferred from text
    # similarity, which would invent relationships.
    for reverted, by in reverted_shas(commits).items():
        for decision in store.list_decisions(slug, statuses=[Status.PROPOSED, Status.ACCEPTED]):
            if any(e.commit_sha and e.commit_sha.startswith(reverted) for e in decision.evidence):
                try:
                    store.act(
                        decision.decision_id,
                        AuthorityEvent(
                            decision_id=decision.decision_id,
                            action=Action.SUPERSEDE,
                            reason=f"reverted by commit {by[:12]}",
                            signer="git-revert",
                            signer_kind=SignerKind.IMPORT,
                            evidence_ref=by,
                        ),
                    )
                    stats.reverted += 1
                except LedgerError:
                    pass  # pinned decisions are not retired automatically

    # Re-verify every stored evidence row and refresh cached currency, so
    # the hosted API can serve currency without a checkout.
    for decision in store.list_decisions(slug):
        for item in decision.evidence:
            checked = verify_evidence(item, root, git)
            if checked.verification != item.verification or checked.start_line != item.start_line:
                store.update_evidence_verification(decision.decision_id, checked)
            stats.verification[checked.verification.value] = (
                stats.verification.get(checked.verification.value, 0) + 1
            )
        report = currency(decision, git, tracked)
        store.set_currency(decision.decision_id, report.currency, report.changed_fraction)
        stats.currency[report.currency.value] = stats.currency.get(report.currency.value, 0) + 1

    stats.seconds = round(time.monotonic() - started, 2)
    store.upsert_repo(slug, root=str(root), head=stats.head, stats=stats.as_dict())
    return stats


__all__ = ["IndexStats", "index_repository"]
