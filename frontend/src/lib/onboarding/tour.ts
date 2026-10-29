import { useSyncExternalStore } from "react";

/**
 * The first-visit product tour's shared state.
 *
 * `seen` persists in localStorage (`whycode:tour.v1`): a brand-new
 * visitor gets the tour once, on the home page. Closing it — Skip,
 * the X, Escape, or finishing — counts as seen; it can be replayed
 * anytime from the profile bubble's menu, which calls `openTour()`.
 *
 * The server snapshot reports `seen: true` so nothing renders (or
 * flashes) before the client has read localStorage.
 */

const SEEN_KEY = "whycode:tour.v1";

export interface TourSnapshot {
  open: boolean;
  seen: boolean;
  hydrated: boolean;
}

const SERVER_SNAPSHOT: TourSnapshot = { open: false, seen: true, hydrated: false };

let open = false;
let seen = true;
let hydrated = false;
let snapshot: TourSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = { open, seen, hydrated };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TourSnapshot {
  return snapshot;
}

function getServerSnapshot(): TourSnapshot {
  return SERVER_SNAPSHOT;
}

export function useTour(): TourSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Read the persisted seen-flag once, on the client. */
export function hydrateTour(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    seen = window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    seen = true; // storage unavailable — never nag
  }
  emit();
}

export function openTour(): void {
  if (open) return;
  open = true;
  emit();
}

/** Close the tour and remember that this visitor has seen it. */
export function dismissTour(): void {
  seen = true;
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // storage unavailable — the tour just won't auto-open next time
    // in this session either, because `seen` is already true.
  }
  if (open) open = false;
  emit();
}
