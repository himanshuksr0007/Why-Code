/**
 * In-memory transport backed by the per-repository fixtures in `lib/mock/`.
 *
 * Same interface as the HTTP transport, so swapping to the live service is a
 * one-line env change. A little latency is simulated on purpose so loading
 * states and skeletons are exercised during development.
 */

import { AVAILABLE_REPOS, findRepo } from "@/lib/api/config";
import {
  ALL_EVIDENCE,
  ALL_GRAPH_PATHS,
  fixturesFor,
  pullRequestFor,
} from "@/lib/mock";
import { buildPersonProfile, changesForDecision } from "@/lib/mock/build";

import type {
  AskRequest,
  AskResponse,
  AuditReport,
  CodeChange,
  DecisionRecord,
  DecisionThread,
  EvidenceDetail,
  GraphPath,
  PersonProfile,
  PersonSummary,
  PlanGraph,
  PlanGraphEdge,
  PlanGraphNode,
  PlanView,
  PullRequestDetail,
  SupersessionPair,
  WhyCodeClient,
} from "./types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Manually added repositories have no fixtures behind them. */
function isIndexed(repo: string): boolean {
  return Boolean(findRepo(repo)?.indexed);
}

function unindexedAnswer(repo: string): AskResponse {
  return {
    answer: [
      `\`${repo}\` has not been indexed in this demo, so there is no code evidence to answer from.`,
      "",
      "Added repositories are remembered in this browser and appear in the selector, but the mock adapter has no decisions, commits or reviews for them. Switch to one of the sample repositories to ask a question, or connect the repository to the ingestion service and set `NEXT_PUBLIC_API_MODE=http`.",
    ].join("\n"),
    confidence: "low",
    status: "refused",
    citations: [],
    graph_path: null,
    superseded_by: null,
    retrieval_trace_id: "trace_not_indexed",
    refusal: {
      reason: `${repo} has not been indexed, so no claim about its code can be grounded in evidence.`,
      nearest_candidates: [],
    },
  };
}

function buildFallback(question: string, repo: string): AskResponse {
  return {
    answer: [
      "This question could not be mapped to a specific config key, symbol or file, so no decision was claimed.",
      "",
      "The retrieval pass found related evidence but nothing that directly answers it. Try naming the thing you are asking about, for example:",
      "",
      "- a config key such as `retries` or `timeout`,",
      "- a symbol such as a class or function name,",
      "- or a file path in the repository.",
      "",
      `The closest matches came from \`${repo}\`.`,
    ].join("\n"),
    confidence: "low",
    status: "partial",
    citations: [],
    graph_path: null,
    superseded_by: null,
    retrieval_trace_id: `trace_fallback_${question.length.toString(16)}`,
  };
}

const KIND_BY_LABEL: Record<string, string> = {
  Repo: "repo",
  PullRequest: "pr",
  Commit: "commit",
  ChangedFile: "file",
  CodeRegion: "code",
  Symbol: "symbol",
  ConfigKey: "config",
  Decision: "decision",
  Evidence: "evidence",
  Person: "person",
  Issue: "issue",
  Doc: "doc",
};

/**
 * The mock transport's plan, mirroring the backend builder: decisions in
 * the fixture answer become done steps, and the fixture's graph path
 * becomes the connection graph rooted at the goal.
 */
function buildMockPlan(question: string, response: AskResponse): PlanView {
  const steps: PlanView["steps"] = (response.decisions ?? []).map(
    (decision) => ({
      title: decision.title ?? decision.claim,
      detail: decision.claim,
      status: "done" as const,
      evidence_ids: decision.evidence_ids ?? [],
    }),
  );
  steps.push(
    {
      title: "Implement the change in the owning modules",
      detail:
        "Keep the change inside the modules on the retrieved code path and follow the decisions recorded above.",
      status: "needed",
      evidence_ids: [],
    },
    {
      title: "Cover the new behaviour with tests",
      detail:
        "Add tests at the same seams the existing decisions were verified at, including the default path.",
      status: "needed",
      evidence_ids: [],
    },
    {
      title: "Record the decision",
      detail:
        "Land the change as a reviewed pull request that states the why; it becomes a done step in the next plan.",
      status: "needed",
      evidence_ids: [],
    },
  );

  const nodes: PlanGraphNode[] = [
    { id: "goal", label: "Goal", kind: "feature", caption: question },
  ];
  const edges: PlanGraphEdge[] = [];
  const path = response.graph_path;
  if (path) {
    for (const node of path.nodes) {
      nodes.push({
        id: node.id,
        label: node.label,
        kind: KIND_BY_LABEL[node.label] ?? "module",
        caption: node.caption ?? node.label,
      });
    }
    for (const edge of path.edges) {
      edges.push({
        source: edge.source,
        target: edge.target,
        rel_type: edge.rel_type,
      });
    }
    if (path.nodes.length > 0) {
      edges.push({
        source: "goal",
        target: path.nodes[0].id,
        rel_type: "starts from",
      });
    }
  }
  return { goal: question, steps, graph: { nodes, edges } };
}

