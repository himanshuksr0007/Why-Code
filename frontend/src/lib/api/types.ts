/**
 * Typed frontend contract for the Why-Code answer service.
 *
 * These types mirror the response shapes in the project plan
 * (`docs` / plan §"API Contract"). They are intentionally narrow: the UI only
 * ever sees what the retrieval service is allowed to return, so a refusal is
 * a first-class result rather than an error.
 */

/** The nine normalized evidence record types (backend `RecordType`). */
export type RecordType =
  | "pull_request"
  | "commit"
  | "changed_file"
  | "review"
  | "review_comment"
  | "issue"
  | "issue_comment"
  | "person"
  | "doc_file";

/** Categorical, transparent signal — never a fabricated percentage. */
export type Confidence = "high" | "medium" | "low" | "insufficient";

/** `refused` means: no defensible evidence was found. */
export type AnswerStatus = "answered" | "refused" | "partial";

export type DecisionStatus =
  | "active"
  | "superseded"
  | "reversed"
  | "contested";

/** Node labels that can appear in a retrieved graph path. */
export type GraphNodeLabel =
  | "Repo"
  | "PullRequest"
  | "Commit"
  | "ChangedFile"
  | "CodeRegion"
  | "Review"
  | "ReviewComment"
  | "Issue"
  | "IssueComment"
  | "Person"
  | "Evidence"
  | "Symbol"
  | "ConfigKey"
  | "Doc"
  | "ExternalRef"
  | "Decision";

export interface AskRequest {
  question: string;
  repo: string;
  max_evidence_items?: number;
  include_graph_path?: boolean;
}

/** One verifiable piece of evidence behind an answer. */
export interface Citation {
  evidence_id: string;
  source_type: RecordType;
  /** Deep link to GitHub when the source is public. */
  url: string | null;
  excerpt: string;
  author?: string | null;
  /** ISO-8601 timestamp of the source artifact. */
  created_at?: string | null;
  title?: string | null;
}

export interface GraphPathNode {
  id: string;
  label: GraphNodeLabel;
  /** Short human caption, e.g. `retries = 0` or `httpx/_client.py`. */
  caption?: string;
}

export interface GraphPathEdge {
  id: string;
  source: string;
  target: string;
  rel_type: string;
}

export interface GraphPath {
  nodes: GraphPathNode[];
  edges: GraphPathEdge[];
}

export interface DecisionTarget {
  type: GraphNodeLabel;
  identifier: string;
}

/** The strict decision schema from Component 4. */
export interface Decision {
  decision_id: string;
  claim: string;
  status: DecisionStatus;
  confidence: Confidence;
  targets: DecisionTarget[];
  target_ids?: string[];
  evidence_ids: string[];
  supersedes?: string | null;
  superseded_by?: string | null;
  missing_evidence?: string[];
  pr_number?: number | null;
  created_at?: string | null;
  title?: string | null;
}

export interface RefusalInfo {
  reason: string;
  /** The closest ambiguous candidates, so the UI is never a dead end. */
  nearest_candidates: Citation[];
}

export interface AskResponse {
  answer: string;
  confidence: Confidence;
  status: AnswerStatus;
  citations: Citation[];
  graph_path?: GraphPath | null;
  superseded_by?: string | null;
  retrieval_trace_id: string;
  refusal?: RefusalInfo | null;
  decisions?: Decision[];
  /** Code changes the decisions in this answer refer to. */
  changes?: CodeChange[];
  /** Wall-clock latency in ms, when the transport can measure it. */
  latency_ms?: number;
}

export interface EvidenceDetail extends Citation {
  record_type: RecordType;
  repo: string;
  pr_number?: number | null;
  /** Full normalized body when the excerpt is truncated. */
  body?: string | null;
  /** The raw normalized payload, for the inspector. */
  payload?: Record<string, unknown>;
}

/** One step in a decision's life: origin, revision, or reversal. */
export interface TimelineStep {
  kind: "origin" | "revision" | "reversal";
  decision: Decision;
}

/** A decision plus everything that later revised or reversed it. */
export interface DecisionThread {
  thread_id: string;
  topic: string;
  /** Status of the currently-active decision in the thread. */
  current_status: DecisionStatus;
  steps: TimelineStep[];
}

export interface WhyCodeClient {
  ask(request: AskRequest): Promise<AskResponse>;
  getEvidence(evidenceId: string): Promise<EvidenceDetail>;
  getGraphPath(decisionId: string): Promise<GraphPath>;
  listDecisions(repo: string): Promise<DecisionThread[]>;
  listPeople(repo: string): Promise<PersonSummary[]>;
  getPerson(repo: string, login: string): Promise<PersonProfile>;
  listChanges(repo: string, limit?: number): Promise<CodeChange[]>;
  getPullRequest(repo: string, number: number): Promise<PullRequestDetail>;
}

/* ------------------------------------------------------------------ */
/* People and participation                                           */
/* ------------------------------------------------------------------ */

/** How a person took part in a pull request. */
export type ParticipationRole =
  | "author"
  | "reviewer"
  | "commenter"
  | "committer";

export interface PersonRef {
  login: string;
  name?: string | null;
  /** GitHub profile URL. */
  url?: string | null;
}

export interface Participant extends PersonRef {
  roles: ParticipationRole[];
  /** Number of artifacts this person contributed (commits, comments, reviews). */
  contributions: number;
}

/** Enough about a pull request to attribute and link a code change. */
export interface PullRequestRef {
  number: number;
  title: string;
  url: string | null;
  author: PersonRef | null;
  merged_at?: string | null;
  reviewers: PersonRef[];
  participants: Participant[];
}

export type ChangeKind = "added" | "modified" | "removed" | "renamed";

/**
 * A code change together with the reason it was made. This is the unit that
 * answers "what changed, why, and who was involved".
 */
export interface CodeChange {
  change_id: string;
  path: string;
  symbol?: string | null;
  change_kind: ChangeKind;
  additions: number;
  deletions: number;
  start_line?: number | null;
  end_line?: number | null;
  /** Optional before/after excerpt, for a compact in-line diff. */
  code_before?: string | null;
  code_after?: string | null;
  /** The reasoning attached to this change. */
  reasoning: string;
  decision: Decision | null;
  evidence_ids: string[];
  pr: PullRequestRef;
  author: PersonRef | null;
}

export interface PersonSummary extends PersonRef {
  /** Free-form tags such as "Maintainer". */
  role_tags: string[];
  authored_pull_requests: number;
  reviews: number;
  comments: number;
  commits: number;
  decisions: number;
  first_seen?: string | null;
  last_seen?: string | null;
}

export interface PersonProfile extends PersonSummary {
  authored: PullRequestRef[];
  reviewed: PullRequestRef[];
  participated: PullRequestRef[];
  changes: CodeChange[];
}

export interface ChangedFileSummary {
  path: string;
  change_kind: ChangeKind;
  additions: number;
  deletions: number;
}

export interface CommitSummary {
  sha: string;
  message: string;
  author: PersonRef | null;
  committed_at?: string | null;
}

export interface PullRequestDetail extends PullRequestRef {
  state: "merged" | "closed" | "open";
  created_at?: string | null;
  body?: string | null;
  review_comment_count: number;
  issue_comment_count: number;
  changed_files: ChangedFileSummary[];
  commits: CommitSummary[];
  decision_ids: string[];
}
