"""Records of the decision ledger.

A *decision* is a choice someone stands behind, tied to the files it governs
(its scope) and to evidence rows that can be checked against the repository.
Authority over a decision is not a mutable flag: every grant or withdrawal is
an append-only :class:`AuthorityEvent`, so the history of who decided what,
and on what evidence, survives every later change.
"""

from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


def utcnow() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


class Source(StrEnum):
    ADR = "adr"
    INLINE_MARKER = "inline_marker"
    COMMIT = "commit"
    PR_BLOCK = "pr_block"
    PULL_REQUEST = "pull_request"  # reasons quoted from a merged PR's text
    MANUAL = "manual"
    AGENT = "agent"


class Status(StrEnum):
    PROPOSED = "proposed"  # mined background; not in force
    ACCEPTED = "accepted"  # in force
    SUPERSEDED = "superseded"
    DISMISSED = "dismissed"  # tombstone: never re-proposed by mining


class Currency(StrEnum):
    """Whether a decision still describes the code, derived from git."""

    ACTIVE = "active"
    NEEDS_REVIEW = "needs_review"
    UNCHECKABLE = "uncheckable"
    STALE = "stale"
    SUPERSEDED = "superseded"
    DISMISSED = "dismissed"
    BACKGROUND = "background"


IN_FORCE = {Currency.ACTIVE, Currency.NEEDS_REVIEW}


class Verification(StrEnum):
    VERIFIED = "verified"  # quote found verbatim at the cited location
    FUZZY = "fuzzy"  # quote found after normalisation, or elsewhere in the file
    UNVERIFIED = "unverified"  # could not be checked against the repository


class SignerKind(StrEnum):
    PERSON = "person"
    AGENT = "agent"
    IMPORT = "import"  # a committed ADR or manifest
    BOT = "bot"  # e.g. the merge of a pull request carrying a decisions block


class Action(StrEnum):
    RECORD = "record"
    ACCEPT = "accept"
    REAFFIRM = "reaffirm"
    PIN = "pin"
    UNPIN = "unpin"
    DISMISS = "dismiss"
    SUPERSEDE = "supersede"
    MERGE = "merge"


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Evidence(_Model):
    evidence_id: str = ""
    kind: str  # file_span | commit | pull_request | adr
    quote: str
    path: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    commit_sha: str | None = None
    pr_number: int | None = None
    url: str | None = None
    author: str | None = None
    created_at: str | None = None
    verification: Verification = Verification.UNVERIFIED

    def fingerprint(self) -> str:
        key = "|".join(
            str(part)
            for part in (
                self.kind,
                self.path,
                self.start_line,
                self.commit_sha,
                self.pr_number,
                _norm(self.quote)[:200],
            )
        )
        return "ev_" + hashlib.sha1(key.encode()).hexdigest()[:12]


class Decision(_Model):
    decision_id: str = ""
    repo: str
    title: str
    decision: str
    context: str = ""
    rationale: str = ""
    alternatives: list[str] = Field(default_factory=list)
    consequences: list[str] = Field(default_factory=list)
    scope: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    kind: str = "architectural"
    source: Source
    status: Status = Status.PROPOSED
    pinned: bool = False
    superseded_by: str | None = None
    confidence: float = 0.5
    created_at: str = Field(default_factory=utcnow)
    # Currency is measured from this moment: recording, accepting or
    # reaffirming moves it forward, which clears ``needs_review``.
    anchor_at: str = Field(default_factory=utcnow)
    anchor_commit: str | None = None
    evidence: list[Evidence] = Field(default_factory=list)

    def ensure_id(self) -> Decision:
        if not self.decision_id:
            self.decision_id = decision_id_for(self.repo, self.title)
        for item in self.evidence:
            if not item.evidence_id:
                item.evidence_id = item.fingerprint()
        return self


class AuthorityEvent(_Model):
    seq: int | None = None
    decision_id: str
    action: Action
    reason: str
    signer: str
    signer_kind: SignerKind
    scope: list[str] = Field(default_factory=list)
    evidence_ref: str | None = None
    at: str = Field(default_factory=utcnow)


class CurrencyReport(_Model):
    currency: Currency
    changed_fraction: float | None = None
    changed_files: list[str] = Field(default_factory=list)
    missing_files: list[str] = Field(default_factory=list)
    renamed: dict[str, str] = Field(default_factory=dict)


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", text.lower())).strip()


def normalize_title(title: str) -> str:
    return _norm(title)


def decision_id_for(repo: str, title: str) -> str:
    digest = hashlib.sha1(f"{repo}\n{normalize_title(title)}".encode()).hexdigest()
    return "dec_" + digest[:12]


def first_sentence(text: str, limit: int = 80) -> str:
    text = " ".join(text.split())
    # Do not end a sentence inside an abbreviation such as "e.g." or "i.e.".
    match = re.match(r"(.+?(?<!\be\.g)(?<!\bi\.e)(?<!\betc)(?<!\bvs)[.!?])(\s|$)", text)
    sentence = match.group(1) if match else text
    if len(sentence) > limit:
        cut = sentence[:limit].rsplit(" ", 1)[0]
        sentence = cut.rstrip(",;:") + "…"
    return sentence.rstrip(".")


__all__ = [
    "IN_FORCE",
    "Action",
    "AuthorityEvent",
    "Currency",
    "CurrencyReport",
    "Decision",
    "Evidence",
    "SignerKind",
    "Source",
    "Status",
    "Verification",
    "decision_id_for",
    "first_sentence",
    "normalize_title",
    "utcnow",
]
