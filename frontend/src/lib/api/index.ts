/**
 * The single entry point the UI talks to.
 *
 * `api` is a `WhyCodeClient` whose implementation is chosen by
 * `NEXT_PUBLIC_API_MODE` (see `config.ts`). Components depend on the
 * interface, never on a transport, so switching to the live backend later
 * requires no component changes.
 */

import { API_MODE } from "./config";
import { createHttpClient } from "./http-transport";
import { createMockClient } from "./mock-transport";
import type { WhyCodeClient } from "./types";

export const api: WhyCodeClient =
  API_MODE === "http" ? createHttpClient() : createMockClient();

export {
  ACTIVE_REPO_COOKIE,
  API_BASE_URL,
  API_MODE,
  AVAILABLE_REPOS,
  DEFAULT_REPO,
  findRepo,
  isRepoSlug,
  repoName,
  TARGET_REPO,
} from "./config";
export type { RepoOption } from "./config";
export type { ApiMode } from "./config";
export { coerceGraphPath } from "./normalize";
export * from "./types";
