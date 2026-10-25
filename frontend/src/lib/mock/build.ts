/**
 * Helpers for authoring the per-repository sample fixtures.
 *
 * Every repository in `AVAILABLE_REPOS` ships a complete fixture bundle
 * (questions, answers, decisions, code changes, people, pull requests) so that
 * switching repositories changes the whole experience, not just a label. This
 * module holds the small builders that keep those bundles readable.
 *
 * The data is illustrative — it demonstrates the shape of the API while the
 * retrieval service (Component 5) is still being built, and is not a source of
 * truth about the upstream projects. Set `NEXT_PUBLIC_API_MODE=http` and none of
 * it is used.
 */

import type {
  AskResponse,
  ChangedFileSummary,
  Citation,
  CodeChange,
  CommitSummary,
  Decision,
  DecisionStatus,
  DecisionThread,
  EvidenceDetail,
  GraphPath,
  Participant,
  ParticipationRole,
  PersonProfile,
  PersonRef,
  PersonSummary,
  PullRequestDetail,
  PullRequestRef,
  TimelineStep,
} from "@/lib/api/types";

export interface MockAnswer {
  id: string;
  /** Lower-cased terms; a question matches when it contains one. */
  keywords: string[];
  build: () => AskResponse;
}

/** Everything the mock transport needs for one repository. */
export interface RepoFixtures {
  slug: string;
  /** Example questions shown on the Ask entrance. */
  questions: string[];
  /** Questions that intentionally produce a refusal, exercising that state. */
  refusalKeywords: string[];
  evidence: Record<string, EvidenceDetail>;
  decisions: Record<string, Decision>;
  threads: DecisionThread[];
  graphPaths: Record<string, GraphPath>;
  changes: CodeChange[];
  pullRequests: Record<number, PullRequestDetail>;
  people: PersonSummary[];
  answers: MockAnswer[];
  refusal: AskResponse;
}

/** Names and role tags keyed by GitHub login. */
export interface Directory {
  names: Record<string, string>;
  tags: Record<string, string[]>;
}

/**
 * Binds `person` / `participant` to a login directory so each repository file
 * can stay terse.
 */
export function directory(
  names: Record<string, string>,
  tags: Record<string, string[]> = {},
): {
  dir: Directory;
  person: (login: string) => PersonRef;
  participant: (
    login: string,
    roles: ParticipationRole[],
    contributions: number,
  ) => Participant;
} {
  const dir: Directory = { names, tags };
  const person = (login: string): PersonRef => ({
    login,
    name: names[login] ?? login,
    url: `https://github.com/${login}`,
  });
  const participant = (
    login: string,
    roles: ParticipationRole[],
    contributions: number,
  ): Participant => ({ ...person(login), roles, contributions });
  return { dir, person, participant };
}

/** Builds a `cite()` that resolves evidence ids against one repository. */
export function makeCiter(evidence: Record<string, EvidenceDetail>) {
  return function cite(id: string, overrides: Partial<Citation> = {}): Citation {
    const record = evidence[id];
    if (!record) {
      throw new Error(`mock fixture references unknown evidence id: ${id}`);
    }
    return {
      evidence_id: record.evidence_id,
      source_type: record.source_type,
      url: record.url,
      excerpt: record.excerpt,
      author: record.author,
      created_at: record.created_at,
      title: record.title,
      ...overrides,
    };
  };
}

/** A decision's path through the graph, from a target to its evidence. */
export function chain(
  steps: [string, GraphPath["nodes"][number]["label"], string][],
  rels: [string, string, string][],
): GraphPath {
  const nodes = steps.map(([id, label, caption]) => ({ id, label, caption }));
  const edges = rels.map(([source, target, rel_type]) => ({
    id: `${source}->${rel_type}->${target}`,
    source,
    target,
    rel_type,
  }));
  return { nodes, edges };
}

export function origin(decision: Decision): TimelineStep {
  return { kind: "origin", decision };
}

export function revision(decision: Decision): TimelineStep {
  return { kind: "revision", decision };
}

export function reversal(decision: Decision): TimelineStep {
  return { kind: "reversal", decision };
}

/** A thread's current status is always the status of its latest step. */
export function thread(
  thread_id: string,
  topic: string,
  steps: TimelineStep[],
): DecisionThread {
  const last = steps.at(-1);
  const current_status: DecisionStatus = last ? last.decision.status : "active";
  return { thread_id, topic, current_status, steps };
}

export function file(
  path: string,
  change_kind: ChangedFileSummary["change_kind"],
  additions: number,
  deletions: number,
): ChangedFileSummary {
  return { path, change_kind, additions, deletions };
}

export function commit(
  sha: string,
  message: string,
  author: PersonRef,
  committed_at: string,
): CommitSummary {
  return { sha, message, author, committed_at };
}

