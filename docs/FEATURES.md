# Why-Code platform features

Everything below is served by the backend (`backend/app/features/`) and
surfaced on the site's Decisions page. Read endpoints only use data the
retrieval layer has already materialized (fixture contexts or the live
service's cached decision threads) — none of them call an LLM, so they
stay fast.

## Decision records API

- `GET /api/v1/records?repo=&q=&status=&kind=&target=&date_from=&date_to=&limit=&offset=`
  Normalized decision records flattened from decision threads, with
  text search, filters and pagination (limit ≤ 100). Each record
  carries its targets, evidence ids (and evidence refs when the backend
  has them), and both supersession directions.
- `GET /api/v1/records/{decision_id}?repo=` — one record.
- `GET /api/v1/records/{decision_id}/export?repo=&format=md|json` —
  the record as an Architecture Decision Record (Markdown download)
  or JSON.
- The full schema is in the service's OpenAPI document (`/openapi.json`,
  interactive docs at `/docs`).

## Cross-repo search

- `GET /api/v1/search?q=&repo=` — with `repo` omitted, searches every
  repository the server holds data for and returns matches with their
  repo attached. The Decisions page explorer exposes this as
  "All indexed repos".

## Supersession dashboard

- `GET /api/v1/supersessions?repo=` — claim-vs-claim pairs: the earlier
  decision, the decision that superseded or reversed it, and the
  relation. The explorer's "Supersessions" view renders them side by
  side.

## Audit & compliance report

- `GET /api/v1/audit?repo=` — totals by status/kind, rationale and
  evidence coverage, and the compliance flags that matter:
  security/incident-relevant decisions (matched with the candidate
  detector's incident markers) that are missing a rationale, and
  decisions with no evidence at all.

## Keeping data fresh — refresh button (no setup)

End users never configure anything. The Repository card's
**Refresh data** button calls `POST /api/v1/repos/refresh?repo=<slug>`,
which invalidates the repo's cached decision threads so the next read
re-derives them from current GitHub data. The endpoint is rate-limited
to one refresh per minute per repository (429 + `Retry-After` beyond
that) so it cannot be used to force expensive re-derivation in a loop.
Manual refreshes are recorded as jobs and appear under Live updates.

## GitHub webhooks (incremental ingestion, optional, operator-only)

Webhooks are an optional automation for repository *owners* — the
people who run Why-Code for their own repos. End users of a hosted
Why-Code never see or configure them: only a repo admin can register
a webhook on GitHub, and the hosted product flow (paste a public repo
URL, ask questions) does not depend on webhooks at all.

- `POST /api/v1/webhooks/github` — HMAC-SHA256 verified receiver
  (`X-Hub-Signature-256`, constant-time compare; 401 on a bad
  signature, 503 until configured). Deliveries are deduplicated by
  `X-GitHub-Delivery` in a small SQLite store. A merged pull request
  records an `incremental_refresh` job and invalidates that repo's
  cached decision threads, so the next read re-derives decisions from
  fresh data.
- `GET /api/v1/webhooks/events` — recent deliveries and refresh jobs.
- Setup: set `WHYCODE_WEBHOOK_SECRET` to the webhook secret and
  optionally `WHYCODE_WEBHOOK_DB` (default `artifacts/webhooks.db`),
  then point the repo's GitHub webhook at
  `https://<your-host>/api/v1/webhooks/github` (content type JSON).

## Policy-as-code gates

- `backend/tools/policy_gate.py candidates.jsonl` — fails (exit 1)
  when an `INCIDENT_CANDIDATE` has no linked postmortem, or a
  `REVERSAL_CANDIDATE` carries no evidence. Logic lives in
  `app/features/policy.py` so it can be imported anywhere.

## Decision authoring assistant

- `backend/tools/suggest_decision.py` — scans a PR title/body with the
  detector's own markers and prints a ready-to-fill decision record
  when the PR carries a decision, constraint, reversal or incident.
- `.github/workflows/whycode-decisions.yml` runs it on every PR
  (posting/updating a suggestion comment) and runs the policy gate
  when a `candidates.jsonl` artifact is present.

## Golden-set regression runner

- `backend/tools/run_golden.py --predictions predictions.jsonl
  [--min-decision-recall 0.8]` — evaluates predictions against the
  golden corpus with the standard metrics (candidate recall, decision
  precision/recall, evidence precision/recall, supersession, refusal
  correctness) and can fail CI when a floor is breached.

## Multi-language candidate detection

The candidate detector's high-value path patterns now include language
packs for Go, Java, Rust and TypeScript (manifests like `go.mod`,
`pom.xml`, `Cargo.toml`, `package.json`, plus subsystem files like
`config.go`, `SecurityConfig.java`, `config.rs`, `middleware.ts`), on
top of the original Python set. `detect_language()` in
`app/intent/selection/candidate_detector.py` reports the language for
a path; the packs are additive, so existing pinned signal weights are
unchanged.
