/**
 * Sample fixtures for `tiangolo/fastapi`.
 *
 * Illustrative only — see `lib/mock/build.ts`. The reasoning shown here is
 * written to read like the real discussion; it is not a source of truth.
 */

import type {
  CodeChange,
  Decision,
  EvidenceDetail,
  GraphPath,
  PullRequestDetail,
} from "@/lib/api/types";
import {
  chain,
  commit,
  derivePeople,
  directory,
  file,
  makeCiter,
  origin,
  prRef,
  pullRequest,
  reversal,
  sortChanges,
  thread,
} from "@/lib/mock/build";
import type { MockAnswer, RepoFixtures } from "@/lib/mock/build";

export const REPO = "tiangolo/fastapi";

const NAMES: Record<string, string> = {
  tiangolo: "Sebastián Ramírez",
  Kludex: "Marcelo Trylesinski",
  dmontagu: "David Montague",
  Mause: "Mause",
  davidbrochart: "David Brochart",
};

const TAGS: Record<string, string[]> = {
  tiangolo: ["Maintainer"],
  Kludex: ["Maintainer"],
  dmontagu: ["Maintainer"],
  Mause: ["Maintainer"],
  davidbrochart: ["Contributor"],
};

const { dir, person, participant } = directory(NAMES, TAGS);

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

