/**
 * Sidebar width, persisted per browser.
 *
 * Kept in a tiny external store (like the profile) so the rail can be resized
 * from a pointer drag or the keyboard without a state-setting effect and
 * without a hydration mismatch.
 */

import { useSyncExternalStore } from "react";

export const SIDEBAR_MIN = 248;
export const SIDEBAR_MAX = 440;
export const SIDEBAR_DEFAULT = 288;
/** Width of the icon-only rail when the sidebar is minimized. */
export const SIDEBAR_COLLAPSED = 72;

const STORAGE_KEY = "whycode.sidebar.v1";
const COLLAPSE_KEY = "whycode.sidebar.collapsed.v1";

let width = SIDEBAR_DEFAULT;
let collapsed = false;
let loaded = false;
const listeners = new Set<() => void>();

function clamp(value: number): number {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)));
}

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    if (Number.isFinite(parsed)) width = clamp(parsed);
    collapsed = window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    // Start from the default.
  }
}

function emit(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(width));
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // Ignore quota / private-mode failures.
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

function getSnapshot(): number {
  ensureLoaded();
  return width;
}

function getServerSnapshot(): number {
  return SIDEBAR_DEFAULT;
}

export function useSidebarWidth(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setSidebarWidth(next: number): void {
  const clamped = clamp(next);
  if (clamped === width) return;
  width = clamped;
  emit();
}

export function resetSidebarWidth(): void {
  if (width === SIDEBAR_DEFAULT) return;
  width = SIDEBAR_DEFAULT;
  emit();
}

function getCollapsedSnapshot(): boolean {
  ensureLoaded();
  return collapsed;
}

function getServerCollapsedSnapshot(): boolean {
  return false;
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(
    subscribe,
    getCollapsedSnapshot,
    getServerCollapsedSnapshot,
  );
}

export function setSidebarCollapsed(next: boolean): void {
  if (next === collapsed) return;
  collapsed = next;
  emit();
}

export function toggleSidebarCollapsed(): void {
  setSidebarCollapsed(!collapsed);
}
