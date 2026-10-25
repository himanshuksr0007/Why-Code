/**
 * Sample fixtures for `encode/httpx`.
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

export const REPO = "encode/httpx";

const NAMES: Record<string, string> = {
  tomchristie: "Tom Christie",
  florimondmanca: "Florimond Manca",
  sethmlarson: "Seth Michael Larson",
  adriangb: "Adrian Garcia Badaracco",
  pgjones: "Phil Jones",
};

const TAGS: Record<string, string[]> = {
  tomchristie: ["Maintainer"],
  florimondmanca: ["Maintainer"],
  sethmlarson: ["Maintainer"],
  adriangb: ["Contributor"],
  pgjones: ["Contributor"],
};

const { dir, person, participant } = directory(NAMES, TAGS);

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

const evidence: Record<string, EvidenceDetail> = {
  "httpx:review_comment:812": {
    evidence_id: "httpx:review_comment:812",
    record_type: "review_comment",
    source_type: "review_comment",
    repo: REPO,
    pr_number: 1131,
    author: "tomchristie",
    created_at: "2021-03-12T09:41:00Z",
    url: "https://github.com/encode/httpx/pull/1131#discussion_r812",
    title: "re: retries in HTTPTransport",
    excerpt:
      "If retries happen silently we make connection failures impossible to reason about. Let's default to zero and let the caller opt in.",
    body:
      "If retries happen silently we make connection failures impossible to reason about. A caller that wants resilience should ask for it explicitly.\n\nLet's default `retries` to `0` on the transport and keep the retry policy a transport concern rather than a client one.",
    payload: {
      path: "httpx/_transports/default.py",
      line: 214,
      start_line: 210,
      side: "RIGHT",
      in_reply_to_id: 811,
    },
  },
  "httpx:commit:5f3a1c9": {
    evidence_id: "httpx:commit:5f3a1c9",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 1131,
    author: "tomchristie",
    created_at: "2021-03-13T16:02:00Z",
    url: "https://github.com/encode/httpx/commit/5f3a1c9",
    title: "Default transport retries to zero",
    excerpt:
      "HTTPTransport(retries=0) by default; retry policy stays on the transport, not the client.",
    payload: {
      sha: "5f3a1c9",
      files: [
        { filename: "httpx/_transports/default.py", additions: 6, deletions: 4 },
      ],
    },
  },
  "httpx:pr:1131": {
    evidence_id: "httpx:pr:1131",
    record_type: "pull_request",
    source_type: "pull_request",
    repo: REPO,
    pr_number: 1131,
    author: "tomchristie",
    created_at: "2021-03-14T11:20:00Z",
    url: "https://github.com/encode/httpx/pull/1131",
    title: "Make retries opt-in on HTTPTransport",
    excerpt:
      "Makes retries opt-in: no automatic retries unless a caller configures them on the transport.",
    payload: { number: 1131, merged: true, files_changed: 3 },
  },
  "httpx:issue_comment:4021": {
    evidence_id: "httpx:issue_comment:4021",
    record_type: "issue_comment",
    source_type: "issue_comment",
    repo: REPO,
    pr_number: null,
    author: "florimondmanca",
    created_at: "2020-11-02T14:15:00Z",
    url: "https://github.com/encode/httpx/issues/1182#issuecomment-4021",
    title: "re: environment proxy handling",
    excerpt:
      "Reading the environment proxies unconditionally surprised people running inside CI. It should be scoped to when the caller asks for it.",
    payload: { issue_number: 1182, author_association: "MEMBER" },
  },
  "httpx:commit:9b1e0d4": {
    evidence_id: "httpx:commit:9b1e0d4",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 1182,
    author: "florimondmanca",
    created_at: "2020-11-04T08:30:00Z",
    url: "https://github.com/encode/httpx/commit/9b1e0d4",
    title: "Only read proxy env vars when trust_env is enabled",
    excerpt:
      "Guard the proxy environment lookups behind trust_env so an explicit client config always wins.",
    payload: {
      sha: "9b1e0d4",
      files: [{ filename: "httpx/_config.py", additions: 12, deletions: 9 }],
    },
  },
  "httpx:review_comment:770": {
    evidence_id: "httpx:review_comment:770",
    record_type: "review_comment",
    source_type: "review_comment",
    repo: REPO,
    pr_number: 1182,
    author: "tomchristie",
    created_at: "2020-11-03T10:05:00Z",
    url: "https://github.com/encode/httpx/pull/1182#discussion_r770",
    title: "re: trust_env scope",
    excerpt:
      "An explicitly configured proxy should always win over the environment — otherwise configuration is not deterministic.",
    payload: { path: "httpx/_config.py", line: 96, side: "RIGHT" },
  },
  "httpx:commit:c41f0a7": {
    evidence_id: "httpx:commit:c41f0a7",
    record_type: "commit",
    source_type: "commit",
    repo: REPO,
    pr_number: 1215,
    author: "tomchristie",
    created_at: "2023-05-09T13:44:00Z",
    url: "https://github.com/encode/httpx/commit/c41f0a7",
    title: "Use a sentinel for the default timeout",
    excerpt:
      "Replace the implicit 5s default with a sentinel so 'unset' and 'explicitly zero' stop meaning the same thing.",
    payload: {
      sha: "c41f0a7",
      files: [{ filename: "httpx/_config.py", additions: 18, deletions: 7 }],
    },
  },
  "httpx:issue:108": {
    evidence_id: "httpx:issue:108",
    record_type: "issue",
    source_type: "issue",
    repo: REPO,
    pr_number: null,
    author: "sethmlarson",
    created_at: "2022-01-18T17:22:00Z",
    url: "https://github.com/encode/httpx/issues/108",
    title: "Default timeouts surprise new users",
    excerpt:
      "New users hit a 5 second default timeout and assume the library is broken rather than slow.",
    payload: { number: 108, state: "closed" },
  },
  "httpx:doc:docs/advanced.md": {
    evidence_id: "httpx:doc:docs/advanced.md",
    record_type: "doc_file",
    source_type: "doc_file",
    repo: REPO,
    pr_number: null,
    author: null,
    created_at: null,
    url: "https://github.com/encode/httpx/blob/master/docs/advanced.md",
    title: "docs/advanced.md",
    excerpt:
      "Documentation for configuring timeouts, proxies and environment-variable handling.",
    payload: { path: "docs/advanced.md" },
  },
};

const cite = makeCiter(evidence);

/* ------------------------------------------------------------------ */
/* Decisions                                                           */
/* ------------------------------------------------------------------ */

