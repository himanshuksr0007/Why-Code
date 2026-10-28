/**
 * Chat history store.
 *
 * Conversations live in `localStorage` so the sidebar history survives reloads
 * without a backend. The store is read through `useSyncExternalStore`, which
 * keeps the server render (empty) and the hydrated client render in sync
 * without a state-setting effect.
 */

import { useSyncExternalStore } from "react";

import type { AskMode, AskResponse } from "@/lib/api/types";
import { coerceCitations, coerceDecisions, coerceGraphPath } from "@/lib/api/normalize";

/** A file or screenshot the user attached to a question. Text files
 * are inlined into the question sent to the backend; only their
 * metadata is kept on the turn. Images keep a downscaled data URL so
 * the turn can render them after a reload. */
export interface TurnAttachment {
  name: string;
  kind: "text" | "image";
  size: number;
  dataUrl?: string;
}

export interface ChatTurn {
  id: string;
  question: string;
  repo: string;
  asked_at: string;
  /** The ask mode the question was sent with (older turns predate it). */
  mode?: AskMode;
  /** Files/screenshots sent with the question (older turns predate it). */
  attachments?: TurnAttachment[];
  /** `null` while the answer is still being retrieved. */
  response: AskResponse | null;
  error: string | null;
}

export interface Chat {
  id: string;
  title: string;
  repo: string;
  created_at: string;
  updated_at: string;
  turns: ChatTurn[];
}

export interface ChatSnapshot {
  chats: Chat[];
  activeId: string | null;
  /**
   * Bumped by "New chat". The Ask workspace includes it in a component key, so
   * starting a new chat from the entrance remounts the session without a
   * navigation.
   */
  newChatNonce: number;
  hydrated: boolean;
  /** The ephemeral incognito conversation, kept separate from saved chats. */
  incognitoChat: Chat | null;
}

const STORAGE_KEY = "whycode.chats.v1";
const EMPTY_CHATS: Chat[] = [];

const SERVER_SNAPSHOT: ChatSnapshot = {
  chats: EMPTY_CHATS,
  activeId: null,
  newChatNonce: 0,
  hydrated: false,
  incognitoChat: null,
};

let chats: Chat[] = EMPTY_CHATS;
let activeId: string | null = null;
let newChatNonce = 0;
let hydrated = false;
let loaded = false;
let snapshot: ChatSnapshot = SERVER_SNAPSHOT;

const listeners = new Set<() => void>();

/**
 * A private in-memory chat used while incognito mode is enabled. It is never
 * added to `chats` and is therefore never written to localStorage.
 */
let privateChat: Chat | null = null;

function currentSnapshot(): ChatSnapshot {
  return { chats, activeId, newChatNonce, hydrated, incognitoChat: privateChat };
}

function makeId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

function isChat(value: unknown): value is Chat {
  if (!value || typeof value !== "object") return false;
  const chat = value as Partial<Chat>;
  return (
    typeof chat.id === "string" &&
    typeof chat.title === "string" &&
    Array.isArray(chat.turns)
  );
}

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        chats = parsed.filter(isChat).map((chat) => ({
          ...chat,
          // A turn left pending by a reload can never resolve — surface it
          // instead of showing a permanent "Thinking…".
          turns: chat.turns.map((turn) => {
            let response = turn.response;
            if (response) {
              const raw = response as unknown as Record<string, unknown>;
              response = {
                ...response,
                status: (response.status ?? raw.answer_status ?? "answered") as AskResponse["status"],
                citations: coerceCitations(response),
                graph_path: coerceGraphPath(response.graph_path),
                decisions: coerceDecisions(response.decisions),
              };
            }
            return turn.response === null && !turn.error
              ? { ...turn, error: "This answer was interrupted. Ask again." }
              : { ...turn, response };
          }),
        }));
      }
    }
  } catch {
    // Corrupt or unavailable storage: start empty rather than break the app.
  }
  hydrated = true;
  snapshot = currentSnapshot();
}

