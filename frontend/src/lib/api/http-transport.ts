/**
 * HTTP transport for the FastAPI answer service.
 *
 * Endpoints follow the plan (§"API Integration"):
 *   POST /api/v1/ask
 *   GET  /api/v1/evidence/{evidence_id}
 *
 *
 *   GET /api/v1/people?repo=
 *   GET /api/v1/people/{login}?repo=
 *   GET /api/v1/changes?repo=[&limit=]
 *   GET /api/v1/pull-requests/{number}?repo=
 */

import { API_BASE_URL } from "./config";
import {
  coerceCitations,
  coerceDecisions,
  coerceEvidenceDetail,
  coerceGraphPath,
  coerceGraph,
  coercePlan,
} from "./normalize";
import type {
  AskRequest,
  AskResponse,
  CodeChange,
  EvidenceDetail,
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
    // Prefer the backend's own explanation (FastAPI `detail`), e.g. "try
    // again in a moment", over a bare status line.
    let detail: string | undefined;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail.trim()) detail = body.detail;
    } catch {
      // Non-JSON error body: fall back to the status line.
    }
    throw new Error(
      detail ??
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
