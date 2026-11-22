import Link from "next/link";
import { ArrowRightIcon, BookOpenTextIcon, ShieldCheckIcon, CircleSlashIcon } from "lucide-react";

import { AskDemo } from "@/components/ask-demo";
import { ArchitectureDiagram } from "@/components/diagrams/architecture-diagram";
import { PipelineAnimation } from "@/components/pipeline-animation";
import { Card, Section } from "@/components/ui";
import { SITE } from "@/lib/site";

const ASKS = [
  {
    ask: "Why is this code like this?",
    get: "The decision behind it, the reason, and the exact commit, comment or ADR it came from — each quote checked against the repository.",
  },
  {
    ask: "Is that reason still true?",
    get: "Whether the files it governs have changed since it was agreed: active, needs review, or stale. Worked out from git, not from an AI's opinion.",
  },
  {
    ask: "Who decided, and who signed off?",
    get: "An append-only log of who recorded, accepted, pinned or withdrew each decision. The database refuses edits to that log.",
  },
  {
    ask: "Is my change about to break an agreed rule?",
    get: "A pull-request check that lists the decisions your diff touches and blocks changes to pinned ones unless you acknowledge them.",
  },
  {
    ask: "What should my coding agent know before editing?",
    get: "An MCP server: Claude Code, Cursor or Codex call get_why on a path and get the decisions in force over it.",
  },
  {
    ask: "And when nobody ever wrote the reason down?",
    get: "It says so. No evidence, no answer — you get a refusal instead of a plausible guess.",
  },
];

