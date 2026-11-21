import { Card, PageHero, Pill, Section } from "@/components/ui";

export const metadata = { title: "Technology" };

type Tech = {
  name: string;
  simple: string;
  role: string;
  status: { tone: "ok" | "warn" | "neutral"; text: string };
};

const TECH: Tech[] = [
  {
    name: "Git",
    simple: "The history of every change ever made to the code.",
    role: "The source of truth. Commits are mined for decisions, used to verify quotes, and diffed to tell whether a decision’s files have changed since it was agreed (renames are followed).",
    status: { tone: "ok", text: "Core · every feature uses it" },
  },
  {
    name: "tree-sitter",
    simple: "A fast parser that turns source code into a structured tree instead of plain text.",
    role: "Structural enrichment: finds functions, classes and code regions in changed files so evidence can point at a symbol, not just a line. Config keys come from YAML, TOML and .env files.",
    status: { tone: "warn", text: "Python only today · other languages get path-based detection" },
  },
  {
    name: "Neo4j",
    simple: "A graph database — data stored as things and the links between them.",
    role: "The evidence graph for fully ingested repositories: files, symbols, config keys, commits, pull requests, people and decisions, with typed links such as changed-in, decided-in, supersedes and reverses. Retrieval walks these links to collect context.",
    status: { tone: "warn", text: "Used by the deep pipeline · not needed for the ledger" },
  },
  {
    name: "Decision ledger",
    simple: "A small database that is the official record of each decision.",
    role: "SQLite tables for decisions, evidence rows and an authority log. Triggers make the log append-only at the database level. Stores verification levels and cached currency so the hosted API can answer without a checkout.",
    status: { tone: "ok", text: "Core · no external service, no AI key" },
  },
  {
    name: "Deterministic miners",
    simple: "Plain rules that recognise decisions in text.",
    role: "Read ADR layouts (Nygard, MADR, frontmatter), WHY:-style comments with continuation lines, commits with a choice-plus-reason, and PR decisions blocks. Same input, same output, every time.",
    status: { tone: "neutral", text: "Commit mining is heuristic · ~2 in 3 real decisions on httpx" },
  },
  {
    name: "Hybrid retrieval",
    simple: "Several search methods combined, so one blind spot doesn’t miss the answer.",
    role: "Exact identifier match, full-text search and vector (meaning) search, expanded through the graph, fused with weighted reciprocal-rank fusion and reranked. The result is packed into the only evidence the answer may cite.",
    status: { tone: "warn", text: "Deep pipeline · the hosted live path uses a lighter fetch" },
  },
  {
    name: "LLM (any OpenAI-compatible model)",
    simple: "The language model that phrases answers.",
    role: "A proposer, never the authority. It writes the answer text and cites evidence aliases. Code then validates every citation, computes confidence and decides whether the answer is allowed out. Bring your own model.",
    status: { tone: "neutral", text: "Only for phrasing and optional extraction" },
  },
  {
    name: "Citation validator",
    simple: "A checker that reads the answer and verifies every claim has real backing.",
    role: "Splits answers into claims, requires each to cite evidence from the pack, checks quotes, flags invented files, people, PR numbers, dates and SHAs, and refuses when support is missing.",
    status: { tone: "ok", text: "Enforced on every answer" },
  },
  {
    name: "MCP (Model Context Protocol)",
    simple: "A standard plug that lets AI coding tools call outside tools.",
    role: "A dependency-free stdio server so Claude Code, Cursor or Codex can call get_why, search_decisions, check_change and record_decision.",
    status: { tone: "ok", text: "Shipped" },
  },
  {
    name: "GitHub Action & webhooks",
    simple: "Automation that runs on every pull request.",
    role: "The Action rebuilds the ledger in CI, comments with the decisions a PR touches, and blocks unacknowledged changes to pinned ones. Webhooks bring merged PR decisions into force.",
    status: { tone: "neutral", text: "GitHub only · GitLab not yet" },
  },
  {
    name: "FastAPI + Next.js",
    simple: "The web server and the web app.",
    role: "FastAPI serves /ask, evidence, the ledger API and webhooks. Next.js renders the chat, the Decisions page, sharing and settings.",
    status: { tone: "ok", text: "Shipped" },
  },
];

const LAYERS = [
  ["Sources", "git history · PRs · reviews · ADRs · WHY: comments"],
  ["Understand", "miners · tree-sitter · LLM extraction (optional)"],
  ["Store", "decision ledger (SQLite) · evidence graph (Neo4j)"],
  ["Check", "quote verification · currency from git · citation validator"],
  ["Serve", "app (FastAPI + Next.js) · MCP for agents · GitHub Action"],
];

export default function TechnologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Technology"
        title="What each piece does, in plain words."
        intro="For every component: what it is, what Why-Code uses it for, and its honest status today."
      />

      <Section eyebrow="Architecture" title="Five layers. Truth is decided in the boring ones.">
        <ol className="overflow-hidden rounded-2xl border border-line">
          {LAYERS.map(([layer, parts], i) => (
            <li
              key={layer}
              className="grid grid-cols-[auto_1fr] gap-4 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[3rem_9rem_1fr]"
            >
              <span className="font-mono text-xs text-ink-faint">0{i + 1}</span>
              <span className="font-medium text-ink">{layer}</span>
              <span className="col-span-2 font-mono text-[13px] text-ink-soft sm:col-span-1">{parts}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-ink-soft">
          The model only appears in the second and fifth layers, and only to propose. Everything that decides whether a
          claim is true — verification, currency, citation checks, refusal — is ordinary code with tests.
        </p>
      </Section>

      <Section eyebrow="Components" title="The stack.">
        <div className="grid gap-4 md:grid-cols-2">
          {TECH.map((t) => (
            <Card key={t.name} className="flex flex-col">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-mono text-base text-ink">{t.name}</h3>
                <Pill tone={t.status.tone}>{t.status.text}</Pill>
              </div>
              <p className="mt-3 text-sm font-medium text-ink">{t.simple}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t.role}</p>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
