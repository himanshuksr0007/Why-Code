/**
 * HTTP transport for the FastAPI answer service.
 *
 * Endpoints follow the plan (§"API Integration"):
 *   POST /api/v1/ask
 *   GET  /api/v1/evidence/{evidence_id}
 *   GET  /api/v1/decisions/{decision_id}   (detail incl. graph_path)
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
import {
  coerceAudit,
  coerceCitations,
  coerceDecisions,
  coerceEvidenceDetail,
  coerceGraphPath,
  coerceGraph,
  coercePlan,
  coerceRecordsPage,
  coerceSearchResult,
  coerceSupersessions,
  coerceWebhookEvents,
} from "./normalize";
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
          ...(request.client_id ? { client_id: request.client_id } : {}),
          ...(request.model_id ? { model_id: request.model_id } : {}),
          // Only sent for plan asks: why-asks stay byte-identical, so a
          // backend that predates modes never sees a field it rejects.
          ...(request.mode === "plan" ? { mode: "plan" } : {}),
        }),
      });
      const raw = payload as unknown as Record<string, unknown>;
      return {
        ...payload,
        status: (payload.status ?? raw.answer_status ?? "answered") as AskResponse["status"],
        citations: coerceCitations(payload),
        graph_path: coerceGraphPath(payload.graph_path),
        decisions: coerceDecisions(payload.decisions),
        plan: coercePlan(raw.plan),
        structure: raw.structure ? coerceGraph(raw.structure) : null,
        retrieval_trace_id: String(raw.retrieval_trace_id ?? "trace_live"),
        latency_ms: payload.latency_ms ?? Date.now() - startedAt,
      };
    },

    async getEvidence(evidenceId: string): Promise<EvidenceDetail> {
      const payload = await requestJson<Record<string, unknown>>(
        `/api/v1/evidence/${encodeURIComponent(evidenceId)}`,
      );
      return coerceEvidenceDetail(payload, evidenceId);
    },

    async getGraphPath(decisionId: string): Promise<GraphPath> {
      // The backend has no /graph/path route; the decision detail carries
      // the same path as a list of labels, which coerceGraphPath expands.
      const payload = await requestJson<{ graph_path?: unknown }>(
        `/api/v1/decisions/${encodeURIComponent(decisionId)}`,
      );
      const path = coerceGraphPath(payload?.graph_path);
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

    async listRecords(query) {
      const params = new URLSearchParams({ repo: query.repo });
      if (query.q) params.set("q", query.q);
      if (query.status) params.set("status", query.status);
      if (query.kind) params.set("kind", query.kind);
      if (query.target) params.set("target", query.target);
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      if (query.offset !== undefined) params.set("offset", String(query.offset));
      const payload = await requestJson<unknown>(
        `/api/v1/records?${params.toString()}`,
      );
      return coerceRecordsPage(payload);
    },

    async searchRecords(q, repo) {
      const params = new URLSearchParams({ q });
      if (repo) params.set("repo", repo);
      const payload = await requestJson<unknown>(
        `/api/v1/search?${params.toString()}`,
      );
      return coerceSearchResult(payload);
    },

    async listSupersessions(repo) {
      const payload = await requestJson<unknown>(
        `/api/v1/supersessions?repo=${encodeURIComponent(repo)}`,
      );
      return coerceSupersessions(payload);
    },

    async getAudit(repo) {
      const payload = await requestJson<unknown>(
        `/api/v1/audit?repo=${encodeURIComponent(repo)}`,
      );
      const audit = coerceAudit(payload);
      if (!audit) throw new Error("Audit report was empty");
      return audit;
    },

    async listWebhookEvents() {
      const payload = await requestJson<unknown>("/api/v1/webhooks/events");
      return coerceWebhookEvents(payload);
    },

    recordExportUrl(decisionId, repo) {
      return `${API_BASE_URL}/api/v1/records/${encodeURIComponent(decisionId)}/export?repo=${encodeURIComponent(repo)}`;
    },

    async refreshRepo(repo) {
      const payload = await requestJson<{ repo: string; refreshed: boolean }>(
        `/api/v1/repos/refresh?repo=${encodeURIComponent(repo)}`,
        { method: "POST" },
      );
      return payload;
    },
  };
}
