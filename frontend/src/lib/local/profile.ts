/**
 * The local user's profile.
 *
 * This is a demo app with no authentication, so "the user" is a locally stored
 * profile: a display name and the repository they are currently exploring.
 * Keeping it in a store means the sidebar, the top bar, the composer and the
 * profile page stay in sync.
 *
 * The selected repository is also mirrored into a cookie so server-rendered
 * pages (`/changes`, `/people`, `/decisions`, `/graph`) can read
 * the same choice. `router.refresh()` after a change re-renders them.
 */

import { useSyncExternalStore } from "react";

import { ACTIVE_REPO_COOKIE, DEFAULT_REPO, isRepoSlug } from "@/lib/api";

export interface LocalProfile {
  display_name: string;
  handle: string;
  default_repo: string;
}

const STORAGE_KEY = "whycode.profile.v1";

const DEFAULT_PROFILE: LocalProfile = {
  display_name: "Sam",
  handle: "sam",
  default_repo: DEFAULT_REPO,
};

let profile: LocalProfile = DEFAULT_PROFILE;
let loaded = false;
const listeners = new Set<() => void>();

function readRepoCookie(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${ACTIVE_REPO_COOKIE}=`;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(prefix));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return null;
  }
}

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    // The cookie is what server components render from, so it is the fallback
    // when this browser has no (or incomplete) stored profile. Otherwise a
    // fresh client could ask about a different repository than the page shows.
    const cookie = readRepoCookie();
    const cookieRepo = isRepoSlug(cookie) ? cookie : DEFAULT_PROFILE.default_repo;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const value = parsed as Partial<LocalProfile>;
        profile = {
          display_name:
            typeof value.display_name === "string" && value.display_name.trim()
              ? value.display_name
              : DEFAULT_PROFILE.display_name,
          handle:
            typeof value.handle === "string" && value.handle.trim()
              ? value.handle
              : DEFAULT_PROFILE.handle,
          default_repo:
            typeof value.default_repo === "string" &&
            isRepoSlug(value.default_repo)
              ? value.default_repo
              : cookieRepo,
        };
      }
    } else {
      profile = { ...profile, default_repo: cookieRepo };
    }
  } catch {
    // Start from the defaults.
  }
}

function writeRepoCookie(repo: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ACTIVE_REPO_COOKIE}=${encodeURIComponent(repo)}; path=/; max-age=31536000; samesite=lax`;
}

function emit(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore quota / private-mode failures.
    }
    writeRepoCookie(profile.default_repo);
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  ensureLoaded();
  if (typeof window !== "undefined") writeRepoCookie(profile.default_repo);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): LocalProfile {
  ensureLoaded();
  return profile;
}

function getServerSnapshot(): LocalProfile {
  return DEFAULT_PROFILE;
}

function getHydratedSnapshot(): boolean {
  ensureLoaded();
  return loaded;
}

function getServerHydratedSnapshot(): boolean {
  return false;
}

export function useLocalProfile(): {
  profile: LocalProfile;
  /** False during SSR and the hydration pass, true once storage was read. */
  hydrated: boolean;
  update: (patch: Partial<LocalProfile>) => void;
  reset: () => void;
} {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const hydrated = useSyncExternalStore(
    subscribe,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  return { profile: current, hydrated, update, reset };
}

export function update(patch: Partial<LocalProfile>): void {
  ensureLoaded();
  profile = { ...profile, ...patch };
  emit();
}

export function reset(): void {
  ensureLoaded();
  profile = DEFAULT_PROFILE;
  emit();
}

/** Convenience for components that only change the repository. */
export function setActiveRepo(slug: string): void {
  if (!isRepoSlug(slug)) return;
  update({ default_repo: slug });
}
