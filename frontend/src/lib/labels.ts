/**
 * Presentation vocabulary: stable label + colour mappings for the categorical
 * signals the backend returns. Keeping them here (not inline in components)
 * means a confidence or status renders the same everywhere.
 */

import type {
  AnswerStatus,
  ChangeKind,
  Confidence,
  DecisionStatus,
  GraphNodeLabel,
  ParticipationRole,
  RecordType,
} from "@/lib/api/types";

export interface Tone {
  label: string;
  /** Tailwind classes for a Badge (border + bg + text). */
  className: string;
}

export const CONFIDENCE: Record<Confidence, Tone> = {
  high: {
    label: "High confidence",
    className: "border-primary/40 bg-primary/15 text-primary",
  },
  medium: {
    label: "Medium confidence",
    className: "border-chart-4/40 bg-chart-4/15 text-chart-4",
  },
  low: {
    label: "Low confidence",
    className: "border-border bg-muted text-muted-foreground",
  },
  insufficient: {
    label: "Insufficient evidence",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

export const ANSWER_STATUS: Record<AnswerStatus, Tone> = {
  answered: {
    label: "Answered",
    className: "border-primary/40 bg-primary/15 text-primary",
  },
  partial: {
    label: "Partial answer",
    className: "border-chart-4/40 bg-chart-4/15 text-chart-4",
  },
  refused: {
    label: "Refused",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

export const DECISION_STATUS: Record<DecisionStatus, Tone> = {
  active: {
    label: "Active",
    className: "border-primary/40 bg-primary/15 text-primary",
  },
  superseded: {
    label: "Superseded",
    className: "border-border bg-muted text-muted-foreground",
  },
  reversed: {
    label: "Reversed",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  contested: {
    label: "Contested",
    className: "border-chart-4/40 bg-chart-4/15 text-chart-4",
  },
};

export const RECORD_TYPE_LABEL: Record<RecordType, string> = {
  pull_request: "Pull request",
  commit: "Commit",
  changed_file: "Changed file",
  review: "Review",
  review_comment: "Review comment",
  issue: "Issue",
  issue_comment: "Issue comment",
  person: "Person",
  doc_file: "Doc",
};

/** How a code change altered the file it touched. */
export const CHANGE_KIND: Record<ChangeKind, Tone> = {
  added: {
    label: "Added",
    className: "border-primary/40 bg-primary/15 text-primary",
  },
  modified: {
    label: "Modified",
    className: "border-chart-4/40 bg-chart-4/15 text-chart-4",
  },
  removed: {
    label: "Removed",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  renamed: {
    label: "Renamed",
    className: "border-border bg-muted text-muted-foreground",
  },
};

/** How a person took part in a pull request. */
export const PARTICIPATION_ROLE: Record<ParticipationRole, string> = {
  author: "Author",
  reviewer: "Reviewer",
  commenter: "Commenter",
  committer: "Committer",
};

/** Human label for a graph node type. */
export const NODE_LABEL: Record<GraphNodeLabel, string> = {
  Repo: "Repo",
  PullRequest: "Pull request",
  Commit: "Commit",
  ChangedFile: "Changed file",
  CodeRegion: "Code region",
  Review: "Review",
  ReviewComment: "Review comment",
  Issue: "Issue",
  IssueComment: "Issue comment",
  Person: "Person",
  Evidence: "Evidence",
  Symbol: "Symbol",
  ConfigKey: "Config key",
  Doc: "Doc",
  ExternalRef: "External ref",
  Decision: "Decision",
};

/**
 * Accent per graph node type. Values are plain hex (not theme tokens) because
 * React Flow renders them into inline styles / SVG, but they are drawn from
 * the same chart palette defined in `globals.css`.
 */
const NODE_COLOR: Partial<Record<GraphNodeLabel, string>> = {
  ConfigKey: "var(--chart-4)",
  Symbol: "var(--chart-2)",
  CodeRegion: "var(--chart-3)",
  Commit: "var(--chart-5)",
  PullRequest: "var(--chart-1)",
  Decision: "#14b8a6",
  Evidence: "var(--muted-foreground)",
  Repo: "var(--chart-1)",
  ChangedFile: "var(--chart-2)",
  Review: "var(--chart-3)",
  ReviewComment: "var(--chart-3)",
  Issue: "var(--chart-5)",
  IssueComment: "var(--chart-5)",
  Person: "var(--chart-4)",
  Doc: "var(--muted-foreground)",
  ExternalRef: "var(--muted-foreground)",
};

export function nodeColor(label: GraphNodeLabel): string {
  return NODE_COLOR[label] ?? "var(--muted-foreground)";
}
