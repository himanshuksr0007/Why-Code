/**
 * The sample-data registry.
 *
 * Every repository in `AVAILABLE_REPOS` has a complete bundle under
 * `./repos/`. The mock transport resolves the bundle from the request's
 * repository, so asking about Starlette never returns httpx evidence.
 */

import { DEFAULT_REPO, findRepo } from "@/lib/api/config";
import type {
  EvidenceDetail,
  GraphPath,
  PullRequestDetail,
} from "@/lib/api/types";

import type { RepoFixtures } from "./build";
import { fastapiFixtures } from "./repos/fastapi";
import { httpxFixtures } from "./repos/httpx";
import { starletteFixtures } from "./repos/starlette";

export const MOCK_REPOS: Record<string, RepoFixtures> = {
  [httpxFixtures.slug]: httpxFixtures,
  [starletteFixtures.slug]: starletteFixtures,
  [fastapiFixtures.slug]: fastapiFixtures,
};

export function fixturesFor(repo: string | null | undefined): RepoFixtures {
  return (repo && MOCK_REPOS[repo]) || MOCK_REPOS[DEFAULT_REPO] || httpxFixtures;
}

/** Example questions for the repository the visitor is looking at. */
export function exampleQuestionsFor(
  repo: string | null | undefined,
): string[] {
  // Manually added repositories have no fixtures; do not borrow another
  // repository's questions for them.
  if (!findRepo(repo)?.indexed) return [];
  return fixturesFor(repo).questions;
}

/**
 * Evidence ids are globally unique (each repository prefixes them), so the
 * evidence sheet can resolve one without knowing which repository it came from.
 */
export const ALL_EVIDENCE: Record<string, EvidenceDetail> = Object.assign(
  {},
  ...Object.values(MOCK_REPOS).map((fixtures) => fixtures.evidence),
);

export const ALL_GRAPH_PATHS: Record<string, GraphPath> = Object.assign(
  {},
  ...Object.values(MOCK_REPOS).map((fixtures) => fixtures.graphPaths),
);

export function pullRequestFor(
  repo: string,
  number: number,
): PullRequestDetail | undefined {
  return fixturesFor(repo).pullRequests[number];
}

export type { MockAnswer, RepoFixtures } from "./build";