const decisions: Record<string, Decision> = {
  dec_httpx_retry_default: {
    decision_id: "dec_httpx_retry_default",
    title: "Retries are opt-in on the transport",
    claim: "Simple retries are disabled by default and stay a transport concern.",
    status: "active",
    confidence: "high",
    pr_number: 1131,
    created_at: "2021-03-14T11:20:00Z",
    targets: [
      { type: "Symbol", identifier: "httpx.HTTPTransport.__init__" },
      { type: "ConfigKey", identifier: "retries" },
    ],
    evidence_ids: [
      "httpx:review_comment:812",
      "httpx:commit:5f3a1c9",
      "httpx:pr:1131",
    ],
  },
  dec_httpx_trust_env_origin: {
    decision_id: "dec_httpx_trust_env_origin",
    title: "Environment proxies are always honoured",
    claim: "The client always reads proxy environment variables.",
    status: "reversed",
    confidence: "medium",
    pr_number: 1094,
    created_at: "2020-08-21T09:00:00Z",
    targets: [{ type: "ConfigKey", identifier: "trust_env" }],
    evidence_ids: ["httpx:issue_comment:4021"],
    superseded_by: "dec_httpx_trust_env_scoped",
  },
  dec_httpx_trust_env_scoped: {
    decision_id: "dec_httpx_trust_env_scoped",
    title: "Environment proxies are scoped to trust_env",
    claim:
      "Proxy environment variables are honoured only when trust_env is enabled, so explicit configuration wins.",
    status: "active",
    confidence: "high",
    pr_number: 1182,
    created_at: "2020-11-04T08:30:00Z",
    targets: [
      { type: "ConfigKey", identifier: "trust_env" },
      { type: "Symbol", identifier: "httpx.Client.__init__" },
    ],
    evidence_ids: [
      "httpx:issue_comment:4021",
      "httpx:review_comment:770",
      "httpx:commit:9b1e0d4",
    ],
    supersedes: "dec_httpx_trust_env_origin",
  },
  dec_httpx_timeout_explicit: {
    decision_id: "dec_httpx_timeout_explicit",
    title: "Timeout defaults are a sentinel, not 5 seconds",
    claim:
      "An unset timeout uses a sentinel; only explicit values are applied, so 'unset' and 'zero' no longer collide.",
    status: "active",
    confidence: "medium",
    pr_number: 1215,
    created_at: "2023-05-09T13:44:00Z",
    targets: [
      { type: "ConfigKey", identifier: "timeout" },
      { type: "Symbol", identifier: "httpx._config.Timeout" },
    ],
    evidence_ids: ["httpx:issue:108", "httpx:commit:c41f0a7"],
    supersedes: "dec_httpx_timeout_five_seconds",
  },
  dec_httpx_timeout_five_seconds: {
    decision_id: "dec_httpx_timeout_five_seconds",
    title: "A 5 second default timeout",
    claim: "Every request is subject to a default 5 second timeout.",
    status: "contested",
    confidence: "low",
    pr_number: 981,
    created_at: "2019-10-02T12:00:00Z",
    targets: [{ type: "ConfigKey", identifier: "timeout" }],
    evidence_ids: ["httpx:issue:108"],
    superseded_by: "dec_httpx_timeout_explicit",
  },
};