function emit(): void {
  snapshot = currentSnapshot();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {
      // Quota or private mode: keep the in-memory copy.
    }
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ChatSnapshot {
  ensureLoaded();
  return snapshot;
}

function getServerSnapshot(): ChatSnapshot {
  return SERVER_SNAPSHOT;
}

export function useChatStore(): ChatSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ------------------------------------------------------------------ */
/* Mutations                                                          */
/* ------------------------------------------------------------------ */

export function titleFromQuestion(question: string, max = 64): string {
  const cleaned = question.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function newTurn(
  question: string,
  repo: string,
  mode: AskMode = "why",
  attachments?: TurnAttachment[],
): ChatTurn {
  return {
    id: makeId("turn"),
    question,
    repo,
    asked_at: new Date().toISOString(),
    mode,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
    response: null,
    error: null,
  };
}

export function createIncognitoChat(
  repo: string,
  question: string,
  mode: AskMode = "why",
  attachments?: TurnAttachment[],
): { chat: Chat; turnId: string } {
  ensureLoaded();
  const now = new Date().toISOString();
  const turn = newTurn(question, repo, mode, attachments);
  const chat: Chat = {
    id: makeId("incognito"),
    title: titleFromQuestion(question),
    repo,
    created_at: now,
    updated_at: now,
    turns: [turn],
  };
  privateChat = chat;
  emit();
  return { chat, turnId: turn.id };
}

/** Returns the current private conversation without persisting it. */
export function getIncognitoChat(chatId: string | null): Chat | null {
  return privateChat?.id === chatId ? privateChat : null;
}

/** Append a turn to the ephemeral incognito conversation. */
export function addIncognitoTurn(
  chatId: string,
  question: string,
  repo: string,
  mode: AskMode = "why",
  attachments?: TurnAttachment[],
): string | null {
  if (!privateChat || privateChat.id !== chatId) return null;
  const turn = newTurn(question, repo, mode, attachments);
  privateChat = {
    ...privateChat,
    repo,
    updated_at: turn.asked_at,
    turns: [...privateChat.turns, turn],
  };
  emit();
  return turn.id;
}

/** Resolve a private turn without writing conversation data to storage. */
export function resolveIncognitoTurn(
  chatId: string,
  turnId: string,
  response: AskResponse,
): void {
  if (!privateChat || privateChat.id !== chatId) return;
  privateChat = {
    ...privateChat,
    updated_at: new Date().toISOString(),
    turns: privateChat.turns.map((turn) =>
      turn.id === turnId ? { ...turn, response, error: null } : turn,
    ),
  };
  emit();
}

/** Mark a failed private turn without writing conversation data to storage. */
export function failIncognitoTurn(
  chatId: string,
  turnId: string,
  message: string,
): void {
  if (!privateChat || privateChat.id !== chatId) return;
  privateChat = {
    ...privateChat,
    updated_at: new Date().toISOString(),
    turns: privateChat.turns.map((turn) =>
      turn.id === turnId ? { ...turn, response: null, error: message } : turn,
    ),
  };
  emit();
}

/** Drop the in-memory incognito conversation as soon as private mode ends. */
export function discardIncognitoChat(): void {
  ensureLoaded();
  if (privateChat === null) return;
  if (activeId === privateChat.id) activeId = null;
  privateChat = null;
  emit();
}

/** Create a chat with its first (pending) turn. Returns the fresh chat. */
export function createChat(
  repo: string,
  question: string,
  mode: AskMode = "why",
  attachments?: TurnAttachment[],
): { chat: Chat; turnId: string } {
  ensureLoaded();
  const now = new Date().toISOString();
  const turn = newTurn(question, repo, mode, attachments);
  const chat: Chat = {
    id: makeId("chat"),
    title: titleFromQuestion(question),
    repo,
    created_at: now,
    updated_at: now,
    turns: [turn],
  };
  chats = [chat, ...chats];
  emit();
  return { chat, turnId: turn.id };
}

/** Append a question to an existing chat. Returns the new turn id. */
export function addTurn(
  chatId: string,
  question: string,
  repo: string,
  mode: AskMode = "why",
  attachments?: TurnAttachment[],
): string | null {
  ensureLoaded();
  const turn = newTurn(question, repo, mode, attachments);
  let found = false;
  chats = chats.map((chat) => {
    if (chat.id !== chatId) return chat;
    found = true;
    return {
      ...chat,
      repo,
      updated_at: turn.asked_at,
      turns: [...chat.turns, turn],
    };
  });
  if (!found) return null;
  emit();
  return turn.id;
}

function patchTurn(
  chatId: string,
  turnId: string,
  patch: Pick<ChatTurn, "response" | "error">,
): void {
  chats = chats.map((chat) =>
    chat.id === chatId
      ? {
          ...chat,
          updated_at: new Date().toISOString(),
          turns: chat.turns.map((turn) =>
            turn.id === turnId ? { ...turn, ...patch } : turn,
          ),
        }
      : chat,
  );
  emit();
}

export function resolveTurn(
  chatId: string,
  turnId: string,
  response: AskResponse,
): void {
  patchTurn(chatId, turnId, { response, error: null });
}

export function failTurn(
  chatId: string,
  turnId: string,
  message: string,
): void {
  patchTurn(chatId, turnId, { response: null, error: message });
}

export function deleteChat(chatId: string): void {
  ensureLoaded();
  if (privateChat?.id === chatId) {
    privateChat = null;
    if (activeId === chatId) activeId = null;
    emit();
    return;
  }
  chats = chats.filter((chat) => chat.id !== chatId);
  if (activeId === chatId) activeId = null;
  emit();
}

export function updateChatTitle(chatId: string, newTitle: string): void {
  ensureLoaded();
  if (privateChat?.id === chatId) {
    privateChat = {
      ...privateChat,
      title: newTitle,
      updated_at: new Date().toISOString(),
    };
    emit();
    return;
  }
  chats = chats.map((chat) =>
    chat.id === chatId
      ? {
          ...chat,
          title: newTitle,
          updated_at: new Date().toISOString(),
        }
      : chat,
  );
  emit();
}

export function clearChats(): void {
  ensureLoaded();
  chats = EMPTY_CHATS;
  privateChat = null;
  activeId = null;
  newChatNonce += 1;
  emit();
}

export function setActiveChat(chatId: string | null): void {
  ensureLoaded();
  if (activeId === chatId) return;
  activeId = chatId;
  emit();
}

/** Reset the Ask workspace to the entrance (used by the sidebar). */
export function startNewChat(): void {
  ensureLoaded();
  privateChat = null;
  activeId = null;
  newChatNonce += 1;
  emit();
}
