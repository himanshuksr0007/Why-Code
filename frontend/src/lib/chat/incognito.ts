import { useSyncExternalStore } from "react";

interface IncognitoSnapshot {
  enabled: boolean;
}

const SERVER_SNAPSHOT: IncognitoSnapshot = { enabled: false };

let enabled = false;
let snapshot: IncognitoSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = { enabled };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): IncognitoSnapshot {
  return snapshot;
}

function getServerSnapshot(): IncognitoSnapshot {
  return SERVER_SNAPSHOT;
}

export function useIncognitoMode(): IncognitoSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setIncognitoMode(nextEnabled: boolean): void {
  if (enabled === nextEnabled) return;
  enabled = nextEnabled;
  emit();
}

export function toggleIncognitoMode(): void {
  setIncognitoMode(!enabled);
}
