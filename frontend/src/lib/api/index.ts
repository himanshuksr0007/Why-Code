/**
 * The single entry point the UI talks to.
 *
 * `api` is a `WhyCodeClient` whose implementation is chosen by
 * `NEXT_PUBLIC_API_MODE` (see `config.ts`). Components depend on the
 * interface and share it across live and offline modes.
 */

import { API_MODE } from "./config";
import { createHttpClient } from "./http-transport";
import { createMockClient } from "./mock-transport";
import type { WhyCodeClient } from "./types";

function createClient(): WhyCodeClient {
  if (API_MODE !== "http") {
    return createMockClient();
  }
  return createHttpClient();
}

export const api: WhyCodeClient = createClient();

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
export { coerceEvidenceDetail, coerceGraphPath } from "./normalize";
export * from "./types";
