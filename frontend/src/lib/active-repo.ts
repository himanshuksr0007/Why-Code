/**
 * The repository in context, on the server.
 *
 * The client keeps the choice in the local profile and mirrors it into a
 * cookie (see `lib/local/profile.ts`) so server-rendered explorer pages can
 * query the same repository without making every route client-side.
 */

import { cookies } from "next/headers";

import {
  ACTIVE_REPO_COOKIE,
  DEFAULT_REPO,
  findRepo,
  isRepoSlug,
} from "@/lib/api";

export { ACTIVE_REPO_COOKIE };

export async function getActiveRepo(): Promise<string> {
  const store = await cookies();
  const value = store.get(ACTIVE_REPO_COOKIE)?.value;
  // Manual repositories are only known to the client, so accept any
  // well-formed slug rather than silently falling back to the default.
  return findRepo(value)?.slug ?? (isRepoSlug(value) ? value : DEFAULT_REPO);
}
