"""Deterministic decision miners. None of them calls a model.

* :func:`mine_adrs` — ADR files (Nygard and MADR layouts, YAML frontmatter).
* :func:`mine_markers` — ``WHY:``/``DECISION:``/``TRADEOFF:``/``ADR:``/
  ``RATIONALE:``/``REJECTED:`` comments, uppercase only (like ``TODO:``).
* :func:`mine_commits` — commit messages that state a choice *and* a reason.
* :func:`parse_decision_block` — the ``<!-- whycode:decisions -->`` block an
  author or agent writes into a pull-request description.

Every mined decision carries at least one evidence row that points at the
exact place it came from, so it can be verified later.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from app.ledger.git import Commit
from app.ledger.models import Decision, Evidence, Source, Status, first_sentence, utcnow

ADR_DIRS = (
    "adr",
    "adrs",
    "docs/adr",
    "docs/adrs",
    "docs/decisions",
    "decisions",
    "architecture/decisions",
    "doc/adr",
    "doc/decisions",
)
MAX_ADR_FILES = 60
MAX_MARKER_FILE_BYTES = 512_000
SKIP_DIRS = (
    "node_modules/",
    "vendor/",
    "dist/",
    "build/",
    ".venv/",
    "venv/",
    "__pycache__/",
    "third_party/",
    ".next/",
)
TEXT_SUFFIXES = {
    ".py",
    ".pyi",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".go",
    ".rs",
    ".java",
    ".kt",
    ".kts",
    ".scala",
    ".rb",
    ".php",
    ".cs",
    ".c",
    ".h",
    ".cc",
    ".cpp",
    ".hpp",
    ".swift",
    ".m",
    ".sql",
    ".sh",
    ".bash",
    ".zsh",
    ".ps1",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".tf",
    ".hcl",
    ".lua",
    ".ex",
    ".exs",
    ".erl",
    ".hs",
    ".clj",
    ".dart",
    ".vue",
    ".svelte",
    ".css",
    ".scss",
    ".html",
    ".xml",
    ".proto",
    ".graphql",
    ".r",
    ".jl",
    ".zig",
    ".nim",
}
TEXT_NAMES = {"Dockerfile", "Makefile", "Justfile", "Procfile"}

# ---------------------------------------------------------------- ADRs


def _is_adr_path(path: str) -> bool:
    lower = path.lower()
    if not lower.endswith((".md", ".markdown", ".rst")):
        return False
    parent = lower.rsplit("/", 1)[0] if "/" in lower else ""
    return any(parent == d or parent.endswith("/" + d) for d in ADR_DIRS)


_HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
_ADR_PREFIX = re.compile(r"^(?:adr[-\s_]*)?\d+[\s.:_-]*", re.IGNORECASE)
_BACKTICK_PATH = re.compile(r"`([A-Za-z0-9_.\-/]+(?:/|\.[A-Za-z0-9]+))`")


def _split_frontmatter(text: str) -> tuple[dict[str, object], str, int]:
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            try:
                data = yaml.safe_load(text[4:end]) or {}
            except yaml.YAMLError:
                data = {}
            body_start = text.find("\n", end + 4) + 1
            offset = text[:body_start].count("\n")
            if isinstance(data, dict):
                return data, text[body_start:], offset
    return {}, text, 0


def _sections(body: str, offset: int) -> tuple[str, dict[str, tuple[str, int, int]]]:
    """Title plus ``{heading: (text, start_line, end_line)}`` (1-based)."""
    title = ""
    sections: dict[str, tuple[str, int, int]] = {}
    current: str | None = None
    buf: list[str] = []
    start = 0
    lines = body.splitlines()

    def flush(end: int) -> None:
        if current is not None:
            sections[current] = ("\n".join(buf).strip(), start, end)

    for index, line in enumerate(lines, start=1 + offset):
        match = _HEADING.match(line)
        if match:
            level, text = len(match.group(1)), match.group(2).strip()
            if level == 1 and not title:
                title = text
                continue
            flush(index - 1)
            current, buf, start = text.lower().rstrip(":"), [], index + 1
            continue
        if current is not None:
            buf.append(line)
    flush(len(lines) + offset)
    return title, sections


def _pick(sections: dict[str, tuple[str, int, int]], *names: str) -> tuple[str, int, int] | None:
    for key, value in sections.items():
        if any(key == n or key.startswith(n) for n in names):
            return value
    return None


def _bullets(text: str) -> list[str]:
    items = [
        re.sub(r"^\s*(?:[-*+]|\d+[.)])\s+", "", line).strip()
        for line in text.splitlines()
        if re.match(r"^\s*(?:[-*+]|\d+[.)])\s+", line)
    ]
    return [i for i in items if i]


def _first_paragraph(text: str) -> str:
    for para in re.split(r"\n\s*\n", text.strip()):
        para = para.strip()
        if para:
            return " ".join(para.split())
    return ""


def mine_adrs(root: Path, files: list[str], repo: str) -> list[Decision]:
    decisions: list[Decision] = []
    tracked = set(files)
    for path in sorted(p for p in files if _is_adr_path(p))[:MAX_ADR_FILES]:
        try:
            text = (root / path).read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        front, body, offset = _split_frontmatter(text)
        title, sections = _sections(body, offset)
        title = str(front.get("title") or title or Path(path).stem.replace("-", " "))
        title = _ADR_PREFIX.sub("", title).strip() or title
        if title.lower() in {"template", "adr template", "readme", "index"}:
            continue
        status_text = str(front.get("status") or "")
        status_section = _pick(sections, "status")
        if not status_text and status_section:
            status_text = _first_paragraph(status_section[0])
        status_word = status_text.lower()
        decision_section = _pick(sections, "decision outcome", "decision")
        if decision_section is None or not decision_section[0]:
            continue
        decision_text = _first_paragraph(decision_section[0])
        context = _pick(sections, "context and problem statement", "context")
        consequences = _pick(sections, "consequences")
        options = _pick(sections, "considered options", "alternatives", "options considered")
        rationale = _pick(sections, "rationale", "decision drivers")
        scope = _scope_from(front, sections, tracked)
        if "superseded" in status_word or "deprecated" in status_word:
            status = Status.SUPERSEDED
        elif any(w in status_word for w in ("rejected", "withdrawn")):
            status = Status.DISMISSED
        elif any(w in status_word for w in ("accepted", "approved", "adopted")) and scope:
            # A committed, accepted ADR that names what it governs is in
            # force on its own; the file itself is the signer.
            status = Status.ACCEPTED
        else:
            status = Status.PROPOSED
        quote = decision_section[0].strip().splitlines()[0].strip()
        decisions.append(
            Decision(
                repo=repo,
                title=first_sentence(title, 100),
                decision=decision_text,
                context=_first_paragraph(context[0]) if context else "",
                rationale=_first_paragraph(rationale[0]) if rationale else "",
                alternatives=_bullets(options[0]) if options else [],
                consequences=_bullets(consequences[0]) if consequences else [],
                scope=scope,
                tags=["adr"],
                source=Source.ADR,
                status=status,
                confidence=0.9 if status is Status.ACCEPTED else 0.7,
                evidence=[
                    Evidence(
                        kind="adr",
                        quote=quote,
                        path=path,
                        start_line=decision_section[1],
                        end_line=decision_section[2],
                    )
                ],
            ).ensure_id()
        )
    return decisions


def _scope_from(
    front: dict[str, object],
    sections: dict[str, tuple[str, int, int]],
    tracked: set[str],
) -> list[str]:
    scope: list[str] = []
    for key in ("scope", "governs", "affects", "files"):
        value = front.get(key)
        if isinstance(value, str):
            scope.extend(v.strip() for v in value.split(","))
        elif isinstance(value, list):
            scope.extend(str(v).strip() for v in value)
    section = _pick(sections, "scope", "affects", "governs", "affected files")
    if section:
        scope.extend(_BACKTICK_PATH.findall(section[0]))
        scope.extend(i.strip("` ") for i in _bullets(section[0]))
    if not scope:
        decision = _pick(sections, "decision outcome", "decision")
        if decision:
            scope.extend(_BACKTICK_PATH.findall(decision[0]))
    return _valid_scope(scope, tracked)


def _valid_scope(paths: list[str], tracked: set[str]) -> list[str]:
    """Keep repo-relative paths that exist (a folder ends with ``/``)."""
    out: list[str] = []
    for raw in paths:
        path = raw.strip().lstrip("./")
        if not path or path.startswith("/") or "*" in path or ".." in path:
            continue
        exists = path in tracked or any(t.startswith(path.rstrip("/") + "/") for t in tracked)
        if not exists:
            continue
        if path not in tracked and not path.endswith("/"):
            path += "/"
        if path not in out:
            out.append(path)
    return out[:10]


# ---------------------------------------------------------- inline markers

MARKER_WORDS = ("WHY", "DECISION", "TRADEOFF", "ADR", "RATIONALE", "REJECTED")
_COMMENT = r"(?:#+|//+|/\*+|\*|--|;+|<!--|%|\"\"\"|''')"
_MARKER = re.compile(
    rf"^\s*{_COMMENT}\s*(?P<kind>{'|'.join(MARKER_WORDS)}):\s*(?P<text>.+?)\s*(?:\*/|-->)?\s*$"
)
_CONTINUATION = re.compile(rf"^\s*{_COMMENT}\s?(?P<text>.*?)\s*(?:\*/|-->)?\s*$")


def _is_text(path: str) -> bool:
    if any(seg in path for seg in SKIP_DIRS):
        return False
    name = path.rsplit("/", 1)[-1]
    return name in TEXT_NAMES or Path(name).suffix.lower() in TEXT_SUFFIXES


def mine_markers(root: Path, files: list[str], repo: str) -> list[Decision]:
    decisions: list[Decision] = []
    for path in files:
        if not _is_text(path):
            continue
        full = root / path
        try:
            if full.stat().st_size > MAX_MARKER_FILE_BYTES:
                continue
            lines = full.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        index = 0
        while index < len(lines):
            match = _MARKER.match(lines[index])
            if not match:
                index += 1
                continue
            kind = match.group("kind")
            parts = [match.group("text")]
            end = index
            # Continuation: following comment lines that are not themselves
            # markers and are not blank comment lines.
            while end + 1 < len(lines):
                nxt = lines[end + 1]
                if _MARKER.match(nxt):
                    break
                cont = _CONTINUATION.match(nxt)
                if not cont or not cont.group("text").strip():
                    break
                parts.append(cont.group("text").strip())
                end += 1
            text = " ".join(p.strip() for p in parts if p.strip())
            if len(text) >= 12:
                decisions.append(
                    _marker_decision(repo, path, kind, text, index + 1, end + 1, lines[index])
                )
            index = end + 1
    return decisions


def _marker_decision(
    repo: str, path: str, kind: str, text: str, start: int, end: int, first_line: str
) -> Decision:
    quote = _MARKER.match(first_line).group("text")  # type: ignore[union-attr]
    title = first_sentence(text)
    rationale = text if kind in {"WHY", "RATIONALE", "TRADEOFF"} else ""
    alternatives = [text] if kind == "REJECTED" else []
    if kind == "REJECTED":
        title = "Rejected: " + title
    return Decision(
        repo=repo,
        title=f"{title} ({path.rsplit('/', 1)[-1]})",
        decision=text,
        rationale=rationale,
        alternatives=alternatives,
        scope=[path],
        tags=["marker", kind.lower()],
        source=Source.INLINE_MARKER,
        status=Status.PROPOSED,
        confidence=0.75,
        evidence=[
            Evidence(kind="file_span", quote=quote, path=path, start_line=start, end_line=end)
        ],
    ).ensure_id()


# ------------------------------------------------------------------ commits

_DECISION_VERB = re.compile(
    r"\b(migrat(?:e|ed|ing)\s+(?:to|from|off)|switch(?:ed|es)?\s+(?:to|from)|"
    r"replac(?:e|ed|es|ing)\b.{0,60}\bwith|adopt(?:ed|s)?|deprecat(?:e|ed|es)|"
    r"drop(?:ped|s)?\s+(?:support|the|use)|remov(?:e|ed|es)\s+support|"
    r"mov(?:e|ed|es)\s+\S+\s+to|introduc(?:e|ed|es)|disabl(?:e|ed|es)\b.{0,40}\bby default|"
    r"enabl(?:e|ed|es)\b.{0,40}\bby default|default(?:s)?\s+to|stop(?:ped|s)?\s+using|"
    r"no longer|in favou?r of|instead of|rewr(?:ite|ote))",
    re.IGNORECASE,
)
_REASON = re.compile(
    r"\b(because|since\s+\w|so that|in order to|to avoid|to prevent|to reduce|to keep|"
    r"due to|as it|which (?:caused|led|made)|otherwise|the reason|motivation|rationale|why:|"
    r"instead of|in favou?r of|trade-?off|was (?:slow|flaky|unsafe|broken)|,\s*so\s|"
    r"\b(?:were|was|got)\s+(?:lost|dropped|duplicated|corrupted|leaking)|\bbroke\b|\bfail(?:ed|s|ing)\b)",
    re.IGNORECASE,
)
_NOISE_SUBJECT = re.compile(
    r"^(merge (?:pull request|branch|remote)|bump |chore\(deps|build\(deps|update dependency|"
    r"\[bot\]|release |version |v?\d+\.\d+)",
    re.IGNORECASE,
)
_REVERT = re.compile(r"This reverts commit ([0-9a-f]{7,40})", re.IGNORECASE)
_NON_SCOPE = re.compile(
    r"(^|/)(tests?|__tests__|spec)/|(^|/)test_|_test\.|\.lock$|lock\.json$|"
    r"(^|/)CHANGELOG|\.md$|\.snap$",
    re.IGNORECASE,
)


def mine_commits(commits: list[Commit], repo: str, tracked: set[str]) -> list[Decision]:
    decisions: list[Decision] = []
    for commit in commits:
        if _NOISE_SUBJECT.search(commit.subject) or commit.subject.lower().startswith("revert"):
            continue
        message = commit.message
        if not _DECISION_VERB.search(message) or not _REASON.search(message):
            continue
        scope = [f for f in commit.files if not _NON_SCOPE.search(f) and f in tracked][:10]
        if not scope:
            continue
        # Squash-merge bodies are bullet lists; keep the items, drop the markers.
        items = [
            re.sub(r"^\s*[-*+]\s+", "", line).strip()
            for line in commit.body.splitlines()
            if line.strip() and not line.lower().startswith(("co-authored-by:", "signed-off-by:"))
        ]
        body = "; ".join(dict.fromkeys(i for i in items if i))
        decisions.append(
            Decision(
                repo=repo,
                title=first_sentence(re.sub(r"^\w+(\([^)]*\))?!?:\s*", "", commit.subject)),
                decision=commit.subject.strip(),
                rationale=body[:1000],
                scope=scope,
                tags=["commit"],
                source=Source.COMMIT,
                status=Status.PROPOSED,
                confidence=0.55 if len(body) >= 40 else 0.4,
                created_at=commit.date or utcnow(),
                anchor_at=commit.date or utcnow(),
                anchor_commit=commit.sha,
                evidence=[
                    Evidence(
                        kind="commit",
                        quote=commit.subject.strip(),
                        commit_sha=commit.sha,
                        author=commit.author,
                        created_at=commit.date,
                    )
                ],
            ).ensure_id()
        )
    return decisions


def reverted_shas(commits: list[Commit]) -> dict[str, str]:
    """``{reverted_sha: reverting_sha}`` from standard revert messages."""
    out: dict[str, str] = {}
    for commit in commits:
        for sha in _REVERT.findall(commit.body):
            out[sha] = commit.sha
    return out


# ----------------------------------------------------- PR decisions block

_BLOCK = re.compile(
    r"<!--\s*(?:whycode|repowise):decisions\s*-->(?P<body>.*?)<!--\s*/(?:whycode|repowise):decisions\s*-->",
    re.DOTALL | re.IGNORECASE,
)
MAX_BLOCK_ENTRIES = 5


@dataclass
class BlockEntry:
    title: str
    decision: str
    reason: str
    files: list[str]


@dataclass
class BlockResult:
    entries: list[BlockEntry]
    errors: list[str]


def parse_decision_block(text: str | None) -> BlockResult:
    """Parse the first decisions block of a PR description.

    Format, one bullet per decision::

        <!-- whycode:decisions -->
        - Retries live in the HTTP client. Why: callers forgot to retry.
          Files: app/client.py, app/jobs/
        <!-- /whycode:decisions -->
    """
    if not text:
        return BlockResult([], [])
    match = _BLOCK.search(text)
    if not match:
        return BlockResult([], [])
    raw_entries: list[str] = []
    for line in match.group("body").splitlines():
        if re.match(r"^\s*[-*]\s+", line):
            raw_entries.append(re.sub(r"^\s*[-*]\s+", "", line).strip())
        elif line.strip() and raw_entries and line.startswith((" ", "\t")):
            raw_entries[-1] += " " + line.strip()
    entries: list[BlockEntry] = []
    errors: list[str] = []
    for number, raw in enumerate(raw_entries, start=1):
        if number > MAX_BLOCK_ENTRIES:
            errors.append(f"entry {number}: at most {MAX_BLOCK_ENTRIES} decisions per pull request")
            break
        files_part = ""
        files_match = re.search(r"\bFiles:\s*(.+)$", raw, re.IGNORECASE)
        if files_match:
            files_part = files_match.group(1)
            raw = raw[: files_match.start()].strip()
        why_match = re.search(r"\bWhy:\s*(.+)$", raw, re.IGNORECASE)
        reason = why_match.group(1).strip() if why_match else ""
        decision = raw[: why_match.start()].strip() if why_match else raw.strip()
        files = [f.strip().strip("`") for f in files_part.split(",") if f.strip()]
        title = first_sentence(decision)
        problems: list[str] = []
        if not decision:
            problems.append("no decision text")
        if len(title) > 80:
            problems.append("title over 80 characters")
        if not 15 <= len(reason) <= 1000:
            problems.append("Why: must be 15-1000 characters")
        if not 1 <= len(files) <= 10:
            problems.append("Files: needs 1-10 paths")
        bad = [f for f in files if f.startswith("/") or "*" in f or ".." in f]
        if bad:
            problems.append("Files: no globs, absolute or parent paths (" + ", ".join(bad) + ")")
        if problems:
            errors.append(f"entry {number}: " + "; ".join(problems))
            continue
        entries.append(BlockEntry(title=title, decision=decision, reason=reason, files=files))
    return BlockResult(entries, errors)


def block_decisions(
    result: BlockResult,
    *,
    repo: str,
    pr_number: int | None,
    author: str | None,
    accepted: bool,
    url: str | None = None,
) -> list[Decision]:
    decisions: list[Decision] = []
    for entry in result.entries:
        decisions.append(
            Decision(
                repo=repo,
                title=entry.title,
                decision=entry.decision,
                rationale=entry.reason,
                scope=entry.files,
                tags=["pull_request"],
                source=Source.PR_BLOCK,
                status=Status.ACCEPTED if accepted else Status.PROPOSED,
                confidence=0.85,
                evidence=[
                    Evidence(
                        kind="pull_request",
                        quote=entry.decision,
                        pr_number=pr_number,
                        url=url,
                        author=author,
                    )
                ],
            ).ensure_id()
        )
    return decisions


__all__ = [
    "ADR_DIRS",
    "MARKER_WORDS",
    "BlockEntry",
    "BlockResult",
    "block_decisions",
    "mine_adrs",
    "mine_commits",
    "mine_markers",
    "parse_decision_block",
    "reverted_shas",
]