const evidence: Record<string, EvidenceDetail> = {
  "fastapi:review_comment:1097": {
    evidence_id: "fastapi:review_comment:1097",
    record_type: "review_comment",
    source_type: "review_comment",
    repo: REPO,
    pr_number: 1097,
    author: "tiangolo",
    created_at: "2019-08-06T15:12:00Z",
    url: "https://github.com/tiangolo/fastapi/pull/1097#discussion_r1097",
    title: "re: solving shared dependencies",
    excerpt:
      "A dependency that opens a session should be solved once per request, not once per parameter that asks for it. Key the cache by the callable and its security scopes.",
    body:
      "A dependency that opens a session should be solved once per request, not once per parameter that asks for it.\n\nKey the cache by the callable and its security scopes, and let a dependency opt out with `use_cache=False` when it must run every time.",
    payload: {
      path: "fastapi/dependencies/utils.py",
      line: 320,
      start_line: 312,
      side: "RIGHT",
    },
  },
  "fastapi:commit:8f1a2b3": {
    evidence_id: "fastapi:commit:8f1a2b3",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 1097,
    author: "tiangolo",
    created_at: "2019-08-08T09:24:00Z",
    url: "https://github.com/tiangolo/fastapi/commit/8f1a2b3",
    title: "Cache solved dependencies per request",
    excerpt:
      "solve_dependencies writes each sub-dependency result to a request-scoped cache unless use_cache is disabled.",
    payload: {
      sha: "8f1a2b3",
      files: [
        {
          filename: "fastapi/dependencies/utils.py",
          additions: 40,
          deletions: 8,
        },
      ],
    },
  },
  "fastapi:pr:1097": {
    evidence_id: "fastapi:pr:1097",
    record_type: "pull_request",
    source_type: "pull_request",
    repo: REPO,
    pr_number: 1097,
    author: "tiangolo",
    created_at: "2019-08-08T10:05:00Z",
    url: "https://github.com/tiangolo/fastapi/pull/1097",
    title: "Cache dependencies per request by default",
    excerpt:
      "A dependency shared by several parameters is solved once per request unless it declares use_cache=False.",
    payload: { number: 1097, merged: true, files_changed: 3 },
  },
  "fastapi:issue:1729": {
    evidence_id: "fastapi:issue:1729",
    record_type: "issue",
    source_type: "issue",
    repo: REPO,
    pr_number: null,
    author: "davidbrochart",
    created_at: "2020-07-14T08:40:00Z",
    url: "https://github.com/tiangolo/fastapi/issues/1729",
    title: "A shared dependency opens the database session twice",
    excerpt:
      "A dependency shared by two routers is executed twice in the same request, so the database session is opened twice.",
    payload: { number: 1729, state: "closed" },
  },
  "fastapi:issue_comment:3312": {
    evidence_id: "fastapi:issue_comment:3312",
    record_type: "issue_comment",
    source_type: "issue_comment",
    repo: REPO,
    pr_number: null,
    author: "Kludex",
    created_at: "2020-07-15T11:30:00Z",
    url: "https://github.com/tiangolo/fastapi/issues/1729#issuecomment-3312",
    title: "re: dependency execution count",
    excerpt:
      "The cache is intentionally per request. A process-wide cache would keep sessions and request state alive across users.",
    payload: { issue_number: 1729, author_association: "MEMBER" },
  },
  "fastapi:doc:docs/en/docs/tutorial/dependencies/index.md": {
    evidence_id: "fastapi:doc:docs/en/docs/tutorial/dependencies/index.md",
    record_type: "doc_file",
    source_type: "doc_file",
    repo: REPO,
    pr_number: null,
    author: null,
    created_at: null,
    url: "https://github.com/tiangolo/fastapi/blob/master/docs/en/docs/tutorial/dependencies/index.md",
    title: "docs/en/docs/tutorial/dependencies/index.md",
    excerpt:
      "Tutorial page on declaring dependencies, sharing them across path operations and disabling the per-request cache with use_cache=False.",
    payload: {
      path: "docs/en/docs/tutorial/dependencies/index.md",
    },
  },
  "fastapi:review_comment:1163": {
    evidence_id: "fastapi:review_comment:1163",
    record_type: "review_comment",
    source_type: "review_comment",
    repo: REPO,
    pr_number: 1163,
    author: "tiangolo",
    created_at: "2019-09-16T13:05:00Z",
    url: "https://github.com/tiangolo/fastapi/pull/1163#discussion_r1163",
    title: "re: response filtering",
    excerpt:
      "The value is already validated, but that is not the point. The response model is a contract: validating on the way out is what stops internal fields from leaking.",
    body:
      "The value is already validated, but that is not the point. The response model is a contract between the application and its clients.\n\nValidating on the way out is what stops internal fields from leaking when a handler returns an ORM object or a database row.",
    payload: {
      path: "fastapi/routing.py",
      line: 260,
      start_line: 248,
      side: "RIGHT",
    },
  },
  "fastapi:commit:4c9d1e7": {
    evidence_id: "fastapi:commit:4c9d1e7",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 1163,
    author: "tiangolo",
    created_at: "2019-09-18T16:48:00Z",
    url: "https://github.com/tiangolo/fastapi/commit/4c9d1e7",
    title: "Serialize responses through the response model field",
    excerpt:
      "serialize_response now validates the returned value against the response field before encoding it.",
    payload: {
      sha: "4c9d1e7",
      files: [
        { filename: "fastapi/routing.py", additions: 28, deletions: 11 },
      ],
    },
  },
  "fastapi:pr:1163": {
    evidence_id: "fastapi:pr:1163",
    record_type: "pull_request",
    source_type: "pull_request",
    repo: REPO,
    pr_number: 1163,
    author: "tiangolo",
    created_at: "2019-09-19T09:15:00Z",
    url: "https://github.com/tiangolo/fastapi/pull/1163",
    title: "Validate response data against response_model",
    excerpt:
      "Return values are filtered through response_model instead of being serialized as-is.",
    payload: { number: 1163, merged: true, files_changed: 2 },
  },
  "fastapi:commit:6a2d8c0": {
    evidence_id: "fastapi:commit:6a2d8c0",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 47,
    author: "tiangolo",
    created_at: "2019-01-09T18:20:00Z",
    url: "https://github.com/tiangolo/fastapi/commit/6a2d8c0",
    title: "Add startup and shutdown event handlers",
    excerpt:
      "Application lifecycle hooks are registered as startup and shutdown event callbacks on the router.",
    payload: {
      sha: "6a2d8c0",
      files: [
        {
          filename: "fastapi/applications.py",
          additions: 26,
          deletions: 2,
        },
      ],
    },
  },
  "fastapi:pr:47": {
    evidence_id: "fastapi:pr:47",
    record_type: "pull_request",
    source_type: "pull_request",
    repo: REPO,
    pr_number: 47,
    author: "tiangolo",
    created_at: "2019-01-10T08:00:00Z",
    url: "https://github.com/tiangolo/fastapi/pull/47",
    title: "Add startup and shutdown events",
    excerpt:
      "Adds on_startup and on_shutdown hooks so applications can open and close resources around their lifetime.",
    payload: { number: 47, merged: true, files_changed: 2 },
  },
  "fastapi:review_comment:4873": {
    evidence_id: "fastapi:review_comment:4873",
    record_type: "review_comment",
    source_type: "review_comment",
    repo: REPO,
    pr_number: 4873,
    author: "Kludex",
    created_at: "2022-09-27T10:42:00Z",
    url: "https://github.com/tiangolo/fastapi/pull/4873#discussion_r4873",
    title: "re: lifespan ordering",
    excerpt:
      "A context manager gives setup and teardown a single scope. A resource created during startup is then guaranteed to be available for the whole application lifetime and closed exactly once.",
    body:
      "A context manager gives setup and teardown a single scope. A resource created during startup is then guaranteed to be available for the whole application lifetime and closed exactly once.\n\nIt also makes teardown run when startup fails part-way through, which the separate event hooks never modelled.",
    payload: {
      path: "fastapi/applications.py",
      line: 340,
      start_line: 332,
      side: "RIGHT",
    },
  },
  "fastapi:commit:2b7e4f9": {
    evidence_id: "fastapi:commit:2b7e4f9",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 4873,
    author: "dmontagu",
    created_at: "2022-09-29T14:10:00Z",
    url: "https://github.com/tiangolo/fastapi/commit/2b7e4f9",
    title: "Add lifespan context manager support",
    excerpt:
      "Starlette's lifespan replaces the deprecated startup and shutdown events; FastAPI forwards a lifespan and keeps on_event for compatibility.",
    payload: {
      sha: "2b7e4f9",
      files: [
        {
          filename: "fastapi/applications.py",
          additions: 34,
          deletions: 18,
        },
      ],
    },
  },
  "fastapi:pr:4873": {
    evidence_id: "fastapi:pr:4873",
    record_type: "pull_request",
    source_type: "pull_request",
    repo: REPO,
    pr_number: 4873,
    author: "dmontagu",
    created_at: "2022-09-30T08:30:00Z",
    url: "https://github.com/tiangolo/fastapi/pull/4873",
    title: "Add lifespan support and deprecate startup/shutdown events",
    excerpt:
      "Adds a lifespan argument to FastAPI and routes it through Starlette's router while keeping on_event as a deprecated shim.",
    payload: { number: 4873, merged: true, files_changed: 4 },
  },
  "fastapi:issue:2905": {
    evidence_id: "fastapi:issue:2905",
    record_type: "issue",
    source_type: "issue",
    repo: REPO,
    pr_number: null,
    author: "Mause",
    created_at: "2021-04-13T09:55:00Z",
    url: "https://github.com/tiangolo/fastapi/issues/2905",
    title: "Background task failures are invisible to the client",
    excerpt:
      "If a background task raises, the client already has a 200 response and has no way to observe the failure.",
    payload: { number: 2905, state: "open" },
  },
  "fastapi:issue_comment:4901": {
    evidence_id: "fastapi:issue_comment:4901",
    record_type: "issue_comment",
    source_type: "issue_comment",
    repo: REPO,
    pr_number: null,
    author: "tiangolo",
    created_at: "2022-10-04T17:18:00Z",
    url: "https://github.com/tiangolo/fastapi/issues/2905#issuecomment-4901",
    title: "re: background task failures",
    excerpt:
      "That is the contract: the response is sent before the task runs. Use a queue or a monitoring hook if you need delivery guarantees.",
    payload: { issue_number: 2905, author_association: "OWNER" },
  },
  "fastapi:commit:3d5c9a1": {
    evidence_id: "fastapi:commit:3d5c9a1",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 834,
    author: "tiangolo",
    created_at: "2020-05-20T15:40:00Z",
    url: "https://github.com/tiangolo/fastapi/commit/3d5c9a1",
    title: "Await background tasks after the response",
    excerpt:
      "BackgroundTasks is attached to the response and awaited after the body has been sent, so tasks never delay the client.",
    payload: {
      sha: "3d5c9a1",
      files: [
        { filename: "fastapi/background.py", additions: 24, deletions: 0 },
      ],
    },
  },
  "fastapi:pr:834": {
    evidence_id: "fastapi:pr:834",
    record_type: "pull_request",
    source_type: "pull_request",
    repo: REPO,
    pr_number: 834,
    author: "tiangolo",
    created_at: "2020-05-20T16:05:00Z",
    url: "https://github.com/tiangolo/fastapi/pull/834",
    title: "Run background tasks after the response is sent",
    excerpt:
      "Background tasks are attached to the response and run after the client has received it.",
    payload: { number: 834, merged: true, files_changed: 2 },
  },
  "fastapi:doc:docs/en/docs/advanced/events.md": {
    evidence_id: "fastapi:doc:docs/en/docs/advanced/events.md",
    record_type: "doc_file",
    source_type: "doc_file",
    repo: REPO,
    pr_number: null,
    author: null,
    created_at: null,
    url: "https://github.com/tiangolo/fastapi/blob/master/docs/en/docs/advanced/events.md",
    title: "docs/en/docs/advanced/events.md",
    excerpt:
      "Lifespan events documentation: one async context manager for setup and teardown, with on_event marked deprecated.",
    payload: { path: "docs/en/docs/advanced/events.md" },
  },
};

