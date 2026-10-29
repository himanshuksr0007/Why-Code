import { useSyncExternalStore } from "react";

/**
 * Sidebar chat-search state, shared between the header bubble (the
 * Search row + input live there) and the conversations panel (which
 * filters its list). In-memory only, mirroring the incognito store —
 * closing the search clears the query so the full list returns.
 */
interface ChatSearchSnapshot {
  open: boolean;
  query: string;
}

const SERVER_SNAPSHOT: ChatSearchSnapshot = { open: false, query: "" };

let state: ChatSearchSnapshot = SERVER_SNAPSHOT;
let snapshot: ChatSearchSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = state;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ChatSearchSnapshot {
  return snapshot;
}

function getServerSnapshot(): ChatSearchSnapshot {
  return SERVER_SNAPSHOT;
}

export function useChatSearch(): ChatSearchSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setChatSearchOpen(open: boolean): void {
  if (state.open === open) return;
  state = { open, query: open ? state.query : "" };
  emit();
}

export function setChatSearchQuery(query: string): void {
  if (state.query === query) return;
  state = { ...state, query };
  emit();
}

export function closeChatSearch(): void {
  if (!state.open && state.query === "") return;
  state = { open: false, query: "" };
  emit();
}
