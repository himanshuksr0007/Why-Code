"use client";

import { useSyncExternalStore } from "react";

/**
 * The haptics on/off preference. Enabled by default; stored on this
 * device only (`whycode:haptics`), same pattern as the mode store.
 */

const KEY = "whycode:haptics";
const listeners = new Set<() => void>();

function readStored(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function hapticsEnabled(): boolean {
  return readStored();
}

export function setHapticsEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(KEY, enabled ? "on" : "off");
  } catch {
    // Storage unavailable (private mode): the choice just won't persist.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHapticsEnabled(): boolean {
  return useSyncExternalStore(subscribe, readStored, () => true);
}