const cite = makeCiter(evidence);

/* ------------------------------------------------------------------ */
/* Decisions                                                           */
/* ------------------------------------------------------------------ */

const decisions: Record<string, Decision> = {
  dec_fastapi_depends_cache: {
    decision_id: "dec_fastapi_depends_cache",
    title: "Dependency results are cached per request",
    claim:
      "A solved dependency is reused within one request by default, so a callable shared by several parameters runs once unless use_cache is disabled.",
    status: "active",
    confidence: "high",
    pr_number: 1097,
    created_at: "2019-08-08T09:24:00Z",
    targets: [
      { type: "Symbol", identifier: "fastapi.dependencies.utils.solve_dependencies" },
      { type: "ConfigKey", identifier: "use_cache" },
    ],
    evidence_ids: [
      "fastapi:review_comment:1097",
      "fastapi:commit:8f1a2b3",
      "fastapi:pr:1097",
      "fastapi:issue:1729",
    ],
  },
  dec_fastapi_response_model_revalidate: {
    decision_id: "dec_fastapi_response_model_revalidate",
    title: "response_model validates and filters outgoing data",
    claim:
      "The return value is validated again against response_model, so only fields declared by the output model cross the wire even when the handler returns an ORM object.",
    status: "active",
    confidence: "high",
    pr_number: 1163,
    created_at: "2019-09-19T09:15:00Z",
    targets: [
      { type: "Symbol", identifier: "fastapi.routing.serialize_response" },
      { type: "ConfigKey", identifier: "response_model" },
    ],
    evidence_ids: [
      "fastapi:review_comment:1163",
      "fastapi:commit:4c9d1e7",
      "fastapi:pr:1163",
    ],
  },
  dec_fastapi_startup_events: {
    decision_id: "dec_fastapi_startup_events",
    title: "Startup and shutdown events own the application lifecycle",
    claim:
      "Resources are created in a startup event handler and torn down in a shutdown handler.",
    status: "reversed",
    confidence: "medium",
    pr_number: 47,
    created_at: "2019-01-10T08:00:00Z",
    targets: [
      { type: "Symbol", identifier: "fastapi.FastAPI.add_event_handler" },
      { type: "ConfigKey", identifier: "on_event" },
    ],
    evidence_ids: ["fastapi:commit:6a2d8c0", "fastapi:pr:47"],
    superseded_by: "dec_fastapi_lifespan",
  },
  dec_fastapi_lifespan: {
    decision_id: "dec_fastapi_lifespan",
    title: "A lifespan context manager replaces startup and shutdown events",
    claim:
      "Application setup and teardown share one async context manager, so a resource has a single scope and is closed exactly once.",
    status: "active",
    confidence: "high",
    pr_number: 4873,
    created_at: "2022-09-30T08:30:00Z",
    targets: [
      { type: "Symbol", identifier: "fastapi.FastAPI.__init__" },
      { type: "Symbol", identifier: "fastapi.routing.APIRouter.lifespan_context" },
    ],
    evidence_ids: [
      "fastapi:review_comment:4873",
      "fastapi:commit:2b7e4f9",
      "fastapi:pr:4873",
      "fastapi:doc:docs/en/docs/advanced/events.md",
    ],
    supersedes: "dec_fastapi_startup_events",
  },
  dec_fastapi_background_tasks: {
    decision_id: "dec_fastapi_background_tasks",
    title: "Background tasks run after the response is sent",
    claim:
      "BackgroundTasks are fire-and-forget: they run after the response leaves the server and their failures never reach the client.",
    status: "contested",
    confidence: "low",
    pr_number: 834,
    created_at: "2020-05-20T16:05:00Z",
    targets: [
      { type: "Symbol", identifier: "fastapi.background.BackgroundTasks" },
      { type: "Symbol", identifier: "starlette.background.BackgroundTask" },
    ],
    evidence_ids: [
      "fastapi:issue:2905",
      "fastapi:issue_comment:4901",
      "fastapi:commit:3d5c9a1",
      "fastapi:pr:834",
    ],
    missing_evidence: [
      "No maintainer review decides whether task errors should be surfaced through a hook.",
    ],
  },
};

