/**
 * The sample-data registry.
 *
 * Every repository in `AVAILABLE_REPOS` has a complete bundle under
 * `./repos/`. The mock transport resolves the bundle from the request's
 * repository, so asking about Starlette never returns httpx evidence.
 */

import { DEFAULT_REPO } from "@/lib/api/config";
import type { EvidenceDetail, PullRequestDetail } from "@/lib/api/types";

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

/**
 * Evidence ids are globally unique (each repository prefixes them), so the
 * evidence sheet can resolve one without knowing which repository it came from.
 */
export const ALL_EVIDENCE: Record<string, EvidenceDetail> = Object.assign(
  {},
  ...Object.values(MOCK_REPOS).map((fixtures) => fixtures.evidence),
);

export function pullRequestFor(
  repo: string,
  number: number,
): PullRequestDetail | undefined {
  return fixturesFor(repo).pullRequests[number];
}

export type { MockAnswer, RepoFixtures } from "./build";
