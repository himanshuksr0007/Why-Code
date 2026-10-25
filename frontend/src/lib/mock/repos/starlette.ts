/**
 * Sample fixtures for `encode/starlette`.
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
  revision,
  sortChanges,
  thread,
} from "@/lib/mock/build";
import type { MockAnswer, RepoFixtures } from "@/lib/mock/build";

export const REPO = "encode/starlette";

const NAMES: Record<string, string> = {
  tomchristie: "Tom Christie",
  Kludex: "Marcelo Trylesinski",
  adriangb: "Adrian Garcia Badaracco",
  aminalaee: "Amin Alaee",
  graingert: "Thomas Grainger",
};

const TAGS: Record<string, string[]> = {
  tomchristie: ["Maintainer"],
  Kludex: ["Maintainer"],
  adriangb: ["Maintainer"],
  aminalaee: ["Maintainer"],
  graingert: ["Contributor"],
};

const { dir, person, participant } = directory(NAMES, TAGS);

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

const evidence: Record<string, EvidenceDetail> = {
  "starlette:review_comment:410": {
    evidence_id: "starlette:review_comment:410",
    record_type: "review_comment",
    source_type: "review_comment",
    repo: REPO,
    pr_number: 1904,
    author: "Kludex",
    created_at: "2023-10-02T14:18:00Z",
    url: "https://github.com/encode/starlette/pull/1904#discussion_r410",
    title: "re: middleware stack construction",
    excerpt:
      "The middleware added last needs to be the outermost one, otherwise `add_middleware` reads backwards from the stack it builds.",
    body:
      "The middleware added last needs to be the outermost one, otherwise `add_middleware` reads backwards from the stack it builds.\n\nPlease cover both orders in the tests so the documented rule and the implementation cannot drift apart.",
    payload: {
      path: "starlette/applications.py",
      line: 84,
      start_line: 71,
      side: "RIGHT",
      in_reply_to_id: 409,
    },
  },
  "starlette:commit:4b6d0e1": {
    evidence_id: "starlette:commit:4b6d0e1",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 1904,
    author: "adriangb",
    created_at: "2023-10-04T09:32:00Z",
    url: "https://github.com/encode/starlette/commit/4b6d0e1",
    title: "Build the middleware stack from the outside in",
    excerpt:
      "Wrap user middleware in reverse so the last middleware added is the first one a request reaches.",
    payload: {
      sha: "4b6d0e1",
      files: [{ filename: "starlette/applications.py", additions: 16, deletions: 7 }],
    },
  },
  "starlette:pr:1904": {
    evidence_id: "starlette:pr:1904",
    record_type: "pull_request",
    source_type: "pull_request",
    repo: REPO,
    pr_number: 1904,
    author: "adriangb",
    created_at: "2023-09-28T10:12:00Z",
    url: "https://github.com/encode/starlette/pull/1904",
    title: "Make middleware ordering explicit and tested",
    excerpt:
      "Documents and tests that the middleware added last is the outermost layer of the stack.",
    payload: { number: 1904, merged: true, files_changed: 4 },
  },
  "starlette:issue:1084": {
    evidence_id: "starlette:issue:1084",
    record_type: "issue",
    source_type: "issue",
    repo: REPO,
    pr_number: null,
    author: "graingert",
    created_at: "2023-04-03T08:47:00Z",
    url: "https://github.com/encode/starlette/issues/1084",
    title: "Startup and shutdown handlers are hard to compose with resources",
    excerpt:
      "Independent `on_event` handlers make it awkward to acquire a resource at startup and release it at shutdown without leaking on failure.",
    payload: { number: 1084, state: "closed" },
  },
  "starlette:issue_comment:2210": {
    evidence_id: "starlette:issue_comment:2210",
    record_type: "issue_comment",
    source_type: "issue_comment",
    repo: REPO,
    pr_number: null,
    author: "Kludex",
    created_at: "2023-04-06T15:20:00Z",
    url: "https://github.com/encode/starlette/issues/1084#issuecomment-2210",
    title: "re: startup and shutdown handlers",
    excerpt:
      "A single context manager makes the resource lifetime explicit and lets a startup failure abort cleanly instead of running half the handlers.",
    payload: { issue_number: 1084, author_association: "MEMBER" },
  },
  "starlette:commit:7c2f9ab": {
    evidence_id: "starlette:commit:7c2f9ab",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 1701,
    author: "Kludex",
    created_at: "2023-06-21T11:05:00Z",
    url: "https://github.com/encode/starlette/commit/7c2f9ab",
    title: "Deprecate on_event in favour of lifespan",
    excerpt:
      "Emit a deprecation warning from `on_event` and point callers at the lifespan context manager.",
    payload: {
      sha: "7c2f9ab",
      files: [{ filename: "starlette/applications.py", additions: 7, deletions: 1 }],
    },
  },
  "starlette:pr:1701": {
    evidence_id: "starlette:pr:1701",
    record_type: "pull_request",
    source_type: "pull_request",
    repo: REPO,
    pr_number: 1701,
    author: "Kludex",
    created_at: "2023-06-14T08:30:00Z",
    url: "https://github.com/encode/starlette/pull/1701",
    title: "Deprecate on_event in favour of lifespan",
    excerpt:
      "Moves the documented startup and shutdown story onto a single lifespan context manager.",
    payload: { number: 1701, merged: true, files_changed: 4 },
  },
  "starlette:commit:b83d5e0": {
    evidence_id: "starlette:commit:b83d5e0",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 1004,
    author: "tomchristie",
    created_at: "2021-02-16T17:44:00Z",
    url: "https://github.com/encode/starlette/commit/b83d5e0",
    title: "Add lifespan support to the router",
    excerpt:
      "Run the lifespan context manager around the server's receive loop so startup completes before the first request.",
    payload: {
      sha: "b83d5e0",
      files: [
        { filename: "starlette/routing.py", additions: 42, deletions: 2 },
        { filename: "tests/test_lifespan.py", additions: 36, deletions: 0 },
      ],
    },
  },
  "starlette:pr:1004": {
    evidence_id: "starlette:pr:1004",
    record_type: "pull_request",
    source_type: "pull_request",
    repo: REPO,
    pr_number: 1004,
    author: "tomchristie",
    created_at: "2021-02-08T09:15:00Z",
    url: "https://github.com/encode/starlette/pull/1004",
    title: "Add lifespan protocol support",
    excerpt:
      "Adds an opt-in lifespan context manager alongside the existing `on_event` handlers.",
    payload: { number: 1004, merged: true, files_changed: 4 },
  },
  "starlette:issue:1682": {
    evidence_id: "starlette:issue:1682",
    record_type: "issue",
    source_type: "issue",
    repo: REPO,
    pr_number: null,
    author: "graingert",
    created_at: "2023-04-11T12:02:00Z",
    url: "https://github.com/encode/starlette/issues/1682",
    title: "url_for generates http links behind a TLS-terminating proxy",
    excerpt:
      "`request.url_for` returns `http://` links when TLS is terminated upstream, so redirects and password-reset emails point at the wrong scheme.",
    payload: { number: 1682, state: "closed" },
  },
  "starlette:review_comment:643": {
    evidence_id: "starlette:review_comment:643",
    record_type: "review_comment",
    source_type: "review_comment",
    repo: REPO,
    pr_number: 1690,
    author: "Kludex",
    created_at: "2023-05-24T16:05:00Z",
    url: "https://github.com/encode/starlette/pull/1690#discussion_r643",
    title: "re: trusted proxy headers",
    excerpt:
      "Only trust forwarded headers from known proxies. Otherwise any client can spoof the scheme or host we put in a generated URL.",
    payload: {
      path: "starlette/middleware/proxy_headers.py",
      line: 52,
      start_line: 28,
      side: "RIGHT",
      in_reply_to_id: 642,
    },
  },
  "starlette:commit:2f81c04": {
    evidence_id: "starlette:commit:2f81c04",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 1690,
    author: "aminalaee",
    created_at: "2023-05-30T08:21:00Z",
    url: "https://github.com/encode/starlette/commit/2f81c04",
    title: "Apply forwarded scheme and host only from trusted proxies",
    excerpt:
      "Guard `X-Forwarded-Proto` and `X-Forwarded-Host` behind a trusted-host check before rewriting the ASGI scope.",
    payload: {
      sha: "2f81c04",
      files: [
        {
          filename: "starlette/middleware/proxy_headers.py",
          additions: 22,
          deletions: 6,
        },
      ],
    },
  },
  "starlette:pr:1690": {
    evidence_id: "starlette:pr:1690",
    record_type: "pull_request",
    source_type: "pull_request",
    repo: REPO,
    pr_number: 1690,
    author: "aminalaee",
    created_at: "2023-05-22T09:40:00Z",
    url: "https://github.com/encode/starlette/pull/1690",
    title: "Trust forwarded headers when building absolute URLs",
    excerpt:
      "Lets `ProxyHeadersMiddleware` correct the scheme and host used by `url_for`, but only for configured proxies.",
    payload: { number: 1690, merged: true, files_changed: 5 },
  },
  "starlette:doc:docs/middleware.md": {
    evidence_id: "starlette:doc:docs/middleware.md",
    record_type: "doc_file",
    source_type: "doc_file",
    repo: REPO,
    pr_number: null,
    author: null,
    created_at: null,
    url: "https://github.com/encode/starlette/blob/master/docs/middleware.md",
    title: "docs/middleware.md",
    excerpt:
      "Documents the middleware stack, ordering, and the trusted-proxy behaviour of `ProxyHeadersMiddleware`.",
    payload: { path: "docs/middleware.md" },
  },
  "starlette:doc:docs/lifespan.md": {
    evidence_id: "starlette:doc:docs/lifespan.md",
    record_type: "doc_file",
    source_type: "doc_file",
    repo: REPO,
    pr_number: null,
    author: null,
    created_at: null,
    url: "https://github.com/encode/starlette/blob/master/docs/lifespan.md",
    title: "docs/lifespan.md",
    excerpt:
      "Documents the lifespan protocol and the deprecation of `on_event` startup and shutdown handlers.",
    payload: { path: "docs/lifespan.md" },
  },
  "starlette:doc:docs/routing.md": {
    evidence_id: "starlette:doc:docs/routing.md",
    record_type: "doc_file",
    source_type: "doc_file",
    repo: REPO,
    pr_number: null,
    author: null,
    created_at: null,
    url: "https://github.com/encode/starlette/blob/master/docs/routing.md",
    title: "docs/routing.md",
    excerpt:
      "Documents route registration order, path parameters, and generating URLs with `url_for`.",
    payload: { path: "docs/routing.md" },
  },
};

const cite = makeCiter(evidence);

/* ------------------------------------------------------------------ */
/* Decisions                                                           */
/* ------------------------------------------------------------------ */