const threads = [
  thread("thread_depends_cache", "Dependency caching", [
    origin(decisions.dec_fastapi_depends_cache),
  ]),
  thread("thread_lifespan", "Application lifecycle hooks", [
    origin(decisions.dec_fastapi_startup_events),
    reversal(decisions.dec_fastapi_lifespan),
  ]),
  thread("thread_background_tasks", "Background task semantics", [
    origin(decisions.dec_fastapi_background_tasks),
  ]),
];

/* ------------------------------------------------------------------ */
/* Graph paths                                                         */
/* ------------------------------------------------------------------ */

const graphPaths: Record<string, GraphPath> = {
  dec_fastapi_depends_cache: chain(
    [
      ["key", "ConfigKey", "use_cache = True"],
      ["sym", "Symbol", "fastapi.dependencies.utils.solve_dependencies"],
      ["reg", "CodeRegion", "fastapi/dependencies/utils.py:312-352"],
      ["commit", "Commit", "8f1a2b3"],
      ["pr", "PullRequest", "#1097"],
      ["dec", "Decision", "dec_fastapi_depends_cache"],
      ["ev", "Evidence", "fastapi:review_comment:1097"],
    ],
    [
      ["key", "sym", "USED_BY"],
      ["sym", "reg", "HAS_REGION"],
      ["commit", "reg", "CHANGED_REGION"],
      ["pr", "commit", "HAS_COMMIT"],
      ["pr", "dec", "HAS_DECISION"],
      ["dec", "ev", "SUPPORTED_BY"],
    ],
  ),
  dec_fastapi_response_model_revalidate: chain(
    [
      ["key", "ConfigKey", "response_model"],
      ["sym", "Symbol", "fastapi.routing.serialize_response"],
      ["reg", "CodeRegion", "fastapi/routing.py:248-278"],
      ["commit", "Commit", "4c9d1e7"],
      ["pr", "PullRequest", "#1163"],
      ["dec", "Decision", "dec_fastapi_response_model_revalidate"],
      ["ev", "Evidence", "fastapi:review_comment:1163"],
    ],
    [
      ["key", "sym", "USED_BY"],
      ["sym", "reg", "HAS_REGION"],
      ["commit", "reg", "CHANGED_REGION"],
      ["pr", "commit", "HAS_COMMIT"],
      ["pr", "dec", "HAS_DECISION"],
      ["dec", "ev", "SUPPORTED_BY"],
    ],
  ),
  dec_fastapi_startup_events: chain(
    [
      ["key", "ConfigKey", "on_event"],
      ["sym", "Symbol", "fastapi.FastAPI.add_event_handler"],
      ["reg", "CodeRegion", "fastapi/applications.py:120-146"],
      ["commit", "Commit", "6a2d8c0"],
      ["pr", "PullRequest", "#47"],
      ["dec", "Decision", "dec_fastapi_startup_events"],
      ["ev", "Evidence", "fastapi:commit:6a2d8c0"],
    ],
    [
      ["key", "sym", "USED_BY"],
      ["sym", "reg", "HAS_REGION"],
      ["commit", "reg", "CHANGED_REGION"],
      ["pr", "commit", "HAS_COMMIT"],
      ["pr", "dec", "HAS_DECISION"],
      ["dec", "ev", "SUPPORTED_BY"],
    ],
  ),
  dec_fastapi_lifespan: chain(
    [
      ["key", "ConfigKey", "lifespan"],
      ["sym", "Symbol", "fastapi.FastAPI.__init__"],
      ["reg", "CodeRegion", "fastapi/applications.py:332-366"],
      ["commit", "Commit", "2b7e4f9"],
      ["pr", "PullRequest", "#4873"],
      ["dec", "Decision", "dec_fastapi_lifespan"],
      ["ev", "Evidence", "fastapi:review_comment:4873"],
    ],
    [
      ["key", "sym", "USED_BY"],
      ["sym", "reg", "HAS_REGION"],
      ["commit", "reg", "CHANGED_REGION"],
      ["pr", "commit", "HAS_COMMIT"],
      ["pr", "dec", "HAS_DECISION"],
      ["dec", "ev", "SUPPORTED_BY"],
    ],
  ),
  dec_fastapi_background_tasks: chain(
    [
      ["key", "ConfigKey", "background_tasks"],
      ["sym", "Symbol", "fastapi.background.BackgroundTasks"],
      ["reg", "CodeRegion", "fastapi/background.py:20-44"],
      ["commit", "Commit", "3d5c9a1"],
      ["pr", "PullRequest", "#834"],
      ["dec", "Decision", "dec_fastapi_background_tasks"],
      ["ev", "Evidence", "fastapi:issue:2905"],
    ],
    [
      ["key", "sym", "USED_BY"],
      ["sym", "reg", "HAS_REGION"],
      ["commit", "reg", "CHANGED_REGION"],
      ["pr", "commit", "HAS_COMMIT"],
      ["pr", "dec", "HAS_DECISION"],
      ["dec", "ev", "SUPPORTED_BY"],
    ],
  ),
};

