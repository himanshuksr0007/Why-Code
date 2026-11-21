/**
 * Shapes served by the decision ledger (`/api/v1/ledger/*`).
 * Mirrors `backend/app/ledger/why.py::WhyEngine.card`.
 */

export type Currency =
  | "active"
  | "needs_review"
  | "uncheckable"
  | "stale"
  | "superseded"
  | "dismissed"
  | "background";

export type Verification = "verified" | "fuzzy" | "unverified";

export type DecisionSource =
  | "adr"
  | "inline_marker"
  | "commit"
  | "pr_block"
  | "manual"
  | "agent";

export interface LedgerEvidence {
  evidence_id: string;
  kind: string;
  quote: string;
  path: string | null;
  start_line: number | null;
  end_line: number | null;
  commit_sha: string | null;
  pr_number: number | null;
  url: string | null;
  author: string | null;
  created_at: string | null;
  verification: Verification;
}

export interface AuthorityEvent {
  seq: number | null;
  decision_id: string;
  action: string;
  reason: string;
  signer: string;
  signer_kind: "person" | "agent" | "import" | "bot";
  scope: string[];
  evidence_ref: string | null;
  at: string;
}

export interface LedgerDecision {
  decision_id: string;
  title: string;
  decision: string;
  rationale: string;
  context: string;
  alternatives: string[];
  consequences: string[];
  scope: string[];
  source: DecisionSource;
  status: string;
  pinned: boolean;
  superseded_by: string | null;
  confidence: number;
  in_force: boolean;
  label: string;
  currency: Currency;
  changed_fraction: number | null;
  verification: { verified: number; total: number; level: Verification };
  evidence: LedgerEvidence[];
  score?: number;
  authority_log?: AuthorityEvent[];
}

export interface HotspotRow {
  path: string;
  commits: number;
}

export interface DecisionBrief {
  decision_id: string;
  title: string;
  scope: string[];
  currency: Currency;
  changed_fraction: number | null;
}

export interface LedgerHealth {
  mode: "health" | "not_indexed";
  repo: string;
  counts?: Partial<Record<Currency, number>>;
  in_force?: number;
  pinned?: number;
  needs_review?: DecisionBrief[];
  stale?: DecisionBrief[];
  unverified_in_force?: DecisionBrief[];
  ungoverned_hotspots?: HotspotRow[];
  message?: string;
}