const decisions: Record<string, Decision> = {
  dec_starlette_middleware_order: {
    decision_id: "dec_starlette_middleware_order",
    title: "Middleware added last is the outermost layer",
    claim:
      "`add_middleware` wraps the existing stack, so the middleware added last sees a request first and the application last.",
    status: "active",
    confidence: "high",
    pr_number: 1904,
    created_at: "2023-10-05T10:30:00Z",
    targets: [
      { type: "Symbol", identifier: "starlette.applications.Starlette.add_middleware" },
      { type: "Symbol", identifier: "starlette.applications.Starlette.build_middleware_stack" },
      { type: "ConfigKey", identifier: "middleware" },
    ],
    evidence_ids: [
      "starlette:review_comment:410",
      "starlette:commit:4b6d0e1",
      "starlette:pr:1904",
    ],
  },
  dec_starlette_lifespan_origin: {
    decision_id: "dec_starlette_lifespan_origin",
    title: "Startup and shutdown are separate event handlers",
    claim:
      "Applications register independent `startup` and `shutdown` handlers through `on_event`.",
    status: "reversed",
    confidence: "medium",
    pr_number: null,
    created_at: "2018-06-11T10:00:00Z",
    targets: [
      { type: "Symbol", identifier: "starlette.applications.Starlette.on_event" },
      { type: "Symbol", identifier: "starlette.routing.Router.on_event" },
    ],
    evidence_ids: ["starlette:issue:1084", "starlette:issue_comment:2210"],
    superseded_by: "dec_starlette_lifespan",
  },
  dec_starlette_lifespan: {
    decision_id: "dec_starlette_lifespan",
    title: "One lifespan context manager owns startup and shutdown",
    claim:
      "Resources are acquired before the server accepts connections and released after the last one, inside a single `lifespan` context manager.",
    status: "active",
    confidence: "high",
    pr_number: 1701,
    created_at: "2023-06-21T11:05:00Z",
    targets: [
      { type: "Symbol", identifier: "starlette.routing.Router.lifespan" },
      { type: "Symbol", identifier: "starlette.applications.Starlette.router" },
    ],
    evidence_ids: [
      "starlette:issue:1084",
      "starlette:issue_comment:2210",
      "starlette:commit:b83d5e0",
      "starlette:commit:7c2f9ab",
    ],
    supersedes: "dec_starlette_lifespan_origin",
  },
  dec_starlette_url_for_host_origin: {
    decision_id: "dec_starlette_url_for_host_origin",
    title: "Generated URLs trust the incoming Host header",
    claim:
      "`request.url_for` builds absolute URLs from the request scope, so a TLS-terminating proxy yields `http` links unless the application rewrites the scope.",
    status: "contested",
    confidence: "low",
    pr_number: null,
    created_at: "2020-09-14T09:30:00Z",
    targets: [
      { type: "Symbol", identifier: "starlette.requests.Request.url_for" },
      { type: "ConfigKey", identifier: "root_path" },
    ],
    evidence_ids: ["starlette:issue:1682", "starlette:doc:docs/routing.md"],
    superseded_by: "dec_starlette_url_for_forwarded",
  },
  dec_starlette_url_for_forwarded: {
    decision_id: "dec_starlette_url_for_forwarded",
    title: "Forwarded headers are applied only from trusted proxies",
    claim:
      "`ProxyHeadersMiddleware` rewrites scheme and host from `X-Forwarded-Proto` and `X-Forwarded-Host`, but only for clients in `trusted_hosts`.",
    status: "active",
    confidence: "medium",
    pr_number: 1690,
    created_at: "2023-05-30T08:21:00Z",
    targets: [
      {
        type: "Symbol",
        identifier: "starlette.middleware.proxy_headers.ProxyHeadersMiddleware",
      },
      { type: "Symbol", identifier: "starlette.requests.Request.url_for" },
      { type: "ConfigKey", identifier: "trusted_hosts" },
    ],
    evidence_ids: [
      "starlette:issue:1682",
      "starlette:review_comment:643",
      "starlette:commit:2f81c04",
      "starlette:pr:1690",
    ],
    supersedes: "dec_starlette_url_for_host_origin",
  },
};

