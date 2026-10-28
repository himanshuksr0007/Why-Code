/**
 * Runtime API configuration.
 *
 * `NEXT_PUBLIC_API_MODE` selects the transport:
 *   - `mock` (default) — in-memory fixtures, so the UI runs before the
 *     retrieval service (Component 5) exists.
 *   - `http` — talk to the FastAPI answer service.
 *
 * Only `NEXT_PUBLIC_*` variables are readable in the browser; they are
 * inlined at build time.
 */

export type ApiMode = "mock" | "http";

export const API_MODE: ApiMode =
  process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

/** The default repository, used until the visitor picks another one. */
export const TARGET_REPO = process.env.NEXT_PUBLIC_REPO ?? "encode/httpx";

/**
 * Cookie that mirrors the selected repository, so server components can read
 * the same choice as the client store.
 */
export const ACTIVE_REPO_COOKIE = "whycode_repo";

export interface RepoOption {
  slug: string;
  /** Short display name, e.g. `httpx`. */
  name: string;
  /** One-line description shown in the repository menu. */
  description: string;
  /** Whether the repository has an index behind it. */
  indexed: boolean;
}

/**
 * Repositories offered by the selector. Each one ships a complete fixture
 * bundle in `lib/mock/repos/` (questions, answers, decisions, changes, people),
 * so switching repositories changes the whole experience rather than just the
 * label.
 */
const REPO_CATALOG: RepoOption[] = [
  {
    slug: "encode/httpx",
    name: "httpx",
    description: "HTTP client — retries, timeouts and proxy handling",
    indexed: true,
  },
  {
    slug: "encode/starlette",
    name: "Starlette",
    description: "ASGI framework — routing, middleware and lifespan",
    indexed: true,
  },
  {
    slug: "tiangolo/fastapi",
    name: "FastAPI",
    description: "Web framework — dependencies, validation and routing",
    indexed: true,
  },
];

export const AVAILABLE_REPOS: RepoOption[] = REPO_CATALOG.some(
  (repo) => repo.slug === TARGET_REPO,
)
  ? REPO_CATALOG
  : [
      {
        slug: TARGET_REPO,
        name: TARGET_REPO,
        // No invented description: the rail card fetches the repo's
        // real GitHub "About" text, and shows nothing until it has it.
        description: "",
        indexed: true,
      },
      ...REPO_CATALOG,
    ];

/** The repository used when the visitor has not chosen one yet. */
export const DEFAULT_REPO =
  findRepo(TARGET_REPO)?.slug ?? AVAILABLE_REPOS[0].slug;

export function findRepo(
  slug: string | null | undefined,
): RepoOption | undefined {
  if (!slug) return undefined;
  const match = AVAILABLE_REPOS.find((repo) => repo.slug === slug);
  if (match) return match;
  if (API_MODE === "http" && typeof slug === "string" && slug.includes("/") && !slug.includes("..")) {
    return {
      slug,
      name: slug.split("/")[1] || slug,
      description: "",
      indexed: true,
    };
  }
  return undefined;
}

const REPO_SLUG_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/**
 * True for anything shaped like `owner/name`.
 *
 * Repositories can also be added manually from the selector. Those live in a
 * client store (they have no server-side index), so this is the only check the
 * profile and the active-repo cookie can apply to them.
 */
export function isRepoSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 140 &&
    REPO_SLUG_PATTERN.test(value) &&
    !value.includes("..")
  );
}

export function repoName(slug: string | null | undefined): string {
  return findRepo(slug)?.name ?? slug ?? DEFAULT_REPO;
}
