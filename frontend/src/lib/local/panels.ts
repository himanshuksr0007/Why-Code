/**
 * Mobile conversations-panel visibility.
 *
 * On large screens the conversations panel is always on screen; on small
 * screens it lives behind the top-bar toggle in the app shell, so the open
 * state is shared through this tiny external store (same pattern as the
 * sidebar store). Session-only: the panel starts closed on every load.
 */

import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return open;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useConversationsOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setConversationsOpen(next: boolean): void {
  if (next === open) return;
  open = next;
  emit();
}

export function toggleConversations(): void {
  setConversationsOpen(!open);
}
