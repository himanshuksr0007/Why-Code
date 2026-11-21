/**
 * Offline fixture for `NEXT_PUBLIC_API_MODE=mock` only. Titles follow real
 * httpx commit subjects, but SHAs, the ADR and the authority log are
 * illustrative — never served when the app talks to a backend.
 */

import type { LedgerDecision, LedgerHealth } from "./types";

function ev(
  quote: string,
  extra: Partial<LedgerDecision["evidence"][number]>,
): LedgerDecision["evidence"][number] {
  return {
    evidence_id: `ev_${quote.length.toString(16)}${(extra.commit_sha ?? extra.path ?? "").slice(0, 6)}`,
    kind: extra.commit_sha ? "commit" : "file_span",
    quote,
    path: null,
    start_line: null,
    end_line: null,
    commit_sha: null,
    pr_number: null,
    url: null,
    author: null,
    created_at: null,
    verification: "verified",
    ...extra,
  };
}

export const MOCK_DECISIONS: LedgerDecision[] = [
  {
    decision_id: "dec_7c1a0e5b92d4",
    title: "Retries are off by default; opt in per transport",
    decision:
      "Clients do not retry by default. Connection retries are configured on the transport with `retries=`.",
    rationale:
      "Automatic retries can duplicate non-idempotent requests. Retrying only connection failures, and only when asked, keeps the default safe.",
    context: "",
    alternatives: ["Retry all idempotent methods by default"],
    consequences: ["Callers that want retries pass `HTTPTransport(retries=N)`."],
    scope: ["httpx/_transports/default.py"],
    source: "adr",
    status: "accepted",
    pinned: true,
    superseded_by: null,
    confidence: 0.9,
    in_force: true,
    label: "in force",
    currency: "active",
    changed_fraction: 0,
    verification: { verified: 1, total: 1, level: "verified" },
    evidence: [
      ev("Clients do not retry by default.", {
        kind: "adr",
        path: "docs/adr/0002-retries.md",
        start_line: 12,
        end_line: 14,
      }),
    ],
    authority_log: [
      {
        seq: 1,
        decision_id: "dec_7c1a0e5b92d4",
        action: "accept",
        reason: "committed adr marks it accepted",
        signer: "docs/adr/0002-retries.md",
        signer_kind: "import",
        scope: ["httpx/_transports/default.py"],
        evidence_ref: "ev_adr",
        at: "2025-02-10T09:12:00+00:00",
      },
      {
        seq: 2,
        decision_id: "dec_7c1a0e5b92d4",
        action: "pin",
        reason: "duplicate POSTs are an incident class",
        signer: "maintainer",
        signer_kind: "person",
        scope: ["httpx/_transports/default.py"],
        evidence_ref: null,
        at: "2025-03-01T14:30:00+00:00",
      },
    ],
  },
  {
    decision_id: "dec_c68bcce97e00",
    title: "Drop chardet (#1269)",
    decision: "Drop chardet (#1269)",
    rationale:
      "Drop chardet in favour of simpler charset autodetection; fewer dependencies and predictable decoding.",
    context: "",
    alternatives: [],
    consequences: [],
    scope: ["httpx/_models.py", "setup.py"],
    source: "commit",
    status: "proposed",
    pinned: false,
    superseded_by: null,
    confidence: 0.55,
    in_force: false,
    label: "background",
    currency: "background",
    changed_fraction: null,
    verification: { verified: 1, total: 1, level: "verified" },
    evidence: [
      ev("Drop chardet (#1269)", {
        commit_sha: "d0fe1139458f2a0a4c9f9a8d2b8a6f0f7a1c2e3d",
        author: "Tom Christie",
        created_at: "2020-09-12T10:01:00+01:00",
      }),
    ],
  },
  {
    decision_id: "dec_be02d67387a0",
    title: "Transport API (#1522)",
    decision: "Transport API (#1522)",
    rationale:
      "Added httpx.BaseTransport and httpx.AsyncBaseTransport; use 'handle_request' for the transport API.",
    context: "",
    alternatives: [],
    consequences: [],
    scope: ["httpx/_transports/base.py", "httpx/_transports/default.py"],
    source: "commit",
    status: "accepted",
    pinned: false,
    superseded_by: null,
    confidence: 0.55,
    in_force: true,
    label: "in force",
    currency: "needs_review",
    changed_fraction: 0.5,
    verification: { verified: 1, total: 1, level: "verified" },
    evidence: [
      ev("Transport API (#1522)", {
        commit_sha: "1a6e254f72d9b1a4f0c7c4e2d9f3a5b6c7d8e9f0",
        author: "Tom Christie",
        created_at: "2021-03-24T11:15:00+00:00",
      }),
    ],
  },
  {
    decision_id: "dec_3d53b84da6f5",
    title: "Use ruff instead of flake8, autoflake and isort (#2648)",
    decision: "Use ruff instead of flake8, autoflake and isort (#2648)",
    rationale: "One fast linter replaces three tools.",
    context: "",
    alternatives: ["flake8 + autoflake + isort"],
    consequences: [],
    scope: ["pyproject.toml", "scripts/check"],
    source: "commit",
    status: "superseded",
    pinned: false,
    superseded_by: null,
    confidence: 0.55,
    in_force: false,
    label: "superseded",
    currency: "superseded",
    changed_fraction: null,
    verification: { verified: 1, total: 1, level: "verified" },
    evidence: [
      ev("Use ruff instead of flake8, autoflake and isort (#2648)", {
        commit_sha: "5d1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c",
        created_at: "2023-03-20T08:00:00+00:00",
      }),
    ],
  },
];

export function mockHealth(repo: string): LedgerHealth {
  const counts: Partial<Record<LedgerDecision["currency"], number>> = {};
  for (const d of MOCK_DECISIONS) counts[d.currency] = (counts[d.currency] ?? 0) + 1;
  return {
    mode: "health",
    repo,
    counts,
    in_force: MOCK_DECISIONS.filter((d) => d.in_force).length,
    pinned: MOCK_DECISIONS.filter((d) => d.pinned).length,
    needs_review: MOCK_DECISIONS.filter((d) => d.currency === "needs_review").map((d) => ({
      decision_id: d.decision_id,
      title: d.title,
      scope: d.scope,
      currency: d.currency,
      changed_fraction: d.changed_fraction,
    })),
    stale: [],
    unverified_in_force: [],
    ungoverned_hotspots: [
      { path: "httpx/_client.py", commits: 41 },
      { path: "httpx/_models.py", commits: 33 },
      { path: "httpx/_urls.py", commits: 17 },
    ],
  };
}
