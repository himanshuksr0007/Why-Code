/**
 * Shared chat links.
 *
 * A share publishes a snapshot of a conversation behind a link:
 * - public: anyone with the link can view it;
 * - private: only the owner and whitelisted account handles can —
 *   anonymous viewers are told to log in, signed-in strangers are told
 *   which handle to ask the owner to whitelist.
 *
 * HTTP mode talks to the backend share service (which enforces the
 * rules server-side). Mock mode mirrors the same contract locally so
 * the offline demo still works.
 */

import { API_BASE_URL, API_MODE } from "@/lib/api/config";
import { getAuthSession, handleFor } from "@/lib/auth/store";
import type { Chat, ChatTurn } from "@/lib/chat/store";

export type ShareVisibility = "public" | "private";

export interface ShareTurnSnapshot {
  question: string;
  answer: string;
  answer_status: string;
  repo: string;
  mode: string;
  error: string;
  attachments: { name: string; kind: string; dataUrl?: string }[];
}

export interface ShareMeta {
  id: string;
  chat_id?: string;
  title: string;
  repo: string;
  visibility: ShareVisibility;
  whitelist?: string[];
  owner_name: string;
  owner_handle: string;
  created_at: string;
  updated_at: string;
}

export interface SharedChatView extends ShareMeta {
  turns: ShareTurnSnapshot[];
}

export class ShareApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

/** Normalize a typed username/handle exactly like the backend does. */
export function normalizeHandleInput(value: string): string {
  let text = value.trim().replace(/^@+/, "").toLowerCase();
  if (text.includes("@")) text = text.split("@")[0] ?? "";
  text = text.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return text || "user";
}

export function snapshotTurns(chat: Chat): ShareTurnSnapshot[] {
  return chat.turns.map((turn: ChatTurn) => ({
    question: turn.question,
    answer: turn.response?.answer ?? "",
    answer_status: turn.response?.status ?? "",
    repo: turn.repo,
    mode: turn.mode ?? "",
    error: turn.error ?? "",
    attachments: (turn.attachments ?? []).map((a) => ({
      name: a.name,
      kind: a.kind,
      ...(a.dataUrl ? { dataUrl: a.dataUrl } : {}),
    })),
  }));
}

export function shareUrl(id: string): string {
  return `${window.location.origin}/share/${id}`;
}

/* ------------------------------------------------------------------ */
/* HTTP transport                                                      */
/* ------------------------------------------------------------------ */

async function request<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.auth) {
    const session = getAuthSession();
    if (session) headers.Authorization = `Bearer ${session.token}`;
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ShareApiError(0, "network", "Could not reach the server.");
  }
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as {
    detail?: string;
    code?: string;
  };
  if (!response.ok) {
    throw new ShareApiError(
      response.status,
      payload.code ?? "error",
      payload.detail ?? "Something went wrong.",
    );
  }
  return payload as T;
}

/* ------------------------------------------------------------------ */
/* Mock transport (offline demo): same contract, localStorage-backed   */
/* ------------------------------------------------------------------ */

const MOCK_KEY = "whycode.mock.shares.v1";

interface MockShare extends ShareMeta {
  owner_id: string;
  turns: ShareTurnSnapshot[];
}

function mockLoad(): Record<string, MockShare> {
  try {
    return JSON.parse(window.localStorage.getItem(MOCK_KEY) ?? "{}") as Record<
      string,
      MockShare
    >;
  } catch {
    return {};
  }
}

function mockSave(shares: Record<string, MockShare>): void {
  window.localStorage.setItem(MOCK_KEY, JSON.stringify(shares));
}

function mockRequireUser(): NonNullable<ReturnType<typeof getAuthSession>> {
  const session = getAuthSession();
  if (!session) {
    throw new ShareApiError(401, "login_required", "Log in to share chats.");
  }
  return session;
}

const mockShares = {
  async publish(input: {
    chat: Chat;
    visibility: ShareVisibility;
    whitelist: string[];
  }): Promise<ShareMeta> {
    const session = mockRequireUser();
    const shares = mockLoad();
    const existing = Object.values(shares).find(
      (s) => s.owner_id === session.user.id && s.chat_id === input.chat.id,
    );
    const now = new Date().toISOString();
    const record: MockShare = {
      id: existing?.id ?? Math.random().toString(36).slice(2, 11),
      chat_id: input.chat.id,
      owner_id: session.user.id,
      owner_name: session.user.name,
      owner_handle: handleFor(session.user),
      title: input.chat.title,
      repo: input.chat.repo,
      visibility: input.visibility,
      whitelist: [...new Set(input.whitelist.map(normalizeHandleInput))],
      turns: snapshotTurns(input.chat),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    shares[record.id] = record;
    mockSave(shares);
    return record;
  },

  async myShare(chatId: string): Promise<ShareMeta> {
    const session = mockRequireUser();
    const record = Object.values(mockLoad()).find(
      (s) => s.owner_id === session.user.id && s.chat_id === chatId,
    );
    if (!record) {
      throw new ShareApiError(404, "not_shared", "This chat is not shared yet.");
    }
    return record;
  },

  async unpublish(id: string): Promise<void> {
    const session = mockRequireUser();
    const shares = mockLoad();
    if (shares[id]?.owner_id === session.user.id) {
      delete shares[id];
      mockSave(shares);
    }
  },

  async view(id: string): Promise<SharedChatView> {
    const record = mockLoad()[id];
    if (!record) {
      throw new ShareApiError(404, "not_found", "This link does not exist.");
    }
    if (record.visibility === "private") {
      const session = getAuthSession();
      if (!session) {
        throw new ShareApiError(
          401,
          "login_required",
          "This is a private chat. Log in to view it.",
        );
      }
      const viewerHandle = handleFor(session.user);
      if (
        session.user.id !== record.owner_id &&
        !(record.whitelist ?? []).includes(viewerHandle)
      ) {
        throw new ShareApiError(
          403,
          "not_whitelisted",
          `You are not on this chat's whitelist. Ask the owner to add @${viewerHandle}.`,
        );
      }
    }
    return record;
  },
};

/* ------------------------------------------------------------------ */

export const sharesApi = {
  async publish(input: {
    chat: Chat;
    visibility: ShareVisibility;
    whitelist: string[];
  }): Promise<ShareMeta> {
    if (API_MODE === "mock") return mockShares.publish(input);
    return request<ShareMeta>("/api/v1/shares", {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        chat_id: input.chat.id,
        title: input.chat.title,
        repo: input.chat.repo,
        visibility: input.visibility,
        whitelist: input.whitelist,
        turns: snapshotTurns(input.chat),
      }),
    });
  },

  async myShare(chatId: string): Promise<ShareMeta> {
    if (API_MODE === "mock") return mockShares.myShare(chatId);
    return request<ShareMeta>(
      `/api/v1/shares/by-chat/${encodeURIComponent(chatId)}`,
      { auth: true },
    );
  },

  async unpublish(id: string): Promise<void> {
    if (API_MODE === "mock") return mockShares.unpublish(id);
    await request<void>(`/api/v1/shares/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: true,
    });
  },

  async view(id: string): Promise<SharedChatView> {
    if (API_MODE === "mock") return mockShares.view(id);
    return request<SharedChatView>(`/api/v1/shares/${encodeURIComponent(id)}`, {
      auth: true,
    });
  },
};