/* ------------------------------------------------------------------ */
/* Pull requests                                                       */
/* ------------------------------------------------------------------ */

const pullRequests: Record<number, PullRequestDetail> = {
  834: pullRequest({
    number: 834,
    repo: REPO,
    title: "Run background tasks after the response is sent",
    author: person("tiangolo"),
    created_at: "2020-05-18T09:30:00Z",
    merged_at: "2020-05-20T16:05:00Z",
    reviewers: [person("Mause")],
    participants: [
      participant("tiangolo", ["author", "committer"], 4),
      participant("Mause", ["reviewer", "commenter"], 2),
      participant("Kludex", ["commenter"], 1),
    ],
    changed_files: [
      file("fastapi/background.py", "added", 24, 0),
      file("fastapi/routing.py", "modified", 8, 3),
    ],
    commits: [
      commit(
        "3d5c9a1",
        "Await background tasks after the response",
        person("tiangolo"),
        "2020-05-20T15:40:00Z",
      ),
    ],
    decision_ids: ["dec_fastapi_background_tasks"],
    body: "Background tasks are attached to the response and awaited after the body is sent.",
  }),
  1097: pullRequest({
    number: 1097,
    repo: REPO,
    title: "Cache dependencies per request by default",
    author: person("tiangolo"),
    created_at: "2019-08-05T14:00:00Z",
    merged_at: "2019-08-08T09:24:00Z",
    reviewers: [person("dmontagu")],
    participants: [
      participant("tiangolo", ["author", "committer"], 5),
      participant("dmontagu", ["reviewer", "commenter"], 3),
      participant("Mause", ["commenter"], 1),
    ],
    changed_files: [
      file("fastapi/dependencies/utils.py", "modified", 40, 8),
      file("fastapi/params.py", "modified", 12, 2),
      file("tests/test_dependency_cache.py", "added", 60, 0),
    ],
    commits: [
      commit(
        "8f1a2b3",
        "Cache solved dependencies per request",
        person("tiangolo"),
        "2019-08-08T09:24:00Z",
      ),
    ],
    decision_ids: ["dec_fastapi_depends_cache"],
    body: "A dependency shared by several parameters should be solved once per request, with use_cache=False available as an opt-out.",
  }),
  1163: pullRequest({
    number: 1163,
    repo: REPO,
    title: "Validate response data against response_model",
    author: person("tiangolo"),
    created_at: "2019-09-15T10:00:00Z",
    merged_at: "2019-09-19T09:15:00Z",
    reviewers: [person("dmontagu")],
    participants: [
      participant("tiangolo", ["author", "committer"], 6),
      participant("dmontagu", ["reviewer", "commenter"], 4),
      participant("davidbrochart", ["commenter"], 1),
    ],
    changed_files: [
      file("fastapi/routing.py", "modified", 28, 11),
      file("tests/test_response_model.py", "added", 45, 0),
    ],
    commits: [
      commit(
        "4c9d1e7",
        "Serialize responses through the response model field",
        person("tiangolo"),
        "2019-09-18T16:48:00Z",
      ),
    ],
    decision_ids: ["dec_fastapi_response_model_revalidate"],
    body: "Return values must be filtered through response_model, not merely annotated with it.",
  }),
  4873: pullRequest({
    number: 4873,
    repo: REPO,
    title: "Add lifespan support and deprecate startup/shutdown events",
    author: person("dmontagu"),
    created_at: "2022-09-26T09:00:00Z",
    merged_at: "2022-09-30T08:30:00Z",
    reviewers: [person("tiangolo"), person("Kludex")],
    participants: [
      participant("dmontagu", ["author", "committer"], 7),
      participant("tiangolo", ["reviewer", "commenter"], 5),
      participant("Kludex", ["reviewer", "commenter"], 3),
      participant("Mause", ["commenter"], 2),
    ],
    changed_files: [
      file("fastapi/applications.py", "modified", 34, 18),
      file("fastapi/routing.py", "modified", 12, 10),
      file("docs/en/docs/advanced/events.md", "modified", 70, 20),
      file("tests/test_lifespan.py", "added", 80, 0),
    ],
    commits: [
      commit(
        "2b7e4f9",
        "Add lifespan context manager support",
        person("dmontagu"),
        "2022-09-29T14:10:00Z",
      ),
    ],
    decision_ids: ["dec_fastapi_lifespan", "dec_fastapi_startup_events"],
    body: "Adds lifespan=... and routes it through Starlette's router while keeping on_event as a deprecated compatibility shim.",
  }),
};

