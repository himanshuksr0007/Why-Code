# The decision ledger

The ledger is Why-Code's system of record for *why the code is the way it is*.
It stores each decision with the files it governs, verbatim evidence that can be
checked against the repository, whether it still describes the code, and an
append-only record of who put it in force. A chat model can't be that, because
it is stateless, doesn't belong to you, and can't vouch for its own citations.

It is served four ways:

| Surface | For | Entry point |
| --- | --- | --- |
| HTTP API | the web app, dashboards | `GET /api/v1/ledger/why`, `/decisions`, `/check` |
| MCP server | coding agents (Claude Code, Cursor, Codex) | `python -m app.ledger mcp` |
| PR check | the merge path | `action.yml` (GitHub Action) / `python -m app.ledger check` |
| CLI | people | `python -m app.ledger …` |

Everything below runs with **no LLM key and no Neo4j**: mining, verification
and currency are deterministic, and storage is SQLite.

## Quick start

```bash
cd backend
python -m app.ledger index ../path/to/checkout          # mine, verify, assess
python -m app.ledger why src/payments/charge.py         # decisions over a path
python -m app.ledger why -q "why idempotency keys"      # ranked search
python -m app.ledger why                                # governance health
python -m app.ledger accept dec_1a2b --reason "still how we do it" --scope src/payments/
python -m app.ledger pin dec_1a2b --reason "money handling is law"
python -m app.ledger export --path ../path/to/checkout  # writes .whycode/decisions.yaml
```

`--db` (default `$WHYCODE_LEDGER_DB` or `artifacts/ledger.db`), `--repo` and
`--json` work before or after the subcommand.

## Where decisions come from

