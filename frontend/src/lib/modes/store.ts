/**
 * Ask-mode store.
 *
 * One shared store (read through `useSyncExternalStore`, like the model
 * store) so the hero composer, the conversation toolbar and the ask flow
 * never disagree about the active mode. The choice persists in
 * localStorage; the server render assumes the default, "why".
 *
 * - "why": explain from the evidence (the original behaviour).
 * - "plan": draft an implementation plan — timeline table + connection
 *   graph — from the same retrieval.
 */

"use client";

import { useSyncExternalStore } from "react";

import type { AskMode } from "@/lib/api/types";

const STORAGE_KEY = "whycode:mode";
const DEFAULT_MODE: AskMode = "why";

let mode: AskMode = DEFAULT_MODE;
let loaded = false;
const listeners = new Set<() => void>();

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "plan" || raw === "why") mode = raw;
  } catch {
    // Storage unavailable: the default stands.
  }
}

function subscribe(listener: () => void): () => void {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AskMode {
  ensureLoaded();
  return mode;
}

function getServerSnapshot(): AskMode {
  return DEFAULT_MODE;
}

/** The active mode, read imperatively (e.g. inside the ask flow). */
export function getMode(): AskMode {
  ensureLoaded();
  return mode;
}

export function setMode(next: AskMode): void {
  ensureLoaded();
  if (mode === next) return;
  mode = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode etc. — the choice just won't survive a reload.
  }
  for (const listener of listeners) listener();
}

export function useMode(): AskMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