const threads = [
  thread("thread_middleware_order", "Middleware ordering", [
    origin(decisions.dec_starlette_middleware_order),
  ]),
  thread("thread_lifespan", "Application startup and shutdown", [
    origin(decisions.dec_starlette_lifespan_origin),
    reversal(decisions.dec_starlette_lifespan),
  ]),
  thread("thread_url_for", "Absolute URLs behind a proxy", [
    origin(decisions.dec_starlette_url_for_host_origin),
    revision(decisions.dec_starlette_url_for_forwarded),
  ]),
];

/* ------------------------------------------------------------------ */
/* Graph paths                                                         */
/* ------------------------------------------------------------------ */

const graphPaths: Record<string, GraphPath> = {
  dec_starlette_middleware_order: chain(
    [
      ["key", "ConfigKey", "middleware"],
      ["sym", "Symbol", "Starlette.add_middleware"],
      ["reg", "CodeRegion", "starlette/applications.py:71-94"],
      ["commit", "Commit", "4b6d0e1"],
      ["pr", "PullRequest", "#1904"],
      ["dec", "Decision", "dec_starlette_middleware_order"],
      ["ev", "Evidence", "starlette:review_comment:410"],
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
  dec_starlette_lifespan_origin: chain(
    [
      ["sym", "Symbol", "Starlette.on_event"],
      ["reg", "CodeRegion", "starlette/applications.py:196-214"],
      ["issue", "Issue", "#1084"],
      ["dec", "Decision", "dec_starlette_lifespan_origin"],
      ["ev", "Evidence", "starlette:issue:1084"],
    ],
    [
      ["sym", "reg", "HAS_REGION"],
      ["issue", "reg", "MOTIVATES"],
      ["issue", "dec", "DISCUSSES"],
      ["dec", "ev", "SUPPORTED_BY"],
    ],
  ),
  dec_starlette_lifespan: chain(
    [
      ["sym", "Symbol", "Router.lifespan"],
      ["reg", "CodeRegion", "starlette/routing.py:120-168"],
      ["commit", "Commit", "b83d5e0"],
      ["pr", "PullRequest", "#1004"],
      ["dec", "Decision", "dec_starlette_lifespan"],
      ["ev", "Evidence", "starlette:issue_comment:2210"],
    ],
    [
      ["sym", "reg", "HAS_REGION"],
      ["commit", "reg", "CHANGED_REGION"],
      ["pr", "commit", "HAS_COMMIT"],
      ["pr", "dec", "HAS_DECISION"],
      ["dec", "ev", "SUPPORTED_BY"],
    ],
  ),
  dec_starlette_url_for_host_origin: chain(
    [
      ["sym", "Symbol", "Request.url_for"],
      ["reg", "CodeRegion", "starlette/requests.py:180-205"],
      ["issue", "Issue", "#1682"],
      ["dec", "Decision", "dec_starlette_url_for_host_origin"],
      ["ev", "Evidence", "starlette:issue:1682"],
    ],
    [
      ["sym", "reg", "HAS_REGION"],
      ["issue", "reg", "MOTIVATES"],
      ["issue", "dec", "DISCUSSES"],
      ["dec", "ev", "SUPPORTED_BY"],
    ],
  ),
  dec_starlette_url_for_forwarded: chain(
    [
      ["key", "ConfigKey", "trusted_hosts"],
      ["sym", "Symbol", "ProxyHeadersMiddleware.__call__"],
      ["reg", "CodeRegion", "starlette/middleware/proxy_headers.py:28-72"],
      ["commit", "Commit", "2f81c04"],
      ["pr", "PullRequest", "#1690"],
      ["dec", "Decision", "dec_starlette_url_for_forwarded"],
      ["ev", "Evidence", "starlette:review_comment:643"],
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
  1004: pullRequest({
    number: 1004,
    repo: REPO,
    title: "Add lifespan protocol support",
    author: person("tomchristie"),
    created_at: "2021-02-08T09:15:00Z",
    merged_at: "2021-02-16T17:44:00Z",
    reviewers: [person("Kludex"), person("adriangb")],
    participants: [
      participant("tomchristie", ["author", "committer"], 5),
      participant("Kludex", ["reviewer", "commenter"], 3),
      participant("adriangb", ["reviewer", "commenter"], 2),
    ],
    changed_files: [
      file("starlette/routing.py", "modified", 42, 2),
      file("starlette/applications.py", "modified", 8, 3),
      file("docs/lifespan.md", "added", 61, 0),
      file("tests/test_lifespan.py", "added", 36, 0),
    ],
    commits: [
      commit(
        "b83d5e0",
        "Add lifespan support to the router",
        person("tomchristie"),
        "2021-02-16T17:44:00Z",
      ),
    ],
    decision_ids: ["dec_starlette_lifespan"],
    body: "Adds an opt-in lifespan context manager alongside the existing `on_event` handlers, so resources can be acquired and released as one unit.",
  }),
  1690: pullRequest({
    number: 1690,
    repo: REPO,
    title: "Trust forwarded headers when building absolute URLs",
    author: person("aminalaee"),
    created_at: "2023-05-22T09:40:00Z",
    merged_at: "2023-05-30T08:21:00Z",
    reviewers: [person("Kludex"), person("adriangb")],
    participants: [
      participant("aminalaee", ["author", "committer"], 6),
      participant("Kludex", ["reviewer", "commenter"], 4),
      participant("adriangb", ["reviewer", "commenter"], 2),
      participant("graingert", ["commenter"], 2),
    ],
    changed_files: [
      file("starlette/middleware/proxy_headers.py", "modified", 22, 6),
      file("tests/middleware/test_proxy_headers.py", "added", 48, 0),
      file("docs/middleware.md", "modified", 14, 3),
      file("docs/routing.md", "modified", 9, 2),
      file("tests/test_requests.py", "modified", 12, 1),
    ],
    commits: [
      commit(
        "2f81c04",
        "Apply forwarded scheme and host only from trusted proxies",
        person("aminalaee"),
        "2023-05-30T08:21:00Z",
      ),
    ],
    decision_ids: [
      "dec_starlette_url_for_forwarded",
      "dec_starlette_url_for_host_origin",
    ],
    body: "Corrects the scheme and host used by `url_for` when TLS terminates upstream. Forwarded headers are ignored unless the client is a configured trusted proxy.",
  }),
  1701: pullRequest({
    number: 1701,
    repo: REPO,
    title: "Deprecate on_event in favour of lifespan",
    author: person("Kludex"),
    created_at: "2023-06-14T08:30:00Z",
    merged_at: "2023-06-21T11:05:00Z",
    reviewers: [person("tomchristie"), person("aminalaee")],
    participants: [
      participant("Kludex", ["author", "committer"], 5),
      participant("tomchristie", ["reviewer", "commenter"], 3),
      participant("aminalaee", ["reviewer", "commenter"], 2),
    ],
    changed_files: [
      file("starlette/applications.py", "modified", 7, 1),
      file("starlette/routing.py", "modified", 18, 9),
      file("docs/lifespan.md", "modified", 34, 12),
      file("tests/test_lifespan.py", "modified", 21, 4),
    ],
    commits: [
      commit(
        "7c2f9ab",
        "Deprecate on_event in favour of lifespan",
        person("Kludex"),
        "2023-06-21T11:05:00Z",
      ),
    ],
    decision_ids: ["dec_starlette_lifespan", "dec_starlette_lifespan_origin"],
    body: "Makes lifespan the documented way to manage startup and shutdown resources. `on_event` keeps working but emits a deprecation warning.",
  }),
  1904: pullRequest({
    number: 1904,
    repo: REPO,
    title: "Make middleware ordering explicit and tested",
    author: person("adriangb"),
    created_at: "2023-09-28T10:12:00Z",
    merged_at: "2023-10-05T10:30:00Z",
    reviewers: [person("Kludex"), person("aminalaee")],
    participants: [
      participant("adriangb", ["author", "committer"], 6),
      participant("Kludex", ["reviewer", "commenter"], 4),
      participant("aminalaee", ["reviewer", "commenter"], 2),
    ],
    changed_files: [
      file("starlette/applications.py", "modified", 16, 7),
      file("docs/middleware.md", "modified", 18, 5),
      file("tests/test_middleware.py", "modified", 44, 0),
      file("tests/test_applications.py", "modified", 17, 2),
    ],
    commits: [
      commit(
        "4b6d0e1",
        "Build the middleware stack from the outside in",
        person("adriangb"),
        "2023-10-04T09:32:00Z",
      ),
    ],
    decision_ids: ["dec_starlette_middleware_order"],
    body: "Pins the rule that the middleware added last wraps everything added before it, with tests for both registration orders.",
  }),
};

/* ------------------------------------------------------------------ */
/* Code changes + reasoning                                            */
/* ------------------------------------------------------------------ */

const CHANGE_FIXTURES: CodeChange[] = [
  {
    change_id: "change_starlette_middleware_stack",
    path: "starlette/applications.py",
    symbol: "Starlette.build_middleware_stack",
    change_kind: "modified",
    additions: 16,
    deletions: 7,
    start_line: 71,
    end_line: 94,
    code_before: [
      "app = self.router",
      "for cls, options in self.user_middleware:",
      "    app = cls(app=app, **options)",
      "return app",
    ].join("\n"),
    code_after: [
      "middleware = (",
      "    [Middleware(ServerErrorMiddleware, handler=error_handler)]",
      "    + self.user_middleware",
      "    + [Middleware(ExceptionMiddleware, handlers=exception_handlers)]",
      ")",
      "app = self.router",
      "for cls, args, kwargs in reversed(middleware):",
      "    app = cls(app, *args, **kwargs)",
      "return app",
    ].join("\n"),
    reasoning: decisions.dec_starlette_middleware_order.claim,
    decision: decisions.dec_starlette_middleware_order,
    evidence_ids: decisions.dec_starlette_middleware_order.evidence_ids,
    pr: prRef(pullRequests[1904]),
    author: person("adriangb"),
  },
  {
    change_id: "change_starlette_middleware_docs",
    path: "docs/middleware.md",
    symbol: null,
    change_kind: "modified",
    additions: 18,
    deletions: 5,
    reasoning:
      "The ordering rule is only useful if it is documented next to `add_middleware`, not inferred from the stack builder.",
    decision: decisions.dec_starlette_middleware_order,
    evidence_ids: ["starlette:review_comment:410", "starlette:commit:4b6d0e1"],
    pr: prRef(pullRequests[1904]),
    author: person("adriangb"),
  },
  {
    change_id: "change_starlette_lifespan_context",
    path: "starlette/routing.py",
    symbol: "Router.lifespan",
    change_kind: "modified",
    additions: 42,
    deletions: 2,
    start_line: 120,
    end_line: 168,
    code_before: [
      "async def startup(self) -> None:",
      "    for handler in self.on_startup:",
      "        await handler()",
      "",
      "async def shutdown(self) -> None:",
      "    for handler in self.on_shutdown:",
      "        await handler()",
    ].join("\n"),
    code_after: [
      "@asynccontextmanager",
      "async def lifespan(self, scope, receive, send):",
      "    assert scope[\"type\"] == \"lifespan\"",
      "    try:",
      "        async with self.lifespan_context(self) as maybe_state:",
      "            await send({\"type\": \"lifespan.startup.complete\"})",
      "            await receive()",
      "    except BaseException:",
      "        await send({\"type\": \"lifespan.startup.failed\"})",
      "        raise",
      "    finally:",
      "        await send({\"type\": \"lifespan.shutdown.complete\"})",
    ].join("\n"),
    reasoning: decisions.dec_starlette_lifespan.claim,
    decision: decisions.dec_starlette_lifespan,
    evidence_ids: [
      "starlette:issue:1084",
      "starlette:issue_comment:2210",
      "starlette:commit:b83d5e0",
    ],
    pr: prRef(pullRequests[1004]),
    author: person("tomchristie"),
  },
  {
    change_id: "change_starlette_on_event_deprecation",
    path: "starlette/applications.py",
    symbol: "Starlette.on_event",
    change_kind: "modified",
    additions: 7,
    deletions: 1,
    start_line: 196,
    end_line: 214,
    code_before: [
      "def on_event(self, event_type: str) -> Callable:",
      "    return self.router.on_event(event_type)",
    ].join("\n"),
    code_after: [
      "def on_event(self, event_type: str) -> Callable:",
      "    warnings.warn(",
      '        "on_event is deprecated, use lifespan event handlers instead.",',
      "        DeprecationWarning,",
      "        stacklevel=2,",
      "    )",
      "    return self.router.on_event(event_type)",
    ].join("\n"),
    reasoning: decisions.dec_starlette_lifespan.claim,
    decision: decisions.dec_starlette_lifespan,
    evidence_ids: ["starlette:issue:1084", "starlette:commit:7c2f9ab"],
    pr: prRef(pullRequests[1701]),
    author: person("Kludex"),
  },
  {
    change_id: "change_starlette_lifespan_docs",
    path: "docs/lifespan.md",
    symbol: null,
    change_kind: "modified",
    additions: 34,
    deletions: 12,
    reasoning:
      "The main example moved to a single context manager so readers copy the pattern that actually owns the resource lifetime.",
    decision: decisions.dec_starlette_lifespan,
    evidence_ids: [
      "starlette:issue_comment:2210",
      "starlette:commit:7c2f9ab",
      "starlette:doc:docs/lifespan.md",
    ],
    pr: prRef(pullRequests[1701]),
    author: person("Kludex"),
  },
  {
    change_id: "change_starlette_proxy_trusted_hosts",
    path: "starlette/middleware/proxy_headers.py",
    symbol: "ProxyHeadersMiddleware.__call__",
    change_kind: "modified",
    additions: 22,
    deletions: 6,
    start_line: 28,
    end_line: 72,
    code_before: [
      "class ProxyHeadersMiddleware:",
      "    def __init__(self, app: ASGIApp) -> None:",
      "        self.app = app",
      "",
      "    async def __call__(self, scope, receive, send):",
      '        if scope["type"] in ("http", "websocket"):',
      "            headers = Headers(scope=scope)",
      '            scheme = headers.get("x-forwarded-proto", scope["scheme"])',
      '            scope["scheme"] = scheme',
      "        await self.app(scope, receive, send)",
    ].join("\n"),
    code_after: [
      "class ProxyHeadersMiddleware:",
      "    def __init__(",
      "        self,",
      "        app: ASGIApp,",
      '        trusted_hosts: list[str] | str = "127.0.0.1",',
      "    ) -> None:",
      "        self.app = app",
      "        self.trusted_hosts = _TrustedHosts(trusted_hosts)",
      "",
      "    async def __call__(self, scope, receive, send):",
      "        client = scope.get(\"client\") or (\"\", 0)",
      '        if scope["type"] in ("http", "websocket") and self.trusted_hosts(client[0]):',
      "            headers = Headers(scope=scope)",
      '            scheme = headers.get("x-forwarded-proto", scope["scheme"])',
      '            scope["scheme"] = scheme',
      "        await self.app(scope, receive, send)",
    ].join("\n"),
    reasoning: decisions.dec_starlette_url_for_forwarded.claim,
    decision: decisions.dec_starlette_url_for_forwarded,
    evidence_ids: decisions.dec_starlette_url_for_forwarded.evidence_ids,
    pr: prRef(pullRequests[1690]),
    author: person("aminalaee"),
  },
  {
    change_id: "change_starlette_proxy_headers_tests",
    path: "tests/middleware/test_proxy_headers.py",
    symbol: null,
    change_kind: "added",
    additions: 48,
    deletions: 0,
    reasoning:
      "Tests cover both sides of the trust boundary: a configured proxy rewrites the scheme, an unknown client cannot.",
    decision: decisions.dec_starlette_url_for_forwarded,
    evidence_ids: ["starlette:review_comment:643", "starlette:commit:2f81c04"],
    pr: prRef(pullRequests[1690]),
    author: person("aminalaee"),
  },
  {
    change_id: "change_starlette_routing_docs",
    path: "docs/routing.md",
    symbol: null,
    change_kind: "modified",
    additions: 9,
    deletions: 2,
    reasoning:
      "Adds the proxy caveat next to `url_for`, where developers look when a generated link has the wrong scheme.",
    decision: decisions.dec_starlette_url_for_forwarded,
    evidence_ids: ["starlette:issue:1682", "starlette:commit:2f81c04"],
    pr: prRef(pullRequests[1690]),
    author: person("aminalaee"),
  },
];

const changes = sortChanges(CHANGE_FIXTURES);

/* ------------------------------------------------------------------ */
/* Answers                                                             */
/* ------------------------------------------------------------------ */

const answers: MockAnswer[] = [
  {
    id: "middleware_order",
    keywords: ["middleware", "add_middleware", "ordering", "order", "stack"],
    build: () => ({
      answer: [
        "**The middleware added last is the outermost layer.** It sees a request first and passes the response back last.",
        "",
        "`add_middleware` does not append to the end of a call list; it wraps the stack that already exists. In practice:",
        "",
        "```python",
        "app.add_middleware(GZipMiddleware)",
        "app.add_middleware(CORSMiddleware, allow_origins=[\"*\"])",
        "```",
        "",
        "Here `CORSMiddleware` runs before `GZipMiddleware`, which runs before the router. `ServerErrorMiddleware` still sits outside both, and `ExceptionMiddleware` sits inside both.",
        "",
        "The order is load-bearing: a CORS preflight should short-circuit before any application code runs, and compression should only apply to a response that was produced successfully.",
        "",
        "**Confidence: high** — the review comment states the rule, the commit implements it in reverse order, and the pull request documents the same contract.",
      ].join("\n"),
      confidence: "high",
      status: "answered",
      citations: [
        cite("starlette:review_comment:410"),
        cite("starlette:commit:4b6d0e1"),
        cite("starlette:pr:1904"),
      ],
      graph_path: graphPaths.dec_starlette_middleware_order,
      decisions: [decisions.dec_starlette_middleware_order],
      superseded_by: null,
      retrieval_trace_id: "trace_middleware_2d41",
    }),
  },
  {
    id: "lifespan",
    keywords: ["lifespan", "startup", "shutdown", "on_event", "startup event"],
    build: () => ({
      answer: [
        "Startup and shutdown now belong to **one `lifespan` context manager**, not two independent event lists.",
        "",
        "The older `on_event(\"startup\")` / `on_event(\"shutdown\")` handlers made resource ownership implicit. If the third startup handler raised, the first two had already run and there was no matching teardown. A context manager gives you one place to acquire and one place to release:",
        "",
        "```python",
        "@asynccontextmanager",
        "async def lifespan(app):",
        "    app.state.pool = await create_pool()",
        "    try:",
        "        yield",
        "    finally:",
        "        await app.state.pool.close()",
        "```",
        "",
        "`on_event` still works in this version but emits a `DeprecationWarning`; the docs point new code at `lifespan`.",
        "",
        "**Partial answer:** the issue, comment and merge commit agree on the motivation. This pass did not find the review that settled the exact ASGI message sequencing, so the finer protocol details are not asserted here.",
      ].join("\n"),
      confidence: "medium",
      status: "partial",
      citations: [
        cite("starlette:issue:1084"),
        cite("starlette:issue_comment:2210"),
        cite("starlette:commit:7c2f9ab"),
      ],
      graph_path: graphPaths.dec_starlette_lifespan,
      decisions: [
        decisions.dec_starlette_lifespan_origin,
        decisions.dec_starlette_lifespan,
      ],
      superseded_by: null,
      retrieval_trace_id: "trace_lifespan_9c18",
    }),
  },
  {
    id: "url_for",
    keywords: ["url_for", "forwarded", "proxy", "scheme", "https"],
    build: () => ({
      answer: [
        "`url_for` builds an absolute URL from the **request scope**, so behind TLS termination it returns `http://` unless something corrects the scope first.",
        "",
        "The fix is `ProxyHeadersMiddleware`. It reads `X-Forwarded-Proto` and `X-Forwarded-Host` and rewrites the scope before the application sees it. The important part is the trust boundary: those headers are only honoured when the direct client is in `trusted_hosts`.",
        "",
        "```python",
        "app.add_middleware(",
        "    ProxyHeadersMiddleware,",
        "    trusted_hosts=[\"10.0.0.0/8\"],",
        ")",
        "```",
        "",
        "Without that guard any client could send `X-Forwarded-Host` and make a password-reset link point at a host it controls.",
        "",
        "**Confidence: medium** — the issue and the review agree on the failure mode and the guard, but the commit itself is the only artifact describing the final shape of `trusted_hosts`.",
      ].join("\n"),
      confidence: "medium",
      status: "answered",
      citations: [
        cite("starlette:issue:1682"),
        cite("starlette:review_comment:643"),
        cite("starlette:commit:2f81c04"),
      ],
      graph_path: graphPaths.dec_starlette_url_for_forwarded,
      decisions: [
        decisions.dec_starlette_url_for_host_origin,
        decisions.dec_starlette_url_for_forwarded,
      ],
      superseded_by: null,
      retrieval_trace_id: "trace_url_for_5b73",
    }),
  },
];

export const starletteFixtures: RepoFixtures = {
  slug: REPO,
  questions: [
    "Why is the middleware added last the outermost layer?",
    "Why does a Mount route swallow paths that look like they belong to a later route?",
    "Why does url_for return http:// links behind a TLS-terminating proxy?",
    "Why was on_event replaced by the lifespan context manager?",
  ],
  refusalKeywords: ["http/3", "http3", "quic", "grpc", "graphql"],
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
    retrieval_trace_id: "trace_refusal_a41e",
    refusal: {
      reason:
        "No decision, commit or review in the evidence store discusses this topic. The nearest candidates are shown below, but none of them support a claim.",
      nearest_candidates: [
        cite("starlette:doc:docs/middleware.md"),
        cite("starlette:issue:1682", {
          excerpt:
            "Nearby topic (proxied URLs) only — it does not address this question.",
        }),
      ],
    },
  },
};
