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

function createResilientClient(): WhyCodeClient {
  const mock = createMockClient();
  if (API_MODE !== "http") return mock;

  const http = createHttpClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrap = <T extends (...args: any[]) => Promise<any>>(
    httpFn: T,
    mockFn: T,
  ): T => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (async (...args: any[]) => {
      try {
        return await httpFn(...args);
      } catch {
        return await mockFn(...args);
      }
    }) as T;
  };

  return {
    ask: wrap(http.ask, mock.ask),
    getEvidence: wrap(http.getEvidence, mock.getEvidence),
    getGraphPath: wrap(http.getGraphPath, mock.getGraphPath),
    listDecisions: wrap(http.listDecisions, mock.listDecisions),
    listChanges: wrap(http.listChanges, mock.listChanges),
    listPeople: wrap(http.listPeople, mock.listPeople),
    getPerson: wrap(http.getPerson, mock.getPerson),
    getPullRequest: wrap(http.getPullRequest, mock.getPullRequest),
  };
}

export const api: WhyCodeClient = createResilientClient();

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