const TECH = [
  ["git", "Git"],
  ["miners", "Rule miners"],
  ["tree-sitter", "tree-sitter"],
  ["neo4j", "Neo4j"],
  ["ledger", "Decision ledger (SQLite)"],
  ["retrieval", "Hybrid retrieval"],
  ["distilbert", "DistilBERT"],
  ["llm", "Citation validator"],
  ["mcp", "MCP"],
  ["github-action", "GitHub Action"],
] as const;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-line">
        <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-20 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-28">
          <div className="hero-in">
            <p className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 font-mono text-[11px] text-ink-soft">
              <span className="ping size-1.5 rounded-full bg-ok" aria-hidden="true" />
              Open source · core needs no AI key
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Code says <span className="text-ink-faint">what</span>.
              <br />
              Why-Code keeps the <span className="underline decoration-line-strong decoration-2 underline-offset-8">why</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Every codebase is full of decisions — &ldquo;retries are off on purpose&rdquo;, &ldquo;money is stored in
              cents&rdquo;. The reasons live in old pull requests and comments nobody rereads. Why-Code finds them,
              checks them against your code, keeps a record of who agreed to them, and answers{" "}
              <em className="text-ink not-italic">why</em> with proof — or says it doesn&rsquo;t know.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/how-it-works"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-canvas transition-opacity hover:opacity-85"
              >
                See how it works
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
              <a
                href={SITE.appUrl}
                className="inline-flex h-11 items-center rounded-lg border border-line-strong px-5 text-sm font-medium text-ink transition-colors hover:bg-raised"
              >
                Try the live app
              </a>
            </div>
          </div>
          <div className="rise" style={{ animationDelay: "300ms" }}>
            <AskDemo />
          </div>
        </div>
      </div>

      {/* Plain words */}
      <Section
        eyebrow="In plain words"
        title="A memory for your codebase that shows its receipts."
        intro="Think of it as the team member who read every pull request ever merged, wrote down each decision with a link to where it was made, and notices when the code drifts away from what was agreed."
      >
        <div className="stagger grid gap-4 md:grid-cols-3">
          <Card>
            <BookOpenTextIcon className="size-5 text-ink" aria-hidden="true" />
            <h3 className="mt-4 font-medium">1. It reads what you already wrote</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Commit messages, pull requests, reviews, ADR documents and <code className="font-mono text-ink">WHY:</code>{" "}
              comments. Nothing new to fill in to get started.
            </p>
          </Card>
          <Card>
            <ShieldCheckIcon className="size-5 text-ink" aria-hidden="true" />
            <h3 className="mt-4 font-medium">2. It records and checks decisions</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Each decision is saved with the files it governs and the exact quote it came from. Quotes are verified
              against the repo; git tells it when the code has moved on.
            </p>
          </Card>
          <Card>
            <CircleSlashIcon className="size-5 text-ink" aria-hidden="true" />
            <h3 className="mt-4 font-medium">3. It answers — or refuses</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Answers cite only evidence it actually fetched. A citation that doesn&rsquo;t check out is dropped; an answer
              with none is withheld.
            </p>
          </Card>
        </div>
      </Section>

      {/* Working model */}
      <Section
        id="working-model"
        eyebrow="The working model"
        title="From a comment in your repo to a rule your whole team — and your AI — can see."
        intro="This walks through what happens to one real kind of input. Hover to pause, or click a step."
      >
        <PipelineAnimation />
      </Section>

      {/* You ask / you get */}
      <Section eyebrow="What you get" title="Questions it answers, and how.">
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Questions and what Why-Code returns</caption>
            <thead className="bg-surface text-xs tracking-wider text-ink-faint uppercase">
              <tr>
                <th scope="col" className="w-[38%] px-5 py-3 font-medium">You ask</th>
                <th scope="col" className="px-5 py-3 font-medium">Why-Code gives you</th>
              </tr>
            </thead>
            <tbody>
              {ASKS.map((row) => (
                <tr key={row.ask} className="border-t border-line align-top">
                  <th scope="row" className="px-5 py-4 font-medium text-ink">{row.ask}</th>
                  <td className="px-5 py-4 leading-relaxed text-ink-soft">{row.get}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Honest teaser */}
      <Section
        eyebrow="The honest part"
        title="ChatGPT and Claude can explain your code. They can’t be its record."
        intro="Frontier models are better than Why-Code at reasoning and writing code — Why-Code even uses one to phrase answers. What a chat can’t be is a shared, checked, durable source of truth that sits in your merge path."
      >
        <div className="stagger grid gap-4 md:grid-cols-3">
          {[
            ["Durable & shared", "The same recorded decisions for everyone and every agent, tomorrow and next year — not one person’s chat history."],
            ["Checked outside the model", "Quotes verified by code against git. A model can’t certify its own citations; a separate checker can."],
            ["In the merge path", "A PR check that blocks changes to pinned decisions. A chat window can advise; it can’t stop a merge."],
          ].map(([title, body]) => (
            <Card key={title}>
              <h3 className="font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </Card>
          ))}
        </div>
        <Link href="/compare" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:underline">
          Read the full, honest comparison <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </Section>

      {/* Tech strip */}
      <Section
        eyebrow="Built on"
        title="Boring, inspectable technology."
        intro="Each one has an animated diagram of how it works inside Why-Code. Pick one to jump straight to it."
      >
        <div className="mb-6">
          <ArchitectureDiagram />
        </div>
        <div className="stagger flex flex-wrap gap-2">
          {TECH.map(([id, name]) => (
            <Link
              key={id}
              href={`/technology#${id}`}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 font-mono text-sm text-ink transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/50 hover:bg-raised"
            >
              {name}
              <ArrowRightIcon
                className="size-3.5 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
        <Link href="/technology" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:underline">
          What each piece does <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </Section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="rounded-2xl border border-line bg-ink p-8 text-canvas sm:p-12">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">
            Index a repository in seconds. No AI key needed for the ledger.
          </h2>
          <pre className="mt-6 overflow-x-auto rounded-xl bg-canvas p-4 font-mono text-[13px] text-ink">
            <code>{`cd backend
python -m app.ledger index ../your-repo
python -m app.ledger why src/payments/charge.py`}</code>
          </pre>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/docs" className="inline-flex h-11 items-center rounded-lg bg-canvas px-5 text-sm font-medium text-ink hover:opacity-90">
              Read the quick start
            </Link>
            <a href={SITE.repoUrl} className="inline-flex h-11 items-center rounded-lg border border-canvas/25 px-5 text-sm font-medium hover:bg-canvas/5">
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
