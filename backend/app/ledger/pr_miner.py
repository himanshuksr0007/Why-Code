"""Mine decisions from merged pull requests.

Commit messages rarely carry the reason for a change; the pull request
does. On the encode/httpx golden set only 2 of 12 merge commits state any
reason, while the PR descriptions and reviews state most of them. This
miner reads, for every scanned commit that names its pull request:

- the PR description (written by the author),
- review bodies, review-thread comments and conversation comments,
- the bodies of issues the PR closes,

and keeps only sentences that state a reason. Each kept sentence is
stored verbatim as evidence with a link to where it was said.

Rules that keep precision up:

- template text, checklists, code blocks, images and quoted replies are
  removed before sentences are read;
- bot authors, dependency bumps and reverts are skipped;
- a change that only touches tests, docs or lock files is skipped;
- a mechanical change (move, rename, refactor, typo, lint …) needs a
  strong reason ("because", "so that", "to avoid", "rationale" …);
- the decision's id comes from the commit title, so the PR's evidence
  merges into the record the commit miner makes for the same change
  instead of creating a duplicate.

Fetching uses the GitHub GraphQL API, 20 pull requests per request, and
caches responses in a JSON file so re-indexing does not re-fetch.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

from app.ledger.git import Commit
from app.ledger.miners import _NOISE_SUBJECT, _NON_SCOPE
from app.ledger.models import (
    Decision,
    Evidence,
    Source,
    Status,
    Verification,
    first_sentence,
    utcnow,
)

logger = logging.getLogger("whycode.ledger.pr")

GRAPHQL_URL = "https://api.github.com/graphql"
BATCH_SIZE = 20
MAX_QUOTES = 3
# A sentence found in this many PR descriptions is template boilerplate.
BOILERPLATE_MIN_PRS = 3

# "Title (#123)" (squash merge) or "Merge pull request #123 from …".
_PR_REF = re.compile(r"\(#(\d+)\)\s*$|^Merge pull request #(\d+)\b")
_CONVENTIONAL = re.compile(r"^\w+(\([^)]*\))?!?:\s*")
_DOCS = re.compile(r"(^|/)docs?/|(^|/)\.github/|(^|/)README", re.IGNORECASE)
_MECHANICAL_TITLE = re.compile(
    r"^\W*(move|moved|rename|renamed|refactor|tidy|tidied|clean ?up|cleanup|lint|typo|"
    r"format|reformat|fix typo|bump|update (?:the )?docs?|docs?\b|minor|nit)",
    re.IGNORECASE,
)

_STRONG = (
    r"because|so that|in order to|to avoid|to prevent|otherwise|trade-?offs?|"
    r"(?:the )?(?:rationale|motivation|reasoning)\b|the reason (?:for|is|behind|being)"
)
_MEDIUM = (
    r"due to|since (?![0-9])\w|as per #\d+|based on (?:the |a )?\w|prompted by|"
    r"to (?:mimic|match|align|be consistent|stay consistent|keep|reduce|improve|ensure|"
    r"support|allow|enable|simplify)|"
    r"should (?:match|use|always|never|not|be|only)|(?:is|are) (?:needed|required) (?:to|for)|"
    r"needed (?:to|for)|for (?:more|better|faster|simpler|less|consistency|compatibility|"
    r"performance|security|correctness)|(?:non-)?breaking change|backwards?[- ]compatib|"
    r"compatib(?:le|ility) with|match(?:es)? up (?:to|with)|"
    r"(?:is|are) (?:overkill|unnecessary|redundant|deprecated|unsafe|insecure|slow|broken|"
    r"confusing|error-prone)|rather than|more (?:explicit|consistent|compact|permissive|robust)"
)
_STRONG_RE = re.compile(rf"\b(?:{_STRONG})", re.IGNORECASE)
_REASON_RE = re.compile(rf"\b(?:{_STRONG}|{_MEDIUM})", re.IGNORECASE)
_CHATTER = re.compile(
    r"^(thanks|thank you|lgtm|looks good|nice|great|lovely|cheers|ping|bump|any update|"
    r"i understand that this pr|i've added|i have added|i've updated|closes|fixes|resolves)\b",
    re.IGNORECASE,
)


# ------------------------------------------------------------------ text


def _strip_markup(text: str, *, keep_quotes: bool = False) -> str:
    text = re.sub(r"<!--.*?-->", " ", text or "", flags=re.DOTALL)
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = re.sub(r"<img[^>]*>|!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"~~.*?~~", " ", text, flags=re.DOTALL)  # retracted by the author
    text = re.sub(r"<[^>]+>", " ", text)
    kept: list[str] = []
    skipping = False
    for line in text.splitlines():
        stripped = line.strip()
        heading = re.match(r"^#{1,6}\s+(.*)", stripped)
        if heading:
            skipping = bool(re.search(r"checklist|template", heading.group(1), re.IGNORECASE))
            continue
        if skipping or (stripped.startswith(">") and not keep_quotes):
            continue
        line = re.sub(r"^\s*>+\s?", "", line)
        if re.match(r"^[-*]\s+\[[ xX]\]", stripped):
            continue
        kept.append(re.sub(r"^\s*(?:[-*+]|\d+[.)])\s+", "", line))
    return "\n".join(kept)


def sentences(text: str, *, keep_quotes: bool = False) -> list[str]:
    """Readable sentences from a GitHub markdown body, markup removed.

    Quoted lines (``>``) are dropped by default: in replies they quote
    someone else. A PR description quotes the issue it answers, so its
    quotes are kept (``keep_quotes``).
    """
    out: list[str] = []
    for block in re.split(r"\n\s*\n|\n(?=\S)", _strip_markup(text, keep_quotes=keep_quotes)):
        block = " ".join(block.split())
        for sentence in re.split(r"(?<=[.!?])\s+(?=[A-Z`*_(\"'])", block):
            sentence = sentence.strip(" -*_")
            if 25 <= len(sentence) <= 400:
                out.append(sentence)
    return out


def reason_sentences(
    text: str, *, strong_only: bool = False, keep_quotes: bool = False
) -> list[str]:
    pattern = _STRONG_RE if strong_only else _REASON_RE
    return [
        s
        for s in sentences(text, keep_quotes=keep_quotes)
        if pattern.search(s) and not _CHATTER.match(s) and not s.endswith("?")
    ]


# ------------------------------------------------------------------ fetch


def pr_number(commit: Commit) -> int | None:
    match = _PR_REF.search(commit.subject)
    if not match:
        return None
    return int(match.group(1) or match.group(2))


_FIELDS = """
number title body url merged
author { login }
comments(first: 30) { nodes { body url author { login } } }
reviews(first: 20) { nodes { body url author { login } } }
reviewThreads(first: 30) { nodes { comments(first: 10) { nodes { body url author { login } } } } }
closingIssuesReferences(first: 3) { nodes { number body url author { login } } }
"""


@dataclass
class PullRequestSource:
    """Fetches merged-PR text from GitHub with an on-disk cache."""

    token: str
    cache_path: Path | None = None
    timeout: float = 60.0
    workers: int = 4
    fetched: int = 0
    errors: list[str] = field(default_factory=list)

    def _load_cache(self) -> dict[str, Any]:
        if self.cache_path and self.cache_path.exists():
            try:
                loaded = json.loads(self.cache_path.read_text(encoding="utf-8"))
                return loaded if isinstance(loaded, dict) else {}
            except (OSError, ValueError):
                return {}
        return {}

    def _save_cache(self, cache: dict[str, Any]) -> None:
        if self.cache_path:
            try:
                self.cache_path.write_text(json.dumps(cache), encoding="utf-8")
            except OSError as exc:
                logger.warning("could not write PR cache %s: %s", self.cache_path, exc)

    def _query(
        self, client: httpx.Client, owner: str, name: str, numbers: list[int]
    ) -> dict[str, Any]:
        aliases = " ".join(f"p{n}: pullRequest(number: {n}) {{ {_FIELDS} }}" for n in numbers)
        query = f'query {{ repository(owner: "{owner}", name: "{name}") {{ {aliases} }} }}'
        resp = client.post(GRAPHQL_URL, json={"query": query})
        resp.raise_for_status()
        payload = resp.json()
        repo = (payload.get("data") or {}).get("repository") or {}
        return {k[1:]: v for k, v in repo.items() if v is not None}

    def fetch(self, slug: str, numbers: Iterable[int]) -> dict[int, dict[str, Any]]:
        if "/" not in slug:
            return {}
        numbers = list(numbers)
        owner, name = slug.split("/", 1)
        safe = re.compile(r"[A-Za-z0-9_.-]+")
        if not safe.fullmatch(owner) or not safe.fullmatch(name):
            return {}
        cache = self._load_cache()
        bucket: dict[str, Any] = cache.setdefault(slug, {})
        wanted = [n for n in dict.fromkeys(numbers) if str(n) not in bucket]
        batches = [wanted[i : i + BATCH_SIZE] for i in range(0, len(wanted), BATCH_SIZE)]
        if batches:
            headers = {"Authorization": f"Bearer {self.token}", "User-Agent": "whycode-ledger"}
            with httpx.Client(timeout=self.timeout, headers=headers) as client:

                def run(batch: list[int]) -> tuple[list[int], dict[str, Any] | None]:
                    try:
                        return batch, self._query(client, owner, name, batch)
                    except Exception as exc:  # noqa: BLE001 - mining degrades, never fails
                        self.errors.append(f"PRs {batch[0]}..{batch[-1]}: {exc}")
                        return batch, None

                with ThreadPoolExecutor(max_workers=self.workers) as pool:
                    for batch, result in pool.map(run, batches):
                        if result is None:
                            continue
                        for n in batch:
                            # Store misses too (a number that is an issue, not a PR).
                            bucket[str(n)] = result.get(str(n))
                        self.fetched += len(batch)
            self._save_cache(cache)
        return {int(k): v for k, v in bucket.items() if v and int(k) in set(numbers)}


# ------------------------------------------------------------------ mine


def _is_bot(login: str | None) -> bool:
    if not login:
        return False
    return login.endswith("[bot]") or login.lower() in {"dependabot", "renovate"}


def _passages(pr: dict[str, Any]) -> list[tuple[str, str, str | None, str | None]]:
    """``(kind, text, url, author)`` in priority order: description first."""
    author = (pr.get("author") or {}).get("login")
    out = [("description", pr.get("body") or "", pr.get("url"), author)]
    for issue in (pr.get("closingIssuesReferences") or {}).get("nodes") or []:
        out.append(("issue", issue.get("body") or "", issue.get("url"),
                    (issue.get("author") or {}).get("login")))
    for review in (pr.get("reviews") or {}).get("nodes") or []:
        out.append(("review", review.get("body") or "", review.get("url"),
                    (review.get("author") or {}).get("login")))
    for thread in (pr.get("reviewThreads") or {}).get("nodes") or []:
        for comment in (thread.get("comments") or {}).get("nodes") or []:
            out.append(("review", comment.get("body") or "", comment.get("url"),
                        (comment.get("author") or {}).get("login")))
    for comment in (pr.get("comments") or {}).get("nodes") or []:
        out.append(("comment", comment.get("body") or "", comment.get("url"),
                    (comment.get("author") or {}).get("login")))
    return [p for p in out if p[1].strip() and not _is_bot(p[3])]


def _squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def mine_pull_requests(
    commits: list[Commit],
    prs: dict[int, dict[str, Any]],
    repo: str,
    tracked: set[str],
) -> list[Decision]:
    decisions: list[Decision] = []
    seen: set[int] = set()
    counts: dict[str, int] = {}
    for pr in prs.values():
        for sentence in set(map(_squash, sentences(pr.get("body") or "", keep_quotes=True))):
            counts[sentence] = counts.get(sentence, 0) + 1
    boilerplate = {k for k, v in counts.items() if v >= BOILERPLATE_MIN_PRS}
    for commit in commits:
        number = pr_number(commit)
        if number is None or number in seen or number not in prs:
            continue
        seen.add(number)
        pr = prs[number]
        if not pr.get("merged"):
            continue
        if _NOISE_SUBJECT.search(commit.subject) or commit.subject.lower().startswith("revert"):
            continue
        if _is_bot((pr.get("author") or {}).get("login")):
            continue
        scope = [
            f for f in commit.files
            if f in tracked and not _NON_SCOPE.search(f) and not _DOCS.search(f)
        ][:10]
        if not scope:
            continue
        title_text = pr.get("title") or commit.subject
        strong_only = bool(_MECHANICAL_TITLE.search(title_text))

        quotes: list[tuple[str, str, str | None, str | None, str]] = []
        for kind, text, url, author in _passages(pr):
            for sentence in reason_sentences(
                text, strong_only=strong_only, keep_quotes=kind == "description"
            ):
                if _squash(sentence) in boilerplate:
                    continue
                if all(_squash(sentence) != _squash(q[1]) for q in quotes):
                    quotes.append((kind, sentence, url, author, text))
                if len(quotes) >= MAX_QUOTES:
                    break
            if len(quotes) >= MAX_QUOTES:
                break
        if not quotes:
            continue

        evidence = []
        for _kind, quote, url, author, raw in quotes:
            verified = quote in raw or _squash(quote) in _squash(
                _strip_markup(raw, keep_quotes=True)
            )
            evidence.append(
                Evidence(
                    kind="pull_request",
                    quote=quote,
                    pr_number=number,
                    url=url,
                    author=author,
                    created_at=commit.date,
                    verification=Verification.VERIFIED if verified else Verification.FUZZY,
                )
            )
        evidence.append(
            Evidence(
                kind="commit",
                quote=commit.subject.strip(),
                commit_sha=commit.sha,
                author=commit.author,
                created_at=commit.date,
            )
        )
        from_description = quotes[0][0] in ("description", "issue")
        decisions.append(
            Decision(
                repo=repo,
                # Same title rule as the commit miner, so both merge into one record.
                title=first_sentence(_CONVENTIONAL.sub("", commit.subject)),
                decision=first_sentence(title_text, limit=200),
                rationale=" ".join(q[1] for q in quotes)[:1000],
                scope=scope,
                tags=["pull_request"],
                source=Source.PULL_REQUEST,
                status=Status.PROPOSED,
                confidence=0.6 if from_description else 0.5,
                created_at=commit.date or utcnow(),
                anchor_at=commit.date or utcnow(),
                anchor_commit=commit.sha,
                evidence=evidence,
            ).ensure_id()
        )
    return decisions


__all__ = [
    "PullRequestSource",
    "mine_pull_requests",
    "pr_number",
    "reason_sentences",
    "sentences",
]
