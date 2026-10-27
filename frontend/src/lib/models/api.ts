/**
 * Client for the backend's model-selection API (`/api/v1/models`,
 * `/api/v1/usage`).
 *
 * A visitor is identified by an anonymous client id kept in localStorage.
 * It scopes the visitor's custom models and token usage on the server; it
 * is not an account and carries no personal data.
 */

import { API_BASE_URL } from "@/lib/api/config";

export interface ModelInfo {
  id: string;
  name: string;
  model: string;
  endpoint: string;
  context_tokens: number;
  custom: boolean;
  key_hint?: string;
  created_at?: string;
}

export interface ModelsResponse {
  default: ModelInfo;
  custom: ModelInfo[];
}

export interface UsageInfo {
  model_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  used_tokens: number;
  context_tokens: number;
  percent: number;
  requests: number;
}

export interface CustomModelInput {
  name: string;
  model: string;
  endpoint: string;
  api_key: string;
  context_tokens: number;
}

const CLIENT_ID_KEY = "whycode:client-id";

export function getClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // keep the status-based message
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export function fetchModels(clientId: string): Promise<ModelsResponse> {
  return requestJson<ModelsResponse>(
    `/api/v1/models?client_id=${encodeURIComponent(clientId)}`,
  );
}

export function createCustomModel(
  clientId: string,
  input: CustomModelInput,
): Promise<ModelInfo> {
  return requestJson<ModelInfo>("/api/v1/models/custom", {
    method: "POST",
    body: JSON.stringify({ client_id: clientId, ...input }),
  });
}

export function deleteCustomModel(
  clientId: string,
  modelId: string,
): Promise<{ deleted: boolean }> {
  return requestJson<{ deleted: boolean }>(
    `/api/v1/models/custom/${encodeURIComponent(modelId)}?client_id=${encodeURIComponent(clientId)}`,
    { method: "DELETE" },
  );
}

export function fetchUsage(
  clientId: string,
  modelId: string,
): Promise<UsageInfo> {
  return requestJson<UsageInfo>(
    `/api/v1/usage?client_id=${encodeURIComponent(clientId)}&model_id=${encodeURIComponent(modelId)}`,
  );
}
