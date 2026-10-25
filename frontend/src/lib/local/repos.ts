/**
 * Repositories added by hand from the selector.
 *
 * The three bundled repositories come from the server-side catalog and have
 * complete fixture bundles. Anything added here is a real, persisted choice —
 * but it has no index behind it in this demo, so it is shown as "not indexed"
 * and asking is blocked. The store is deliberately client-only: there is no
 * backend endpoint to register a repository yet.
 */

import { useSyncExternalStore } from "react";

import { AVAILABLE_REPOS, isRepoSlug } from "@/lib/api";
import type { RepoOption } from "@/lib/api";

const STORAGE_KEY = "whycode.repos.v1";
const MAX_CUSTOM_REPOS = 8;
const EMPTY: RepoOption[] = [];

let customRepos: RepoOption[] = [];
let loaded = false;
const listeners = new Set<() => void>();

interface RepoCatalogSnapshot {
  repos: RepoOption[];
  customRepos: RepoOption[];
  hydrated: boolean;
}

const SERVER_SNAPSHOT: RepoCatalogSnapshot = {
  repos: AVAILABLE_REPOS,
  customRepos: EMPTY,
  hydrated: false,
};

let snapshot: RepoCatalogSnapshot = SERVER_SNAPSHOT;

function makeRepo(slug: string): RepoOption {
  return {
    slug,
    name: slug.split("/")[1] ?? slug,
    description: "Added manually — not indexed in this demo.",
    indexed: false,
  };
}

function rebuild(): void {
  snapshot = {
    repos: [...AVAILABLE_REPOS, ...customRepos],
    customRepos: [...customRepos],
    hydrated: loaded,
  };
}

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      const seen = new Set<string>();
      customRepos = parsed
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => {
          if (!isRepoSlug(value) || seen.has(value)) return false;
          if (AVAILABLE_REPOS.some((repo) => repo.slug === value)) return false;
          seen.add(value);
          return true;
        })
        .slice(0, MAX_CUSTOM_REPOS)
        .map(makeRepo);
    }
  } catch {
    // Start with no manual repositories.
  }
  rebuild();
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(customRepos.map((repo) => repo.slug)),
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function emit(): void {
  rebuild();
  persist();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RepoCatalogSnapshot {
  ensureLoaded();
  return snapshot;
}

function getServerSnapshot(): RepoCatalogSnapshot {
  return SERVER_SNAPSHOT;
}

export function useRepoCatalog(): RepoCatalogSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export type AddRepoResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

/** Normalises `https://github.com/owner/name.git` → `owner/name`. */
function normalise(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function addRepo(raw: string): AddRepoResult {
  ensureLoaded();
  const slug = normalise(raw);
  if (!slug) {
    return {
      ok: false,
      error: "Enter a repository, for example encode/httpx.",
    };
  }
  if (!isRepoSlug(slug)) {
    return {
      ok: false,
      error: "Use the owner/name form, for example encode/httpx.",
    };
  }
  if (AVAILABLE_REPOS.some((repo) => repo.slug === slug)) {
    return { ok: false, error: `${slug} is already in the list.` };
  }
  if (customRepos.some((repo) => repo.slug === slug)) {
    return { ok: false, error: `${slug} has already been added.` };
  }
  if (customRepos.length >= MAX_CUSTOM_REPOS) {
    return {
      ok: false,
      error: `You can add up to ${MAX_CUSTOM_REPOS} repositories in this demo.`,
    };
  }
  customRepos = [...customRepos, makeRepo(slug)];
  emit();
  return { ok: true, slug };
}

export function removeRepo(slug: string): void {
  ensureLoaded();
  if (!customRepos.some((repo) => repo.slug === slug)) return;
  customRepos = customRepos.filter((repo) => repo.slug !== slug);
  emit();
}
