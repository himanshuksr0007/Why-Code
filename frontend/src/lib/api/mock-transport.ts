/**
 * In-memory transport backed by the per-repository fixtures in `lib/mock/`.
 *
 * Same interface as the HTTP transport, so swapping to the live service is a
 * one-line env change. A little latency is simulated on purpose so loading
 * states and skeletons are exercised during development.
 */

import { findRepo } from "@/lib/api/config";
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
  CodeChange,
  DecisionThread,
  EvidenceDetail,
  GraphPath,
  PersonProfile,
  PersonSummary,
  PlanGraphEdge,
  PlanGraphNode,
  PlanView,
  PullRequestDetail,
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
  };
}
