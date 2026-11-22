/** Every technology on the site: what it is, how it works, and how Why-Code uses it. */

export type Tech = {
  id: string;
  name: string;
  simple: string;
  how: string;
  use: string;
  status: { tone: "ok" | "warn" | "neutral"; text: string };
};

export const TECH: Tech[] = [
  {
    id: "git",
    name: "Git",
    simple: "The history of every change ever made to the code.",
    how: "Git stores each commit as a snapshot that points at its parent, so the difference between any two points in history can be computed exactly — including files that were renamed along the way.",
    use: "The source of truth. Commits are mined for decisions and used to verify quotes, and the diff from the commit where a decision was agreed to HEAD decides whether it is still active, needs review, or is stale.",
    status: { tone: "ok", text: "Core · every feature uses it" },
  },
  {
    id: "miners",
    name: "Deterministic miners",
    simple: "Plain rules that recognise decisions in text.",
    how: "Pattern matchers look for the shape of a decision — a marker like WHY:, a choice plus a reason, an ADR with an Accepted status — rather than asking a model to guess. The same input always gives the same output.",
    use: "Read ADR layouts (Nygard, MADR, frontmatter), WHY:-style comments with continuation lines, commits that state a choice and a reason, and PR decision blocks — each saved with a pointer to where it came from.",
    status: { tone: "neutral", text: "Commit mining is heuristic · ~2 in 3 real decisions on httpx" },
  },
  {
    id: "tree-sitter",
    name: "tree-sitter",
    simple: "A fast parser that turns source code into a tree instead of plain text.",
    how: "tree-sitter builds a concrete syntax tree for a file: every class, function, assignment and comment becomes a typed node with exact line and byte ranges, and it re-parses incrementally as code changes.",
    use: "Structural enrichment: finds the functions, classes and regions in changed files so evidence points at a symbol like Client.send rather than a bare line number. Config keys come from YAML, TOML and .env files.",
    status: { tone: "warn", text: "Python only today · others use path-based detection" },
  },
  {
    id: "neo4j",
    name: "Neo4j",
    simple: "A graph database — data stored as things and the links between them.",
    how: "Nodes (a file, a commit, a person) are joined by typed, directed relationships. Queries walk those relationships hop by hop, which makes “everything connected to this file” a cheap question.",
    use: "The evidence graph for fully ingested repositories: Decision –GOVERNS→ File, Decision –PRODUCED_IN→ PullRequest, PullRequest –HAS_COMMIT→ Commit, Person –AUTHORED→ PullRequest and more. Retrieval expands from the seed to collect connected context.",
    status: { tone: "warn", text: "Deep pipeline · not needed for the ledger" },
  },
  {
    id: "ledger",
    name: "Decision ledger",
    simple: "A small database that is the official record of each decision.",
    how: "SQLite is a full SQL database in a single file — no server. Triggers are rules inside the database that run on every write and can abort it.",
    use: "Tables for decisions, evidence rows and an authority log of who recorded, accepted, pinned or withdrew each decision. Triggers abort any UPDATE or DELETE on that log, so history can only grow. Cached currency lets the hosted API answer without a checkout.",
    status: { tone: "ok", text: "Core · no external service, no AI key" },
  },
  {
    id: "retrieval",
    name: "Hybrid retrieval",
    simple: "Several search methods combined, so one blind spot doesn't miss the answer.",
    how: "Exact match finds identifiers, full-text (BM25) finds keywords, vectors find meaning, graph expansion finds neighbours. Weighted reciprocal-rank fusion merges the lists using only ranks: weight ÷ (k + rank), with k = 60.",
    use: "Four retrievers with weights exact 5, graph 2.5, full-text 2 and vector 1.5, then a deterministic reranker that puts active decisions first. The result is packed as [E1]…[En] — the only evidence an answer may cite.",
    status: { tone: "warn", text: "Deep pipeline · the hosted live path uses a lighter fetch" },
  },
  {
    id: "distilbert",
    name: "DistilBERT intent",
    simple: "A compact language model that works out what kind of question you asked.",
    how: "DistilBERT is a smaller, faster distilled version of BERT. It turns a sentence into an embedding — a list of 768 numbers where similar meanings land close together — in tens of milliseconds on a CPU.",
    use: "Keyword rules classify most questions instantly; the rest are embedded with DistilBERT and matched to labelled example questions. The intent (why, who, where, how, history, comparison) picks the answer layout in prompt.py. It shapes presentation only — never what is true.",
    status: { tone: "neutral", text: "Optional · keyword fallback without it" },
  },
  {
    id: "llm",
    name: "LLM + citation validator",
    simple: "A language model writes the answer; a separate checker decides if it may be shown.",
    how: "Any OpenAI-compatible model can draft text from the evidence it is given. A model cannot certify its own citations, so a deterministic checker reads the draft afterwards.",
    use: "The model only proposes. Code splits the draft into claims, requires each to cite evidence from the pack, flags invented files, people, PR numbers, dates and SHAs, computes confidence itself, and refuses when support is missing.",
    status: { tone: "ok", text: "Validator enforced on every answer" },
  },
  {
    id: "mcp",
    name: "MCP",
    simple: "A standard plug that lets AI coding tools call outside tools.",
    how: "The Model Context Protocol defines how an AI client lists and calls tools over a simple channel such as stdio, so one server works with many agents.",
    use: "A dependency-free stdio server exposing get_why, search_decisions, check_change and record_decision, so Claude Code, Cursor or Codex learn the rules before they edit. Agents may propose decisions, never approve them.",
    status: { tone: "ok", text: "Shipped" },
  },
  {
    id: "github-action",
    name: "GitHub Action",
    simple: "Automation that runs on every pull request.",
    how: "Actions run a workflow in CI on repository events and report back as a check that can block merging.",
    use: "Rebuilds the ledger in CI, comments with the decisions a PR touches, and fails when a pinned decision changes without a Decision-Ack: line. Webhooks bring merged PR decisions into force.",
    status: { tone: "neutral", text: "GitHub only · GitLab not yet" },
  },
];