const STRUCTURE_MARKERS = [
  "structure",
  "layout",
  "file tree",
  "folder",
  "director",
  "organiz",
  "repo map",
  "codebase map",
  "project tree",
  "directory tree",
  "folder tree",
];

/** Mirror of the backend structure builder, fed by the fixture code
 * changes' paths (the mock's repo-wide file set). */
function buildMockStructure(repo: string, paths: string[]): PlanGraph | null {
  const unique = [...new Set(paths.map((p) => p.replace(/^\/+|\/+$/g, "")))].sort();
  if (unique.length < 2) return null;
  const nodes: PlanGraphNode[] = [
    { id: "repo:root", label: repo, kind: "repo", caption: `Repository ${repo}` },
  ];
  const edges: PlanGraphEdge[] = [];
  const seenNodes = new Set(["repo:root"]);
  const seenEdges = new Set<string>();
  for (const path of unique) {
    const parts = path.split("/").filter(Boolean);
    let parent = "repo:root";
    let prefix = "";
    parts.forEach((part, index) => {
      prefix = prefix ? `${prefix}/${part}` : part;
      const id = `path:${prefix}`;
      const leaf = index === parts.length - 1;
      if (!seenNodes.has(id)) {
        seenNodes.add(id);
        nodes.push({
          id,
          label: leaf ? part : `${part}/`,
          kind: leaf ? "file" : "folder",
          caption: leaf ? path : `${prefix}/`,
        });
      }
      const key = `${parent}->${id}`;
      if (!seenEdges.has(key)) {
        seenEdges.add(key);
        edges.push({ source: parent, target: id, rel_type: "contains" });
      }
      parent = id;
    });
  }
  return { nodes, edges };
}

function resolveAnswer(question: string, repo: string): AskResponse {
  const fixtures = fixturesFor(repo);
  const normalised = question.toLowerCase();
  if (
    fixtures.refusalKeywords.some((keyword) => normalised.includes(keyword))
  ) {
    return structuredClone(fixtures.refusal);
  }
  const match = fixtures.answers.find((entry) =>
    entry.keywords.some((keyword) => normalised.includes(keyword)),
  );
  return match ? match.build() : buildFallback(question, repo);
}

