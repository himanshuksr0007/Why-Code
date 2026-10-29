# WhyCode backend

FastAPI + SQLite + Neo4j backend for **Why-Code**. It ingests a repository's GitHub history, builds an evidence graph, enriches it with structural data and extracts evidence-linked decisions.

The retrieval/answer service is a fixed pipeline over an injectable Neo4j backend with a read-only `Neo4jGraphBackend` adapter. The production app factory wires it to a live Neo4j + an OpenAI-compatible LLM from environment variables (the production deployment runs on Render). The same app also serves the product services: **auth** (accounts, email OTP, sessions), **shares** (public/private chat links), **models** (visitor custom models + token usage) and **features** (decision records, search, audit, webhooks). Each service stores to Neo4j when configured and degrades to a local SQLite file otherwise.

For the project overview, screenshots and feature list, see the [root README](../README.md).

## Component guides

| Component | Guide |
| --- | --- |
| Foundation (settings, errors, logging, domain) | this file |
| 1 · GitHub ingestion | [`app/ingestion/README.md`](app/ingestion/README.md) |
| 2 · Neo4j graph builder | [`app/graph/README.md`](app/graph/README.md) |
| 3 · Structural enricher | [`app/structural/README.md`](app/structural/README.md) |
| 4 · Decision extractor | [`app/intent/README.md`](app/intent/README.md) |
| 5 · Retrieval | [`app/retrieval/README.md`](app/retrieval/README.md) |
| Decision platform (records, search, audit, webhooks) | [`docs/FEATURES.md`](../docs/FEATURES.md) |
| Auth, shares, custom models | root [README](../README.md#configuration) (env) + package docstrings |

## Layout

```text
backend/
├── app/
│   ├── api/          # package reserved for API routers
│   ├── core/         # settings, error taxonomy, structured logging
│   ├── domain/       # evidence records, record types, stable evidence IDs
│   ├── graph/        # Component 2: records, mapping, regions, writer
│   ├── ingestion/    # Component 1: client, normalizer, store, scorer, exporter
│   ├── structural/   # Component 3: selection, content, tree-sitter, graph, validation
│   ├── intent/       # Component 4: selection, context, LLM, validation, graph, review, evaluation
│   ├── retrieval/    # Component 5: hybrid retrieval, fusion, synthesis, plan + structure, API
│   ├── models/       # visitor custom models (encrypted keys) + token usage
│   ├── auth/         # accounts, email OTP, JWT sessions (Neo4j or SQLite)
│   ├── shares/       # public/private chat share links (Neo4j or SQLite)
│   ├── features/     # decision records, cross-repo search, audit, GitHub webhooks
│   └── main.py       # FastAPI factories: create_app (live) + create_demo_app (fixtures)
├── tools/            # policy gate, PR decision assistant, golden-set runner
├── tests/            # contract tests grouped by area
├── pyproject.toml
└── README.md
```

## Foundation

- **Settings** — `app/core/config.py`. One immutable `Settings` object loaded from environment variables; secrets are `repr=False`.
- **Errors** — `app/core/errors.py`. `TransientUpstreamError`, `RateLimitError`, `InvalidRecordError`, `GraphWriteError`, `InsufficientEvidenceError`.
- **Logging** — `app/core/logging.py`. Structured JSON records with request/component/record context.
- **Domain records** — `app/domain/records.py`, `record_types.py`, `evidence_ids.py`. Content-addressed evidence records and the stable ID strategy shared by every component.
- **API** — `app/main.py` exposes `GET /health` plus the retrieval routes. `/health` deliberately does not touch Neo4j, so CI never depends on a paid database being awake.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
set -a; source .env; set +a
```

`.env` is not loaded automatically; the `source` line exports the variables for the current shell.

## Run

```bash
# API
PYTHONPATH=. uvicorn app.main:create_app --factory --reload

# Health check
curl http://localhost:8000/health
# {"service":"why-code","status":"ok","version":"0.0.1"}
```

Only `/health` is always live. The answer routes (`POST /ask`, also at `/api/v1/ask`, plus decision/evidence/entity-history lookups and `/feedback`) return `503` until a retrieval service is injected into `create_app`.

### Prepared judge demo

The Phase 10 demo runs the real retrieval pipeline against a deterministic
in-memory graph, so it needs no Neo4j or model credentials:

```bash
cd backend
PYTHONPATH=. .venv/bin/uvicorn app.main:create_demo_app --factory --reload

curl http://localhost:8000/demo/script
curl -X POST http://localhost:8000/demo/rehearse \
  -H 'content-type: application/json' -d '{}'
```

`create_demo_app()` mounts the normal product API (`/api/v1/ask`, decisions,
auth, shares, features) against the fixture service, so the frontend runs the
full product surface offline; it also keeps the fixed `/demo/script`,
`/demo/ask` and `/demo/rehearse` rehearsal endpoints (the five script
questions only, `400` otherwise; named checks plus a measured latency against
an 8,000 ms budget / 5,000 ms target). That latency is fixture-pipeline
latency, not a live Neo4j or model round trip; see
[`app/retrieval/README.md`](app/retrieval/README.md#prepared-judge-demo-phase-10).

CORS allows `http://localhost:3000` and `http://127.0.0.1:3000` for the demo
frontend.

## Pipeline

```bash
# 1. Ingest
PYTHONPATH=. python -m app.ingestion.cli ingest \
  --repo encode/httpx --since 2024-01-01 --limit 100 \
  --artifacts-dir ../artifacts

# 2. Structural enrichment + graph
PYTHONPATH=. python -m app.structural.cli build \
  --repo encode/httpx \
  --normalized ../artifacts/normalized.jsonl \
  --high-signal ../artifacts/high_signal_prs.jsonl \
  --artifacts-dir ../artifacts --remote --write

# 3. Decision extraction (dry run)
PYTHONPATH=. python -m app.intent.cli extract \
  --repo encode/httpx \
  --normalized ../artifacts/normalized.jsonl \
  --high-signal ../artifacts/high_signal_prs.jsonl \
  --structural-graph ../artifacts/structural/structural_graph.jsonl \
  --db ../artifacts/evidence.db \
  --artifacts-dir ../artifacts

# 4. Score the run against the hand-curated golden decisions (no LLM)
PYTHONPATH=. python -m app.intent.cli evaluate \
  --predictions ../artifacts/intent/intent_batch.json \
  --corpus all \
  --repo encode/httpx \
  --out ../artifacts/intent/evaluation_report.json
```

Every command is safe to rerun: ingestion is idempotent, structural extraction replays from the content manifest, and intent extraction is dry-run unless `--write` is passed. The evaluator reads a completed batch and never calls a model. The public golden corpus is curated but has not been executed here; see [`docs/GOLDEN_SET.md`](../docs/GOLDEN_SET.md).

## Tests and quality gates

```bash
PYTHONPATH=. python -m pytest --ignore=tests/structure
ruff check app tests
mypy app
```

Current state: **1,109 passed, 13 pre-existing failures in the live-mode contract tests, 12 skipped**.

- `tests/structure/` is a legacy parallel contract suite that conflicts with `tests/structural/` at collection. The canonical suite excludes it.
- The skipped tests are opt-in live integrations: Neo4j store tests (enable with `WHYCODE_TEST_NEO4J_URI` plus `_USER`, `_PASSWORD` and `_DATABASE`) and the live-LLM smoke test (`tests/intent/test_llm_live.py`, one tiny request with a throwaway ledger; enable with `WHYCODE_TEST_LLM=1` plus `WHYCODE_TEST_LLM_API_KEY`).
- The normal suite never calls a model: `StaticProvider` and a stub HTTP client cover the LLM path offline.

## LLM quota

Every provider call goes through `app/intent/llm/limits.py`, which enforces the published per-minute/per-day caps and persists usage per model per UTC day in `$WHYCODE_ARTIFACTS_DIR/intent/llm_budget.json`.

| Variable | Required | Default |
| --- | :---: | --- |
| `WHYCODE_LLM_RPM` | — | `30` |
| `WHYCODE_LLM_RPD` | — | `1000` |
| `WHYCODE_LLM_TPM` | — | `8000` |
| `WHYCODE_LLM_TPD` | — | `200000` |
| `WHYCODE_LLM_BUDGET_REQUESTS` | — | provider cap |
| `WHYCODE_LLM_BUDGET_TOKENS` | — | provider cap |
| `WHYCODE_LLM_BUDGET_FILE` | — | `<artifacts>/intent/llm_budget.json` |
| `WHYCODE_LLM_REASONING_EFFORT` | — | — (`low`/`medium`/`high`, gpt-oss only) |

With the shipped `.env` (100 requests / 50K tokens per day on Groq's 1K / 200K caps), repeated test runs cannot exhaust the key: the guard refuses with `QuotaExceededError` and tells you which variable or ledger to reset.

## Environment

| Variable | Required | Default |
| --- | :---: | --- |
| `WHYCODE_GITHUB_TOKEN` | ✅ | — |
| `WHYCODE_NEO4J_URI` | ✅ | — |
| `WHYCODE_NEO4J_USER` | ✅ | — |
| `WHYCODE_NEO4J_PASSWORD` | ✅ | — |
| `WHYCODE_NEO4J_DATABASE` | — | `neo4j` |
| `WHYCODE_LLM_API_KEY` | ✅ | — |
| `WHYCODE_LLM_MODEL` | — | `gpt-4o-mini` |
| `WHYCODE_LLM_BASE_URL` | — | `https://api.openai.com/v1` |
| `WHYCODE_LLM_TIMEOUT_SECONDS` | — | `60` |
| `WHYCODE_LLM_MAX_OUTPUT_TOKENS` | — | `2500` |
| `WHYCODE_ARTIFACTS_DIR` | — | `artifacts` |
| `WHYCODE_SECRET_KEY` | production | — (ephemeral; custom-model keys die on restart) |
| `WHYCODE_AUTH_SECRET` | production | — (sessions/OTPs die on restart) |
| `WHYCODE_BREVO_API_KEY` | — | — (OTP mail over HTTPS; beats blocked SMTP) |
| `WHYCODE_GMAIL_ADDRESS` / `WHYCODE_GMAIL_APP_PASSWORD` | — | — (SMTP fallback for OTP mail) |
| `WHYCODE_AUTH_DB` / `WHYCODE_SHARE_DB` | — | `artifacts/auth.db` |
| `WHYCODE_WEBHOOK_SECRET` | — | — (webhook receiver is 503 until set) |
| `WHYCODE_TEST_NEO4J_URI` | — | — |
| `WHYCODE_TEST_LLM` | — | — |

The full configuration reference — including LLM caps and mail options — is the
[Configuration table in the root README](../README.md#configuration).

## Product decisions

Every non-obvious choice is dated and contradictable in [`docs/DECISIONS.md`](../docs/DECISIONS.md). Validation evidence lives in [`docs/INGESTION_REPORT.md`](../docs/INGESTION_REPORT.md) and [`docs/VALIDATION_REPORT_PHASE10.md`](../docs/VALIDATION_REPORT_PHASE10.md).
