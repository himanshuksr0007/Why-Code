# Why-Code platform features

## GitHub webhooks

Webhooks are an optional automation for repository *owners* — the
people who run Why-Code for their own repos. End users of a hosted
Why-Code never see or configure them: only a repo admin can register
a webhook on GitHub, and the hosted product flow (paste a public repo
URL, ask questions) does not depend on webhooks at all.

- `POST /api/v1/webhooks/github` — HMAC-SHA256 verified receiver
  (`X-Hub-Signature-256`, constant-time compare; 401 on a bad
  signature, 503 until configured). Deliveries are deduplicated by
  `X-GitHub-Delivery` in a small SQLite store.
- `GET /api/v1/webhooks/events` — recent deliveries and any historical refresh jobs.
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