export function createMockClient(): WhyCodeClient {
  return {
    async ask(request: AskRequest): Promise<AskResponse> {
      const startedAt = Date.now();
      await sleep(450);
      if (!isIndexed(request.repo)) {
        return {
          ...unindexedAnswer(request.repo),
          latency_ms: Date.now() - startedAt,
        };
      }
      const fixtures = fixturesFor(request.repo);
      const response = resolveAnswer(request.question, request.repo);
      if (request.include_graph_path === false) {
        response.graph_path = null;
      }
      if (request.max_evidence_items !== undefined) {
        response.citations = response.citations.slice(
          0,
          request.max_evidence_items,
        );
      }
      // Attach the code changes that back the decisions in this answer, so a
      // screen can show "what changed and why" next to the claim itself.
      const decisionIds = (response.decisions ?? []).map(
        (decision) => decision.decision_id,
      );
      const changes = changesForDecision(fixtures.changes, decisionIds);
      if (changes.length > 0) {
        response.changes = changes;
      }
      if (request.mode === "plan") {
        response.plan = buildMockPlan(request.question, response);
      }
      const lowered = request.question.toLowerCase();
      if (STRUCTURE_MARKERS.some((marker) => lowered.includes(marker))) {
        const structure = buildMockStructure(
          request.repo,
          fixtures.changes.map((change) => change.path),
        );
        if (structure) {
          response.structure = structure;
          if (response.status === "refused") {
            response.status = "answered";
            response.answer =
              `The repository ${request.repo} is organized around the ` +
              "folders shown in the structure graph — the files the index " +
              "has retrieved for it, arranged as a tree.";
          }
        }
      }
      return { ...response, latency_ms: Date.now() - startedAt };
    },

    async getEvidence(evidenceId: string): Promise<EvidenceDetail> {
      await sleep(200);
      const evidence = ALL_EVIDENCE[evidenceId];
      if (!evidence) {
        throw new Error(`No evidence found for ${evidenceId}`);
      }
      return structuredClone(evidence);
    },

    async getGraphPath(decisionId: string): Promise<GraphPath> {
      await sleep(200);
      const path = ALL_GRAPH_PATHS[decisionId];
      if (!path) {
        throw new Error(`No graph path found for decision ${decisionId}`);
      }
      return structuredClone(path);
    },

    async listDecisions(repo: string): Promise<DecisionThread[]> {
      await sleep(150);
      if (!isIndexed(repo)) return [];
      return structuredClone(fixturesFor(repo).threads);
    },

    async listPeople(repo: string): Promise<PersonSummary[]> {
      await sleep(150);
      if (!isIndexed(repo)) return [];
      return structuredClone(fixturesFor(repo).people);
    },

    async getPerson(repo: string, login: string): Promise<PersonProfile> {
      await sleep(200);
      if (!isIndexed(repo)) {
        throw new Error(`No person found for ${login}`);
      }
      const fixtures = fixturesFor(repo);
      if (!fixtures.people.some((person) => person.login === login)) {
        throw new Error(`No person found for ${login}`);
      }
      const names = Object.fromEntries(
        fixtures.people.map((person) => [
          person.login,
          person.name ?? person.login,
        ]),
      );
      return structuredClone(
        buildPersonProfile(login, {
          people: fixtures.people,
          pullRequests: fixtures.pullRequests,
          changes: fixtures.changes,
          names,
        }),
      );
    },

    async listChanges(repo: string, limit?: number): Promise<CodeChange[]> {
      await sleep(150);
      if (!isIndexed(repo)) return [];
      const changes = fixturesFor(repo).changes;
      return structuredClone(limit ? changes.slice(0, limit) : changes);
    },

    async getPullRequest(
      repo: string,
      number: number,
    ): Promise<PullRequestDetail> {
      await sleep(200);
      if (!isIndexed(repo)) {
        throw new Error(`No pull request found for #${number} in ${repo}`);
      }
      const pull = pullRequestFor(repo, number);
      if (!pull) {
        throw new Error(`No pull request found for #${number} in ${repo}`);
      }
      return structuredClone(pull);
    },

    async listRecords(query) {
      await sleep(120);
      const all = isIndexed(query.repo) ? mockRecordsFor(query.repo) : [];
      const filtered = filterMockRecords(all, query);
      const offset = query.offset ?? 0;
      const limit = query.limit ?? 25;
      return {
        total: filtered.length,
        limit,
        offset,
        records: filtered.slice(offset, offset + limit),
      };
    },

    async searchRecords(q, repo) {
      await sleep(120);
      const repos = repo
        ? [repo]
        : AVAILABLE_REPOS.filter((r) => r.indexed).map((r) => r.slug);
      const results = repos
        .filter((r) => isIndexed(r))
        .flatMap((r) => filterMockRecords(mockRecordsFor(r), { q }));
      return { query: q, repos, total: results.length, results };
    },

    async listSupersessions(repo) {
      await sleep(120);
      if (!isIndexed(repo)) return [];
      const records = mockRecordsFor(repo);
      const byId = new Map(records.map((r) => [r.decision_id, r]));
      const pairs: SupersessionPair[] = [];
      for (const record of records) {
        const later = record.superseded_by
          ? byId.get(record.superseded_by)
          : undefined;
        if (later) {
          pairs.push({
            repo,
            earlier: record,
            later,
            relation:
              record.status === "reversed" ? "REVERSED_BY" : "SUPERSEDED_BY",
          });
        }
      }
      return pairs;
    },

    async getAudit(repo) {
      await sleep(120);
      const records = isIndexed(repo) ? mockRecordsFor(repo) : [];
      return mockAudit(records, repo);
    },

    async listWebhookEvents() {
      return { events: [], jobs: [] };
    },

    async refreshRepo(repo) {
      await sleep(200);
      return { repo, refreshed: true };
    },

    recordExportUrl(decisionId, repo) {
      const record = isIndexed(repo)
        ? mockRecordsFor(repo).find((r) => r.decision_id === decisionId)
        : undefined;
      const body = record
        ? mockAdr(record)
        : `# ${decisionId}\n\nNo fixture record found.\n`;
      return `data:text/markdown;charset=utf-8,${encodeURIComponent(body)}`;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Mock decision records (mirror of the backend features layer)        */
/* ------------------------------------------------------------------ */

const SECURITY_RE =
  /\b(bug|regression|crash|incident|failure|security|vulnerab\w*|deadlock)\b/i;

function mockRecordsFor(repo: string): DecisionRecord[] {
  const threads = fixturesFor(repo).threads;
  const records: DecisionRecord[] = [];
  for (const thread of threads) {
    thread.steps.forEach((step, index) => {
      const d = step.decision;
      const status = String(d.status);
      let supersededBy = d.superseded_by ?? null;
      if (!supersededBy && (status === "superseded" || status === "reversed")) {
        supersededBy = thread.steps[index + 1]?.decision.decision_id ?? null;
      }
      records.push({
        decision_id: d.decision_id,
        repo,
        title: d.title ?? null,
        claim: d.claim,
        rationale: (d as { rationale?: string }).rationale ?? "",
        status,
        confidence: String(d.confidence),
        kind: step.kind,
        topic: thread.topic,
        target_ids:
          d.target_ids ?? d.targets.map((t) => `${t.type}:${t.identifier}`),
        evidence_ids: d.evidence_ids ?? [],
        evidence: [],
        superseded_by: supersededBy,
        supersedes: [],
        pr_number: d.pr_number ?? null,
        created_at: d.created_at ?? null,
      });
    });
  }
  const byId = new Map(records.map((r) => [r.decision_id, r]));
  for (const record of records) {
    if (record.superseded_by && byId.has(record.superseded_by)) {
      byId.get(record.superseded_by)!.supersedes.push(record.decision_id);
    }
  }
  return records;
}

function filterMockRecords(
  records: DecisionRecord[],
  query: { q?: string; status?: string; kind?: string; target?: string },
): DecisionRecord[] {
  let out = [...records];
  if (query.status) out = out.filter((r) => r.status === query.status);
  if (query.kind) out = out.filter((r) => r.kind === query.kind);
  if (query.target) {
    const needle = query.target.toLowerCase();
    out = out.filter((r) =>
      r.target_ids.some((t) => t.toLowerCase().includes(needle)),
    );
  }
  if (query.q) {
    const wanted = query.q.toLowerCase().split(/\s+/).filter(Boolean);
    out = out.filter((r) => {
      const text =
        `${r.title ?? ""} ${r.claim} ${r.rationale} ${r.topic ?? ""} ${r.target_ids.join(" ")}`.toLowerCase();
      return wanted.every((token) => text.includes(token));
    });
  }
  out.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return out;
}

function mockAudit(records: DecisionRecord[], repo: string): AuditReport {
  const byStatus: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  for (const r of records) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
  }
  const hasRationale = (r: DecisionRecord) =>
    Boolean(r.rationale.trim()) && r.rationale !== r.claim;
  const flagged = records.filter((r) =>
    SECURITY_RE.test(`${r.claim} ${r.rationale}`),
  );
  const total = records.length;
  return {
    repo,
    generated_at: new Date().toISOString(),
    total,
    by_status: byStatus,
    by_kind: byKind,
    with_rationale_pct: total
      ? Math.round((records.filter(hasRationale).length / total) * 1000) / 10
      : 0,
    with_evidence_pct: total
      ? Math.round(
          (records.filter((r) => r.evidence_ids.length > 0).length / total) *
            1000,
        ) / 10
      : 0,
    superseded: records.filter(
      (r) => r.status === "superseded" || r.status === "reversed",
    ).length,
    security_flagged: flagged.length,
    security_missing_rationale: flagged
      .filter((r) => !hasRationale(r))
      .map((r) => r.decision_id),
    missing_evidence: records
      .filter((r) => r.evidence_ids.length === 0)
      .map((r) => r.decision_id),
  };
}

function mockAdr(record: DecisionRecord): string {
  const lines = [
    `# ${record.decision_id}: ${record.title ?? record.claim}`,
    "",
    `- **Status:** ${record.status}`,
    `- **Repository:** ${record.repo}`,
    `- **Confidence:** ${record.confidence}`,
    "",
    "## Decision",
    "",
    record.claim,
    "",
    "## Rationale",
    "",
    record.rationale || "_(no rationale recorded)_",
    "",
  ];
  if (record.target_ids.length > 0) {
    lines.push("## Targets", "", ...record.target_ids.map((t) => `- \`${t}\``), "");
  }
  if (record.evidence_ids.length > 0) {
    lines.push("## Evidence", "", ...record.evidence_ids.map((id) => `- ${id}`), "");
  }
  return lines.join("\n");
}
