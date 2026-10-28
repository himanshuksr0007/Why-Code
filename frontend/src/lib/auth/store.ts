/**
 * The signed-in account session.
 *
 * Accounts are real (see lib/auth/api — the backend stores users in
 * Neo4j and verifies emails with a mailed OTP), but the session itself
 * is a bearer token kept in localStorage like the rest of the app's
 * client state. Guests simply have no session: the whole site keeps
 * working, the Log in / Sign up affordances just stay visible.
 */

import { useSyncExternalStore } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  created_at?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const STORAGE_KEY = "whycode:auth.v1";

let session: AuthSession | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthSession;
      if (parsed && typeof parsed.token === "string" && parsed.user) {
        session = parsed;
      }
    }
  } catch {
    session = null;
  }
}

export function getAuthSession(): AuthSession | null {
  ensureLoaded();
  return session;
}

export function setAuthSession(next: AuthSession): void {
  ensureLoaded();
  session = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full/blocked: the in-memory session still applies.
  }
  emit();
}

export function clearAuthSession(): void {
  ensureLoaded();
  session = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AuthSession | null {
  ensureLoaded();
  return session;
}

function getServerSnapshot(): AuthSession | null {
  return null;
}

export function useAuth(): { user: AuthUser | null; session: AuthSession | null } {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { user: current?.user ?? null, session: current };
}

/** The @handle shown for an account: the email's local part, sanitized. */
export function handleFor(user: AuthUser): string {
  const local = user.email.split("@")[0] ?? "user";
  return local.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "user";
}