/* ------------------------------------------------------------------ */
/* Code changes + reasoning                                            */
/* ------------------------------------------------------------------ */

const CHANGE_FIXTURES: CodeChange[] = [
  {
    change_id: "change_fastapi_depends_cache_lookup",
    path: "fastapi/dependencies/utils.py",
    symbol: "fastapi.dependencies.utils.solve_dependencies",
    change_kind: "modified",
    additions: 40,
    deletions: 8,
    start_line: 312,
    end_line: 352,
    code_before: [
      "solved_result = await call(**sub_values)",
      "values[dependant.name] = solved_result",
    ].join("\n"),
    code_after: [
      "cache_key = (dependant.call, tuple(dependant.security_scopes))",
      "if dependant.use_cache and cache_key in cache:",
      "    solved_result = cache[cache_key]",
      "else:",
      "    solved_result = await call(**sub_values)",
      "    if dependant.use_cache:",
      "        cache[cache_key] = solved_result",
      "values[dependant.name] = solved_result",
    ].join("\n"),
    reasoning: decisions.dec_fastapi_depends_cache.claim,
    decision: decisions.dec_fastapi_depends_cache,
    evidence_ids: decisions.dec_fastapi_depends_cache.evidence_ids,
    pr: prRef(pullRequests[1097]),
    author: person("tiangolo"),
  },
  {
    change_id: "change_fastapi_depends_use_cache_param",
    path: "fastapi/params.py",
    symbol: "fastapi.params.Depends",
    change_kind: "modified",
    additions: 12,
    deletions: 2,
    start_line: 118,
    end_line: 134,
    code_before: [
      "class Depends:",
      "    def __init__(",
      "        self,",
      "        dependency: Optional[Callable[..., Any]] = None,",
      "    ):",
      "        self.dependency = dependency",
    ].join("\n"),
    code_after: [
      "class Depends:",
      "    def __init__(",
      "        self,",
      "        dependency: Optional[Callable[..., Any]] = None,",
      "        *,",
      "        use_cache: bool = True,",
      "    ):",
      "        self.dependency = dependency",
      "        self.use_cache = use_cache",
    ].join("\n"),
    reasoning:
      "The cache is a default, not a rule: a dependency that must run on every parameter can opt out at the declaration site.",
    decision: decisions.dec_fastapi_depends_cache,
    evidence_ids: ["fastapi:review_comment:1097", "fastapi:commit:8f1a2b3"],
    pr: prRef(pullRequests[1097]),
    author: person("tiangolo"),
  },
  {
    change_id: "change_fastapi_response_model_serialize",
    path: "fastapi/routing.py",
    symbol: "fastapi.routing.serialize_response",
    change_kind: "modified",
    additions: 28,
    deletions: 11,
    start_line: 248,
    end_line: 278,
    code_before: [
      "async def serialize_response(",
      "    *, field: Optional[ModelField], response_content: Any",
      ") -> Any:",
      "    if field:",
      "        return jsonable_encoder(response_content)",
      "    return response_content",
    ].join("\n"),
    code_after: [
      "async def serialize_response(",
      "    *, field: Optional[ModelField], response_content: Any",
      ") -> Any:",
      "    if field:",
      "        value = await run_in_threadpool(field.validate, response_content)",
      "        return jsonable_encoder(value)",
      "    return response_content",
    ].join("\n"),
    reasoning: decisions.dec_fastapi_response_model_revalidate.claim,
    decision: decisions.dec_fastapi_response_model_revalidate,
    evidence_ids: decisions.dec_fastapi_response_model_revalidate.evidence_ids,
    pr: prRef(pullRequests[1163]),
    author: person("tiangolo"),
  },
  {
    change_id: "change_fastapi_response_model_handler",
    path: "fastapi/routing.py",
    symbol: "fastapi.routing.get_request_handler",
    change_kind: "modified",
    additions: 9,
    deletions: 3,
    start_line: 208,
    end_line: 232,
    code_before: [
      "raw_response = await run_endpoint_function(",
      "    dependant=dependant, values=values, is_coroutine=is_coroutine",
      ")",
      "response_data = raw_response",
    ].join("\n"),
    code_after: [
      "raw_response = await run_endpoint_function(",
      "    dependant=dependant, values=values, is_coroutine=is_coroutine",
      ")",
      "response_data = await serialize_response(",
      "    field=response_field, response_content=raw_response",
      ")",
    ].join("\n"),
    reasoning:
      "Every response now passes through the generated field, so the output contract is enforced at the routing boundary rather than in each handler.",
    decision: decisions.dec_fastapi_response_model_revalidate,
    evidence_ids: ["fastapi:review_comment:1163", "fastapi:commit:4c9d1e7"],
    pr: prRef(pullRequests[1163]),
    author: person("tiangolo"),
  },
  {
    change_id: "change_fastapi_lifespan_wiring",
    path: "fastapi/applications.py",
    symbol: "fastapi.FastAPI.__init__",
    change_kind: "modified",
    additions: 34,
    deletions: 18,
    start_line: 332,
    end_line: 366,
    code_before: [
      "self.router: routing.APIRouter = routing.APIRouter(",
      "    routes=routes,",
      "    dependency_overrides_provider=self,",
      "    on_startup=on_startup,",
      "    on_shutdown=on_shutdown,",
      ")",
    ].join("\n"),
    code_after: [
      "self.router: routing.APIRouter = routing.APIRouter(",
      "    routes=routes,",
      "    dependency_overrides_provider=self,",
      "    lifespan=lifespan,",
      "    on_startup=on_startup,",
      "    on_shutdown=on_shutdown,",
      ")",
    ].join("\n"),
    reasoning: decisions.dec_fastapi_lifespan.claim,
    decision: decisions.dec_fastapi_lifespan,
    evidence_ids: decisions.dec_fastapi_lifespan.evidence_ids,
    pr: prRef(pullRequests[4873]),
    author: person("dmontagu"),
  },
  {
    change_id: "change_fastapi_lifespan_docs",
    path: "docs/en/docs/advanced/events.md",
    symbol: null,
    change_kind: "modified",
    additions: 70,
    deletions: 20,
    reasoning:
      "The events page was rewritten around lifespan in the same pull request, with on_event left documented only as a deprecated compatibility path.",
    decision: decisions.dec_fastapi_lifespan,
    evidence_ids: [
      "fastapi:review_comment:4873",
      "fastapi:commit:2b7e4f9",
      "fastapi:doc:docs/en/docs/advanced/events.md",
    ],
    pr: prRef(pullRequests[4873]),
    author: person("dmontagu"),
  },
  {
    change_id: "change_fastapi_background_response",
    path: "fastapi/routing.py",
    symbol: "fastapi.routing.get_request_handler",
    change_kind: "modified",
    additions: 8,
    deletions: 3,
    start_line: 236,
    end_line: 258,
    code_before: [
      "response = response_class(",
      "    content=response_content,",
      "    status_code=status_code,",
      "    headers=response.headers,",
      ")",
    ].join("\n"),
    code_after: [
      "response = response_class(",
      "    content=response_content,",
      "    status_code=status_code,",
      "    headers=response.headers,",
      "    background=background_tasks,",
      ")",
    ].join("\n"),
    reasoning:
      "Attaching the tasks to the response lets Starlette run them after the body is sent, so they cannot delay the client.",
    decision: decisions.dec_fastapi_background_tasks,
    evidence_ids: ["fastapi:commit:3d5c9a1", "fastapi:pr:834"],
    pr: prRef(pullRequests[834]),
    author: person("tiangolo"),
  },
  {
    change_id: "change_fastapi_background_tasks_class",
    path: "fastapi/background.py",
    symbol: "fastapi.background.BackgroundTasks",
    change_kind: "added",
    additions: 24,
    deletions: 0,
    start_line: 20,
    end_line: 44,
    code_before: null,
    code_after: [
      "class BackgroundTasks(BackgroundTask):",
      "    def __init__(self, tasks: Optional[Sequence[BackgroundTask]] = None):",
      "        self.tasks = list(tasks) if tasks else []",
      "",
      "    def add_task(self, func, *args, **kwargs):",
      "        self.tasks.append(BackgroundTask(func, *args, **kwargs))",
      "",
      "    async def __call__(self) -> None:",
      "        for task in self.tasks:",
      "            await task()",
    ].join("\n"),
    reasoning:
      "A request-scoped task list lets several dependencies and the handler append work without choosing an execution order ahead of time.",
    decision: decisions.dec_fastapi_background_tasks,
    evidence_ids: ["fastapi:issue:2905", "fastapi:commit:3d5c9a1"],
    pr: prRef(pullRequests[834]),
    author: person("tiangolo"),
  },
];