export function pullRequest(input: {
  number: number;
  repo: string;
  title: string;
  state?: PullRequestDetail["state"];
  author: PersonRef;
  created_at: string;
  merged_at: string;
  reviewers: PersonRef[];
  participants: Participant[];
  changed_files: ChangedFileSummary[];
  commits: CommitSummary[];
  decision_ids: string[];
  body: string;
}): PullRequestDetail {
  return {
    number: input.number,
    title: input.title,
    url: `https://github.com/${input.repo}/pull/${input.number}`,
    state: input.state ?? "merged",
    author: input.author,
    created_at: input.created_at,
    merged_at: input.merged_at,
    body: input.body,
    reviewers: input.reviewers,
    participants: input.participants,
    review_comment_count: input.participants.filter((p) =>
      p.roles.includes("commenter"),
    ).length,
    issue_comment_count: 1,
    changed_files: input.changed_files,
    commits: input.commits,
    decision_ids: input.decision_ids,
  };
}

export function prRef(pull: PullRequestDetail): PullRequestRef {
  return {
    number: pull.number,
    title: pull.title,
    url: pull.url,
    author: pull.author,
    merged_at: pull.merged_at,
    reviewers: pull.reviewers,
    participants: pull.participants,
  };
}

/** Most recently merged first, so a feed reads like a changelog. */
export function sortChanges(changes: CodeChange[]): CodeChange[] {
  return [...changes].sort((a, b) =>
    (b.pr.merged_at ?? "").localeCompare(a.pr.merged_at ?? ""),
  );
}

export function changesForDecision(
  changes: CodeChange[],
  decisionIds: string[],
): CodeChange[] {
  const wanted = new Set(decisionIds);
  return changes.filter(
    (change) => change.decision && wanted.has(change.decision.decision_id),
  );
}

/** Derives contributor summaries from a repository's pulls and changes. */
export function derivePeople(
  pullRequests: Record<number, PullRequestDetail>,
  changes: CodeChange[],
  dir: Directory,
): PersonSummary[] {
  const person = (login: string): PersonRef => ({
    login,
    name: dir.names[login] ?? login,
    url: `https://github.com/${login}`,
  });

  const summaries = new Map<string, PersonSummary>();

  const ensure = (ref: PersonRef): PersonSummary => {
    const existing = summaries.get(ref.login);
    if (existing) return existing;
    const created: PersonSummary = {
      ...person(ref.login),
      role_tags: dir.tags[ref.login] ?? ["Contributor"],
      authored_pull_requests: 0,
      reviews: 0,
      comments: 0,
      commits: 0,
      decisions: 0,
      first_seen: null,
      last_seen: null,
    };
    summaries.set(ref.login, created);
    return created;
  };

  const touch = (ref: PersonRef, date?: string | null) => {
    if (!date) return;
    const summary = ensure(ref);
    if (!summary.first_seen || date < summary.first_seen) {
      summary.first_seen = date;
    }
    if (!summary.last_seen || date > summary.last_seen) {
      summary.last_seen = date;
    }
  };

  for (const pull of Object.values(pullRequests)) {
    if (pull.author) {
      ensure(pull.author).authored_pull_requests += 1;
      touch(pull.author, pull.created_at);
    }
    for (const reviewer of pull.reviewers) {
      ensure(reviewer).reviews += 1;
      touch(reviewer, pull.merged_at);
    }
    for (const member of pull.participants) {
      const summary = ensure(member);
      touch(member, pull.merged_at);
      if (member.roles.includes("commenter")) {
        summary.comments += member.contributions;
      }
      if (member.roles.includes("committer")) summary.commits += 1;
    }
  }

  const seenDecisions = new Set<string>();
  for (const change of changes) {
    if (!change.decision || !change.author) continue;
    const key = `${change.author.login}:${change.decision.decision_id}`;
    if (seenDecisions.has(key)) continue;
    seenDecisions.add(key);
    ensure(change.author).decisions += 1;
  }

  return [...summaries.values()].sort(
    (a, b) =>
      b.authored_pull_requests +
      b.reviews -
      (a.authored_pull_requests + a.reviews),
  );
}

export function buildPersonProfile(
  login: string,
  fixtures: {
    people: PersonSummary[];
    pullRequests: Record<number, PullRequestDetail>;
    changes: CodeChange[];
    names: Record<string, string>;
  },
): PersonProfile {
  const summary =
    fixtures.people.find((entry) => entry.login === login) ??
    {
      login,
      name: fixtures.names[login] ?? login,
      url: `https://github.com/${login}`,
      role_tags: ["Contributor"],
      authored_pull_requests: 0,
      reviews: 0,
      comments: 0,
      commits: 0,
      decisions: 0,
      first_seen: null,
      last_seen: null,
    };

  const pulls = Object.values(fixtures.pullRequests);
  return {
    ...summary,
    authored: pulls
      .filter((pull) => pull.author?.login === login)
      .map(prRef),
    reviewed: pulls
      .filter((pull) => pull.reviewers.some((r) => r.login === login))
      .map(prRef),
    participated: pulls
      .filter((pull) => pull.participants.some((p) => p.login === login))
      .map(prRef),
    changes: fixtures.changes.filter(
      (change) => change.author?.login === login,
    ),
  };
}