const threads = [
  thread("thread_retries", "Retry defaults", [
    origin(decisions.dec_httpx_retry_default),
  ]),
  thread("thread_trust_env", "Proxy environment variable handling", [
    origin(decisions.dec_httpx_trust_env_origin),
    reversal(decisions.dec_httpx_trust_env_scoped),
  ]),
  thread("thread_timeout", "Timeout defaults", [
    origin(decisions.dec_httpx_timeout_five_seconds),
    revision(decisions.dec_httpx_timeout_explicit),
  ]),
];

/* ------------------------------------------------------------------ */
/* Graph paths                                                         */
/* ------------------------------------------------------------------ */

const graphPaths: Record<string, GraphPath> = {
  dec_httpx_retry_default: chain(
    [
      ["key", "ConfigKey", "retries = 0"],
      ["sym", "Symbol", "httpx.HTTPTransport.__init__"],
      ["reg", "CodeRegion", "httpx/_transports/default.py:210-224"],
      ["commit", "Commit", "5f3a1c9"],
      ["pr", "PullRequest", "#1131"],
      ["dec", "Decision", "dec_httpx_retry_default"],
      ["ev", "Evidence", "httpx:review_comment:812"],
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
  dec_httpx_trust_env_scoped: chain(
    [
      ["key", "ConfigKey", "trust_env"],
      ["sym", "Symbol", "httpx.Client.__init__"],
      ["reg", "CodeRegion", "httpx/_config.py:88-104"],
      ["commit", "Commit", "9b1e0d4"],
      ["pr", "PullRequest", "#1182"],
      ["dec", "Decision", "dec_httpx_trust_env_scoped"],
      ["ev", "Evidence", "httpx:review_comment:770"],
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
  dec_httpx_timeout_explicit: chain(
    [
      ["key", "ConfigKey", "timeout"],
      ["sym", "Symbol", "httpx._config.Timeout"],
      ["reg", "CodeRegion", "httpx/_config.py:300-342"],
      ["commit", "Commit", "c41f0a7"],
      ["pr", "PullRequest", "#1215"],
      ["dec", "Decision", "dec_httpx_timeout_explicit"],
      ["ev", "Evidence", "httpx:commit:c41f0a7"],
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
  1094: pullRequest({
    number: 1094,
    repo: REPO,
    title: "Honour proxy environment variables by default",
    author: person("florimondmanca"),
    created_at: "2020-08-19T09:00:00Z",
    merged_at: "2020-08-21T09:00:00Z",
    reviewers: [person("tomchristie")],
    participants: [
      participant("florimondmanca", ["author", "committer"], 3),
      participant("tomchristie", ["reviewer", "commenter"], 2),
    ],
    changed_files: [file("httpx/_client.py", "modified", 5, 1)],
    commits: [
      commit(
        "7d2f0aa",
        "Read proxy environment variables by default",
        person("florimondmanca"),
        "2020-08-21T09:00:00Z",
      ),
    ],
    decision_ids: ["dec_httpx_trust_env_origin"],
    body: "Makes proxy environment variables apply without any explicit client configuration. Later reversed in favour of scoping them to trust_env.",
  }),
  1131: pullRequest({
    number: 1131,
    repo: REPO,
    title: "Make retries opt-in on HTTPTransport",
    author: person("tomchristie"),
    created_at: "2021-03-10T09:00:00Z",
    merged_at: "2021-03-14T11:20:00Z",
    reviewers: [person("florimondmanca"), person("adriangb")],
    participants: [
      participant("tomchristie", ["author", "committer"], 6),
      participant("florimondmanca", ["reviewer", "commenter"], 3),
      participant("adriangb", ["reviewer", "commenter"], 2),
    ],
    changed_files: [
      file("httpx/_transports/default.py", "modified", 6, 4),
      file("httpx/_client.py", "modified", 2, 1),
    ],
    commits: [
      commit(
        "5f3a1c9",
        "Default transport retries to zero",
        person("tomchristie"),
        "2021-03-13T16:02:00Z",
      ),
    ],
    decision_ids: ["dec_httpx_retry_default"],
    body: "Makes retries opt-in: no automatic retries unless a caller configures them on the transport.",
  }),
  1182: pullRequest({
    number: 1182,
    repo: REPO,
    title: "Scope proxy environment handling to trust_env",
    author: person("florimondmanca"),
    created_at: "2020-10-28T10:00:00Z",
    merged_at: "2020-11-04T08:30:00Z",
    reviewers: [person("tomchristie"), person("sethmlarson")],
    participants: [
      participant("florimondmanca", ["author", "committer"], 5),
      participant("tomchristie", ["reviewer", "commenter"], 4),
      participant("sethmlarson", ["reviewer", "commenter"], 3),
      participant("pgjones", ["commenter"], 1),
    ],
    changed_files: [
      file("httpx/_client.py", "modified", 12, 9),
      file("docs/advanced.md", "modified", 8, 2),
    ],
    commits: [
      commit(
        "9b1e0d4",
        "Only read proxy env vars when trust_env is enabled",
        person("florimondmanca"),
        "2020-11-04T08:30:00Z",
      ),
    ],
    decision_ids: ["dec_httpx_trust_env_scoped", "dec_httpx_trust_env_origin"],
    body: "Guards proxy environment lookups behind trust_env so an explicit client configuration always wins.",
  }),
  1215: pullRequest({
    number: 1215,
    repo: REPO,
    title: "Use a sentinel for the default timeout",
    author: person("tomchristie"),
    created_at: "2023-05-04T12:00:00Z",
    merged_at: "2023-05-09T13:44:00Z",
    reviewers: [person("sethmlarson"), person("adriangb")],
    participants: [
      participant("tomchristie", ["author", "committer"], 7),
      participant("sethmlarson", ["reviewer", "commenter"], 4),
      participant("adriangb", ["reviewer", "commenter"], 2),
    ],
    changed_files: [
      file("httpx/_config.py", "modified", 18, 7),
      file("httpx/_client.py", "modified", 4, 3),
      file("tests/test_timeouts.py", "added", 22, 0),
    ],
    commits: [
      commit(
        "c41f0a7",
        "Use a sentinel for the default timeout",
        person("tomchristie"),
        "2023-05-09T13:44:00Z",
      ),
    ],
    decision_ids: ["dec_httpx_timeout_explicit"],
    body: "An unset timeout and an explicit zero should not mean the same thing.",
  }),
  981: pullRequest({
    number: 981,
    repo: REPO,
    title: "Add a default timeout to every request",
    author: person("sethmlarson"),
    created_at: "2019-09-27T09:00:00Z",
    merged_at: "2019-10-02T12:00:00Z",
    reviewers: [person("tomchristie")],
    participants: [
      participant("sethmlarson", ["author", "committer"], 4),
      participant("tomchristie", ["reviewer", "commenter"], 3),
    ],
    changed_files: [file("httpx/_config.py", "modified", 20, 0)],
    commits: [
      commit(
        "a1b2c3d",
        "Apply a default 5 second timeout",
        person("sethmlarson"),
        "2019-10-02T12:00:00Z",
      ),
    ],
    decision_ids: ["dec_httpx_timeout_five_seconds"],
    body: "Applies a default 5 second timeout so that a hung connection cannot block forever.",
  }),
};

/* ------------------------------------------------------------------ */
/* Code changes + reasoning                                            */
/* ------------------------------------------------------------------ */

const CHANGE_FIXTURES: CodeChange[] = [
  {
    change_id: "change_httpx_retries_default",
    path: "httpx/_transports/default.py",
    symbol: "httpx.HTTPTransport.__init__",
    change_kind: "modified",
    additions: 6,
    deletions: 4,
    start_line: 210,
    end_line: 224,
    code_before: [
      "def __init__(self, verify=True, cert=None, http1=True, http2=False):",
      "    ...",
      "    self._pool = httpcore.ConnectionPool(",
      "        ssl_context=ssl_context, max_connections=100)",
    ].join("\n"),
    code_after: [
      "def __init__(self, verify=True, cert=None, http1=True, http2=False, retries=0):",
      "    ...",
      "    self._pool = httpcore.ConnectionPool(",
      "        ssl_context=ssl_context, max_connections=100, retries=retries)",
    ].join("\n"),
    reasoning: decisions.dec_httpx_retry_default.claim,
    decision: decisions.dec_httpx_retry_default,
    evidence_ids: decisions.dec_httpx_retry_default.evidence_ids,
    pr: prRef(pullRequests[1131]),
    author: person("tomchristie"),
  },
  {
    change_id: "change_httpx_client_retries_wiring",
    path: "httpx/_client.py",
    symbol: "httpx.Client.__init__",
    change_kind: "modified",
    additions: 2,
    deletions: 1,
    start_line: 640,
    end_line: 652,
    code_before: [
      "self._transport = transport or HTTPTransport(",
      "    verify=verify, cert=cert, http1=http1, http2=http2)",
    ].join("\n"),
    code_after: [
      "self._transport = transport or HTTPTransport(",
      "    verify=verify, cert=cert, http1=http1, http2=http2,",
      "    retries=retries)",
    ].join("\n"),
    reasoning:
      "The client only forwards the retry setting; the policy itself stays on the transport. A review comment set this boundary.",
    decision: decisions.dec_httpx_retry_default,
    evidence_ids: ["httpx:review_comment:812", "httpx:commit:5f3a1c9"],
    pr: prRef(pullRequests[1131]),
    author: person("tomchristie"),
  },
  {
    change_id: "change_httpx_trust_env_guard",
    path: "httpx/_client.py",
    symbol: "httpx.Client.__init__",
    change_kind: "modified",
    additions: 12,
    deletions: 9,
    start_line: 88,
    end_line: 104,
    code_before: [
      'proxy = (\n    proxy\n    or os.environ.get("HTTPS_PROXY")\n    or os.environ.get("HTTP_PROXY")\n)',
    ].join("\n"),
    code_after: [
      'if trust_env:\n    proxy = proxy or os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")\nelse:\n    proxy = proxy',
    ].join("\n"),
    reasoning: decisions.dec_httpx_trust_env_scoped.claim,
    decision: decisions.dec_httpx_trust_env_scoped,
    evidence_ids: decisions.dec_httpx_trust_env_scoped.evidence_ids,
    pr: prRef(pullRequests[1182]),
    author: person("florimondmanca"),
  },
  {
    change_id: "change_httpx_trust_env_docs",
    path: "docs/advanced.md",
    symbol: null,
    change_kind: "modified",
    additions: 8,
    deletions: 2,
    reasoning:
      "The documentation was updated in the same pull request so the behaviour change is discoverable, not just implemented.",
    decision: decisions.dec_httpx_trust_env_scoped,
    evidence_ids: ["httpx:review_comment:770", "httpx:commit:9b1e0d4"],
    pr: prRef(pullRequests[1182]),
    author: person("florimondmanca"),
  },
  {
    change_id: "change_httpx_timeout_sentinel",
    path: "httpx/_config.py",
    symbol: "httpx._config.Timeout",
    change_kind: "modified",
    additions: 18,
    deletions: 7,
    start_line: 300,
    end_line: 342,
    code_before: [
      "DEFAULT_TIMEOUT = 5.0",
      "",
      "def __init__(self, timeout=None):",
      "    self._timeout = timeout or DEFAULT_TIMEOUT",
    ].join("\n"),
    code_after: [
      "class UnsetType: ...",
      "UNSET = UnsetType()",
      "",
      "def __init__(self, timeout=UNSET):",
      "    self._timeout = None if timeout is UNSET else timeout",
    ].join("\n"),
    reasoning: decisions.dec_httpx_timeout_explicit.claim,
    decision: decisions.dec_httpx_timeout_explicit,
    evidence_ids: decisions.dec_httpx_timeout_explicit.evidence_ids,
    pr: prRef(pullRequests[1215]),
    author: person("tomchristie"),
  },
  {
    change_id: "change_httpx_timeout_tests",
    path: "tests/test_timeouts.py",
    symbol: null,
    change_kind: "added",
    additions: 22,
    deletions: 0,
    reasoning:
      "New tests pin the three timeout states (unset, explicit None, explicit value) so the sentinel behaviour cannot regress silently.",
    decision: decisions.dec_httpx_timeout_explicit,
    evidence_ids: ["httpx:commit:c41f0a7"],
    pr: prRef(pullRequests[1215]),
    author: person("tomchristie"),
  },
  {
    change_id: "change_httpx_trust_env_origin",
    path: "httpx/_client.py",
    symbol: "httpx.Client.__init__",
    change_kind: "modified",
    additions: 5,
    deletions: 1,
    reasoning: decisions.dec_httpx_trust_env_origin.claim,
    decision: decisions.dec_httpx_trust_env_origin,
    evidence_ids: decisions.dec_httpx_trust_env_origin.evidence_ids,
    pr: prRef(pullRequests[1094]),
    author: person("florimondmanca"),
  },
  {
    change_id: "change_httpx_timeout_origin",
    path: "httpx/_config.py",
    symbol: "httpx._config.Timeout",
    change_kind: "added",
    additions: 20,
    deletions: 0,
    reasoning: decisions.dec_httpx_timeout_five_seconds.claim,
    decision: decisions.dec_httpx_timeout_five_seconds,
    evidence_ids: decisions.dec_httpx_timeout_five_seconds.evidence_ids,
    pr: prRef(pullRequests[981]),
    author: person("sethmlarson"),
  },
];

const changes = sortChanges(CHANGE_FIXTURES);

/* ------------------------------------------------------------------ */
/* Answers                                                             */
/* ------------------------------------------------------------------ */

const answers: MockAnswer[] = [
  {
    id: "retries",
    keywords: ["retry", "retries"],
    build: () => ({
      answer: [
        "Retries are **off by default**. A request maps to exactly one network attempt unless the caller opts in.",
        "",
        "The behaviour lives on the transport, not the client. `HTTPTransport` takes a `retries` setting that defaults to `0`, so a caller who wants resilience has to ask for it:",
        "",
        "```python",
        "transport = httpx.HTTPTransport(retries=3)",
        "```",
        "",
        "The history explains the choice rather than the code:",
        "",
        "1. A review on the transport change argued that silent retries make connection failures impossible to reason about.",
        "2. The merge commit then wired `retries=0` through the transport.",
        "",
        "**Confidence: high** — a review comment alone would cap this at medium; here a review comment, the merge commit and the PR agree.",
      ].join("\n"),
      confidence: "high",
      status: "answered",
      citations: [
        cite("httpx:review_comment:812"),
        cite("httpx:commit:5f3a1c9"),
        cite("httpx:pr:1131"),
      ],
      graph_path: graphPaths.dec_httpx_retry_default,
      decisions: [decisions.dec_httpx_retry_default],
      superseded_by: null,
      retrieval_trace_id: "trace_retries_7f21",
    }),
  },
  {
    id: "trust_env",
    keywords: ["trust_env", "proxy", "environment variable", "env var"],
    build: () => ({
      answer: [
        "Proxy **environment variables are scoped to `trust_env`**. An explicitly configured proxy always wins.",
        "",
        "The original behaviour read the environment unconditionally, which surprised people running inside CI. The revision guards those lookups behind `trust_env`:",
        "",
        "- `trust_env=True` — environment proxies and `.netrc` are honoured.",
        "- `trust_env=False` — only explicitly configured values are used.",
        "",
        "**Confidence: medium** — the issue discussion and the review agree, but the change itself landed across a single commit, so there is no second independent artifact confirming intent.",
      ].join("\n"),
      confidence: "medium",
      status: "answered",
      citations: [
        cite("httpx:issue_comment:4021"),
        cite("httpx:review_comment:770"),
        cite("httpx:commit:9b1e0d4"),
      ],
      graph_path: graphPaths.dec_httpx_trust_env_scoped,
      decisions: [
        decisions.dec_httpx_trust_env_origin,
        decisions.dec_httpx_trust_env_scoped,
      ],
      superseded_by: null,
      retrieval_trace_id: "trace_trust_env_3a90",
    }),
  },
  {
    id: "timeout",
    keywords: ["timeout", "timeouts", "sentinel"],
    build: () => ({
      answer: [
        'An unset timeout now uses a **sentinel**, so "unset" and "explicitly zero" stop meaning the same thing.',
        "",
        "Earlier the library applied an implicit 5 second default. New users hit it and assumed the library was broken rather than slow. The revision distinguishes three states:",
        "",
        "- unset — use the library default pool policy,",
        "- explicit `None` — no timeout,",
        "- explicit value — apply it.",
        "",
        "**Confidence: medium** — the issue motivates the change and the commit implements it, but this pass did not find a review that independently confirms the sentinel shape.",
        "",
        "**Partial answer:** evidence for the *reason* is solid; evidence for why a sentinel was chosen over a plain default is thin.",
      ].join("\n"),
      confidence: "medium",
      status: "partial",
      citations: [cite("httpx:issue:108"), cite("httpx:commit:c41f0a7")],
      graph_path: graphPaths.dec_httpx_timeout_explicit,
      decisions: [
        decisions.dec_httpx_timeout_five_seconds,
        decisions.dec_httpx_timeout_explicit,
      ],
      superseded_by: null,
      retrieval_trace_id: "trace_timeout_b104",
    }),
  },
];

export const httpxFixtures: RepoFixtures = {
  slug: REPO,
  questions: [
    "Why are retries disabled by default?",
    "Why does the client only read proxy environment variables when trust_env is set?",
    "Why is the default timeout a sentinel value?",
    "Why is HTTP/3 not supported?",
  ],
  refusalKeywords: ["http/3", "http3", "quic", "websocket", "graphql"],
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
    retrieval_trace_id: "trace_refusal_5c07",
    refusal: {
      reason:
        "No decision, commit or review in the evidence store discusses this topic. The nearest candidates are shown below, but none of them support a claim.",
      nearest_candidates: [
        cite("httpx:doc:docs/advanced.md"),
        cite("httpx:issue:108", {
          excerpt:
            "Nearby topic (timeouts) only — it does not address this question.",
        }),
      ],
    },
  },
};