const changes = sortChanges(CHANGE_FIXTURES);

/* ------------------------------------------------------------------ */
/* Answers                                                             */
/* ------------------------------------------------------------------ */

const answers: MockAnswer[] = [
  {
    id: "depends_cache",
    keywords: ["depends", "dependency", "dependencies", "use_cache"],
    build: () => ({
      answer: [
        "`Depends` caches its **solved value for the lifetime of one request**. If two parameters depend on the same callable, it runs once.",
        "",
        "The cache key is the dependency callable plus its security scopes, so a dependency reused by a router and a path operation is not executed twice. A dependency that must run every time opts out:",
        "",
        "```python",
        "SessionDep = Annotated[Session, Depends(get_session, use_cache=False)]",
        "```",
        "",
        "The scope is deliberate. The issue that prompted the change showed a shared database dependency opening two sessions per request; the maintainer response ruled out a process-wide cache because it would keep sessions alive across users.",
        "",
        "**Confidence: high** — a review comment, the merge commit, the PR and the follow-up issue all describe the same boundary.",
      ].join("\n"),
      confidence: "high",
      status: "answered",
      citations: [
        cite("fastapi:review_comment:1097"),
        cite("fastapi:commit:8f1a2b3"),
        cite("fastapi:pr:1097"),
      ],
      graph_path: graphPaths.dec_fastapi_depends_cache,
      decisions: [decisions.dec_fastapi_depends_cache],
      superseded_by: null,
      retrieval_trace_id: "trace_depends_cache_4f18",
    }),
  },
  {
    id: "response_model",
    keywords: ["response_model", "response model", "serialize", "serialization"],
    build: () => ({
      answer: [
        "`response_model` is not just a type hint; it is an **output contract**. FastAPI validates and serializes the return value through a generated field, so internal fields are filtered out.",
        "",
        "Handlers routinely return ORM objects or database rows with columns the client should never see. Validating only the input would leave that leak in place, so the response passes through the field on the way out:",
        "",
        "```python",
        "@app.get(\"/users/{user_id}\", response_model=UserPublic)",
        "async def read_user(user_id: int) -> User:",
        "    return await get_user(user_id)  # UserPrivate, filtered to UserPublic",
        "```",
        "",
        "The review on the change states the motivation directly: the point is the contract, not redundant validation.",
        "",
        "**Confidence: medium** — the review and the commit agree, but this pass found no separate design document for the serialization mode.",
      ].join("\n"),
      confidence: "medium",
      status: "answered",
      citations: [
        cite("fastapi:review_comment:1163"),
        cite("fastapi:commit:4c9d1e7"),
        cite("fastapi:pr:1163"),
      ],
      graph_path: graphPaths.dec_fastapi_response_model_revalidate,
      decisions: [decisions.dec_fastapi_response_model_revalidate],
      superseded_by: null,
      retrieval_trace_id: "trace_response_model_9b02",
    }),
  },
  {
    id: "lifespan",
    keywords: ["lifespan", "startup", "shutdown", "on_event"],
    build: () => ({
      answer: [
        "The **lifespan context manager replaced startup and shutdown events** because setup and teardown need one scope, not two independent hooks.",
        "",
        "Event handlers made it possible to create a resource on startup and lose it if startup failed part-way. A lifespan is a single async context manager: everything before `yield` runs at startup and everything after it runs at shutdown.",
        "",
        "```python",
        "@asynccontextmanager",
        "async def lifespan(app: FastAPI):",
        "    app.state.pool = await create_pool()",
        "    yield",
        "    await app.state.pool.close()",
        "```",
        "",
        "`on_event` remains as a deprecated compatibility path; new applications are expected to pass `lifespan=`.",
        "",
        "**Partial answer:** the ordering argument is well evidenced, but this pass found no review that settles exactly when the old event hooks should be removed.",
      ].join("\n"),
      confidence: "medium",
      status: "partial",
      citations: [
        cite("fastapi:review_comment:4873"),
        cite("fastapi:commit:2b7e4f9"),
        cite("fastapi:pr:4873"),
        cite("fastapi:doc:docs/en/docs/advanced/events.md"),
      ],
      graph_path: graphPaths.dec_fastapi_lifespan,
      decisions: [
        decisions.dec_fastapi_startup_events,
        decisions.dec_fastapi_lifespan,
      ],
      superseded_by: null,
      retrieval_trace_id: "trace_lifespan_c73d",
    }),
  },
];