| Source | Reads | Starts as |
| --- | --- | --- |
| `adr` | Markdown in `adr/`, `docs/adr/`, `docs/decisions/`, `decisions/`, … (Nygard and MADR headings, YAML frontmatter; up to 60 files) | **In force** if its status is accepted *and* it names its scope (frontmatter `scope:`/`governs:`, a *Scope* section, or backticked paths in the decision); otherwise background |
| `inline_marker` | `WHY:`, `DECISION:`, `TRADEOFF:`, `ADR:`, `RATIONALE:`, `REJECTED:` in any comment syntax, uppercase only (like `TODO:`), with continuation lines | Background, scoped to the file |
| `commit` | Commit messages that state a choice (*switch to, migrate, replace … with, drop, deprecate, in favour of …*) **and** a reason (*because, so that, to avoid, instead of, …*) | Background, scoped to the non-test files it changed |
| `pr_block` | A decisions block in a PR description (below) | Proposed when the PR opens; **in force when it merges** |
| `pull_request` | With `index --pull-requests`: the description, reviews, review threads, comments and closed issues of each merged PR a scanned commit names (`Title (#123)` or `Merge pull request #123`). Only sentences that state a reason are kept, quoted verbatim with a link. Template boilerplate, checklists, code, struck-through text and bot PRs are ignored; test-, docs- and lock-only changes are skipped; a mechanical change (move, rename, refactor …) needs a strong reason. Needs `WHYCODE_GITHUB_TOKEN`, `GITHUB_TOKEN` or `GH_TOKEN`; responses are cached in `<db>.prs.json` | Background, scoped to the non-test, non-docs files it changed. Merges into the commit's record for the same change, and its stated reason replaces the commit body as the rationale |
| `manual` / `agent` | CLI, API, MCP `record_decision` | Proposed (an agent can't put its own decision in force) |

The same decision found by two sources becomes one record with two evidence
rows. A dismissed decision is a tombstone: re-indexing never brings it back.
A standard `This reverts commit <sha>` supersedes the decision mined from
that commit. Lineage is never inferred from text similarity.

### The PR decisions block

```markdown
<!-- whycode:decisions -->
- Retries live in the HTTP client, not in callers. Why: callers set different
  timeouts and three of them forgot to retry. Files: app/client.py, app/jobs/
<!-- /whycode:decisions -->
```

One bullet per decision (at most five). The first sentence is the title (under
80 characters), `Why:` runs 15–1,000 characters, `Files:` takes 1–10
repository-relative paths (a folder ends in `/`, no globs). With the webhook
configured (`WHYCODE_WEBHOOK_SECRET`), opening or editing the PR records the
entries as proposed, merging puts them in force signed by the merge, and
closing it unmerged drops them. The `repowise:decisions` marker is accepted
too.

## Evidence verification

Every evidence row is checked against the checkout on each index:

| Level | Meaning |
| --- | --- |
| `verified` | The quote is at the cited file lines, or in the cited commit's message |
| `fuzzy` | Found after whitespace and case normalisation, or elsewhere in the file (lines are updated) |
| `unverified` | Couldn't be checked (file gone, commit missing, PR-only evidence) |

## Currency: does it still hold?

Currency is worked out from git each time it's read (and cached at index time for hosts with no checkout):

| Currency | Meaning | In force? |
| --- | --- | --- |
| `active` | Still describes the code | Yes |
| `needs_review` | At least half of its files changed since it was recorded, accepted or reaffirmed | Yes |
| `uncheckable` | Names no files | No |
| `stale` | Every file it names is gone at HEAD (renames are followed) | No |
| `superseded` / `dismissed` | Replaced or withdrawn; kept for history | No |
| `background` | Mined, not yet confirmed by a person or agent | No (served only when asked, labelled) |

Running `reaffirm` (or `accept`) moves the starting point to that moment, so the decision goes back to `active`.

## Authority

Being in force is a **recorded event**, not just a flag. Every record, accept, reaffirm,
pin, unpin, dismiss, supersede and merge appends a row (reason, scope, evidence
reference, signer, signer kind) to `authority_log`. SQLite triggers reject any
`UPDATE` or `DELETE` on that table, so application code can't rewrite history
either.

- `accept` is refused without a reason, a scope and an evidence reference.
- A **pinned** decision can't be dismissed or superseded without `--force`,
  and only a person (not an agent or bot) may force it.

## The PR check

`python -m app.ledger check --base origin/main` (or the `check_change` MCP
tool, or `POST /api/v1/ledger/check`) lists the decisions in force over the
changed files, warns about the ones that already need review, validates the
decisions block, and **fails when a pinned decision's files change** unless the
description says `Decision-Ack: <decision id>`.

### GitHub Action

```yaml
on: pull_request
permissions: { contents: read, pull-requests: write }
jobs:
  decisions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: himanshuksr0007/why-code@main   # or ./ inside this repository
```

In CI the ledger is rebuilt from the checkout: ADRs, markers, commits and
the committed manifest `.whycode/decisions.yaml` (written by `export`). The
action posts one comment and keeps it updated, and fails the job on a
violation (`fail-on-violation: "false"` to only comment).

## MCP server (for coding agents)

```bash
claude mcp add whycode -- python -m app.ledger mcp --db /abs/path/ledger.db --repo owner/name
```

Run it from `backend/` (or set `PYTHONPATH` to it). Tools:

| Tool | Returns |
| --- | --- |
| `get_why(targets?, query?, include_history?)` | Health with no arguments; decisions in force over paths (then up to two labelled background records, then git history when nothing governs the path); or ranked search |
| `search_decisions(query)` | BM25 over title, decision, rationale and scope, boosted by scope, pinning and status |
| `check_change(changed_files, pr_body?)` | The PR check, before committing |
| `record_decision(decision, rationale, affects, agent, evidence_commit?)` | Stores a proposed decision signed by the agent |

## HTTP API

Reads are public: `GET /api/v1/ledger/repos`, `/why?repo=&query=&targets=`,
`/decisions?repo=&status=&currency=`, `/decisions/{id}` (includes the
authority log), `POST /check`. Writes (`POST /decisions`,
`POST /decisions/{id}/{accept|reaffirm|pin|unpin|dismiss|supersede}`) need
`Authorization: Bearer $WHYCODE_LEDGER_ADMIN_TOKEN`; with no token set,
writes return 503.

When a repository is indexed, `POST /ask` adds its matching decisions and
their evidence to the live answer's evidence pool, so answers cite recorded
decisions instead of generated ones.

## Measured on real repositories

Indexing on this container (shallow clones, `--commits 1000`):

| Repository | Files | Commits read | Mined | Evidence verified | Time |
| --- | ---: | ---: | --- | ---: | ---: |
| encode/httpx | 125 | 1,000 | 18 from commits | 18 / 18 | 0.24 s |
| npryce/adr-tools | 92 | 159 | 9 ADRs + 2 from commits | 11 / 11 | 0.09 s |
| repowise-dev/repowise | 8,299 | 300 | 89 from commits | 89 / 89 | 1.7 s |

### With `--pull-requests` (22 Nov 2026)

Full history, run against the 15-case golden set in
`backend/app/intent/evaluation/golden/decisions.jsonl` (12 decisions, 3
non-decisions):

| | Commits only | With PR text |
| --- | ---: | ---: |
| httpx golden decisions found | 2 / 12 | 11 / 12 (10 with the right reason, 1 partial) |
| httpx non-decisions left alone | 3 / 3 | 3 / 3 |
| httpx records that state the why (25 sampled) | 19% | 56% |
| FastAPI records that state the why (25 sampled) | 4% | 36% |
| httpx index time (1,270 PRs read) | 1.2 s | 31 s first run, 4.6 s cached |

The PR rules were written while looking at the httpx golden PRs, so httpx
is not a clean holdout; FastAPI is. The one golden miss (#3323) has no merge
commit on the default branch. Remaining noise is mostly bug-fix PRs that
explain a bug's cause.

The table above (commit mining only) is throughput and verification, **not** a precision benchmark.
A hand review of the 18 httpx commit decisions found roughly two-thirds to be
real design decisions. The rest are tooling or doc changes. They start as
*background*, so they reach agents only when asked and always carry that label.
A labelled precision/recall set is the next thing to build.

## Design credit

The ledger's design takes ideas from
[repowise](https://github.com/repowise-dev/repowise)'s decisions layer:
in-force versus background records, the authority log, currency and staleness,
`get_why` modes, inline markers and the PR decisions block. repowise is
AGPL-3.0. No repowise code was copied. This is an independent implementation
on top of Why-Code's evidence and refusal model.
