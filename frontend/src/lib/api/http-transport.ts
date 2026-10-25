/**
 * HTTP transport for the FastAPI answer service.
 *
 * Endpoints follow the plan (§"API Integration"):
 *   POST /api/v1/ask
 *   GET  /api/v1/evidence/{evidence_id}
 *   GET  /api/v1/graph/path/{decision_id}
 *
 * The following are UI-driven extensions: the decision timeline needs more than
 * a single answer returns, and the people / changes screens need attribution
 * data. Until the backend documents them they target the paths below. Treat
 * them as provisional — only this file changes if the real routes differ.
 *
 *   GET /api/v1/decisions?repo=
 *   GET /api/v1/people?repo=
 *   GET /api/v1/people/{login}?repo=
 *   GET /api/v1/changes?repo=[&limit=]
 *   GET /api/v1/pull-requests/{number}?repo=
 */

import { API_BASE_URL } from "./config";
import { coerceGraphPath } from "./normalize";
import type {
  AskRequest,
  AskResponse,
  CodeChange,
  DecisionThread,
  EvidenceDetail,
  GraphPath,
  PersonProfile,
  PersonSummary,
  PullRequestDetail,
  WhyCodeClient,
} from "./types";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(
      `Why-Code API ${path} failed: ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as T;
}

export function createHttpClient(): WhyCodeClient {
  return {
    async ask(request: AskRequest): Promise<AskResponse> {
      const startedAt = Date.now();
      const payload = await requestJson<AskResponse>("/api/v1/ask", {
        method: "POST",
        body: JSON.stringify({
          question: request.question,
          repo: request.repo,
          max_evidence_items: request.max_evidence_items ?? 8,
          include_graph_path: request.include_graph_path ?? true,
        }),
      });
      return {
        ...payload,
        graph_path: coerceGraphPath(payload.graph_path),
        latency_ms: payload.latency_ms ?? Date.now() - startedAt,
      };
    },

    getEvidence(evidenceId: string): Promise<EvidenceDetail> {
      return requestJson<EvidenceDetail>(
        `/api/v1/evidence/${encodeURIComponent(evidenceId)}`,
      );
    },

    async getGraphPath(decisionId: string): Promise<GraphPath> {
      const payload = await requestJson<unknown>(
        `/api/v1/graph/path/${encodeURIComponent(decisionId)}`,
      );
      const path = coerceGraphPath(payload);
      if (!path) {
        throw new Error(`No graph path found for decision ${decisionId}`);
      }
      return path;
    },

    listDecisions(repo: string): Promise<DecisionThread[]> {
      return requestJson<DecisionThread[]>(
        `/api/v1/decisions?repo=${encodeURIComponent(repo)}`,
      );
    },

    listPeople(repo: string): Promise<PersonSummary[]> {
      return requestJson<PersonSummary[]>(
        `/api/v1/people?repo=${encodeURIComponent(repo)}`,
      );
    },

    getPerson(repo: string, login: string): Promise<PersonProfile> {
      return requestJson<PersonProfile>(
        `/api/v1/people/${encodeURIComponent(login)}?repo=${encodeURIComponent(repo)}`,
      );
    },

    listChanges(repo: string, limit?: number): Promise<CodeChange[]> {
      const query = new URLSearchParams({ repo });
      if (limit !== undefined) query.set("limit", String(limit));
      return requestJson<CodeChange[]>(`/api/v1/changes?${query.toString()}`);
    },

    getPullRequest(repo: string, number: number): Promise<PullRequestDetail> {
      return requestJson<PullRequestDetail>(
        `/api/v1/pull-requests/${number}?repo=${encodeURIComponent(repo)}`,
      );
    },
  };
}