export const fastapiFixtures: RepoFixtures = {
  slug: REPO,
  questions: [
    "Why does Depends cache dependency results by default?",
    "Why does response_model re-validate data that was already validated?",
    "Why did the lifespan context manager replace startup and shutdown events?",
    "Why is GraphQL not supported?",
  ],
  refusalKeywords: ["graphql", "grpc", "websocket compression", "http/3", "protobuf"],
  evidence,
  decisions,
  threads,
  graphPaths,
  changes,
  pullRequests,
  people: derivePeople(pullRequests, changes, dir),
  answers,
  refusal: {
    answer:
      "No defensible evidence was found for this question in the ingested history. Rather than guess, the retrieval service refused.",
    confidence: "low",
    status: "refused",
    citations: [],
    graph_path: null,
    superseded_by: null,
    retrieval_trace_id: "trace_refusal_fastapi_1e42",
    refusal: {
      reason:
        "No decision, commit or review in the evidence store discusses this topic. The nearest candidates are shown below, but none of them support a claim.",
      nearest_candidates: [
        cite("fastapi:doc:docs/en/docs/tutorial/dependencies/index.md", {
          excerpt:
            "Nearby topic (request handling) only — it does not address this question.",
        }),
        cite("fastapi:doc:docs/en/docs/advanced/events.md", {
          excerpt:
            "Nearby topic (application lifecycle) only — it does not address this question.",
        }),
      ],
    },
  },
};
