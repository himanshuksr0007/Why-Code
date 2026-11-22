import { GitDiagram, LedgerDiagram, MinersDiagram } from "@/components/diagrams/record-diagrams";
import { RetrievalDiagram, ValidatorDiagram } from "@/components/diagrams/answer-diagrams";
import { PipelineAnimation } from "@/components/pipeline-animation";
import { Card, PageHero, Pill, Section } from "@/components/ui";

export const metadata = { title: "How it works" };

const SOURCES = [
  ["ADR files", "Architecture decision records in docs/adr/ and similar folders. An accepted ADR that names its files is in force on its own."],
  ["WHY: comments", "WHY:, DECISION:, TRADEOFF:, RATIONALE:, REJECTED: in any comment style — uppercase only, like TODO:."],
  ["Commit messages", "Only commits that state a choice and a reason (“switch to Redis because carts vanished on deploy”)."],
  ["Pull-request blocks", "A short decisions block in a PR description. It comes into force when the PR merges."],
  ["People and agents", "Recorded by hand, or by a coding agent over MCP — an agent can propose, never self-approve."],
];

const STATES: [string, "ok" | "warn" | "bad" | "neutral", string][] = [
  ["active", "ok", "In force and still describes the code."],
  ["needs_review", "warn", "In force, but half or more of its files changed since it was agreed."],
  ["stale", "bad", "Every file it governs is gone."],
  ["background", "neutral", "Mined from history, not yet confirmed by a person. Shown only when asked, always labelled."],
  ["superseded", "neutral", "Replaced by a later decision, or its commit was reverted. Kept for history."],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="Find it. Check it. Record it. Use it."
        intro="Four steps, and the first three need no AI at all. That is deliberate: the parts that decide what is true are plain, testable code."
      />

      <Section eyebrow="The model" title="Watch one decision travel through the system.">
        <PipelineAnimation />
      </Section>

      <Section
        eyebrow="Step 1 · Find"
        title="Decisions come from what your team already wrote."
        intro="Five sources, all read with rules rather than guesses. Each decision keeps a pointer to the exact place it came from."
      >
        <div className="mb-6">
          <MinersDiagram />
        </div>
        <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCES.map(([name, body]) => (
            <Card key={name}>
              <h3 className="font-mono text-sm text-ink">{name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Step 2 · Check"
        title="Every quote is verified. Every decision gets a freshness state."
        intro="Verification asks “is this quote really there?”. Currency asks “does this decision still describe the code?”. Both are computed from the repository and git history."
      >
        <div className="mb-6">
          <GitDiagram />
        </div>
        <div className="stagger grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="font-medium">Verification</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-3"><Pill tone="ok">verified</Pill><span className="text-ink-soft">Quote found exactly at the cited lines or commit.</span></li>
              <li className="flex gap-3"><Pill tone="warn">fuzzy</Pill><span className="text-ink-soft">Found after normalising spacing, or elsewhere in the file (lines updated).</span></li>
              <li className="flex gap-3"><Pill>unverified</Pill><span className="text-ink-soft">Couldn’t be checked — e.g. the file is gone.</span></li>
            </ul>
          </Card>
          <Card>
            <h3 className="font-medium">Currency</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {STATES.map(([name, tone, body]) => (
                <li key={name} className="flex gap-3">
                  <Pill tone={tone}>{name}</Pill>
                  <span className="text-ink-soft">{body}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      <Section
        eyebrow="Step 3 · Record"
        title="Authority is a log entry, not a checkbox."
        intro="Putting a decision in force, pinning it or withdrawing it each append a signed row: who, why, which files, which evidence. Database triggers reject any edit or deletion of that log."
      >
        <div className="mb-6">
          <LedgerDiagram />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <pre className="overflow-x-auto rounded-xl border border-line bg-surface p-5 font-mono text-[13px] leading-relaxed">
            <code>
              <span className="text-ink-faint">$ </span>python -m app.ledger accept dec_1a2b --reason &quot;still true&quot;{"\n"}
              <span className="text-bad">refused: no scope: name the files or modules it governs</span>{"\n\n"}
              <span className="text-ink-faint">$ </span>python -m app.ledger accept dec_1a2b --reason &quot;still true&quot; \{"\n"}
              {"    "}--scope shop/payments/{"\n"}
              <span className="text-ok">dec_1a2b… accepted</span>
            </code>
          </pre>
          <Card>
            <h3 className="font-medium">Rules it enforces</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
              <li>Accepting needs a reason, the files it governs, and evidence.</li>
              <li>A pinned decision can’t be retired without force — and only a person may force it.</li>
              <li>A dismissed decision stays dismissed: re-indexing never revives it.</li>
              <li>Coding agents may propose; they can’t put their own decisions in force.</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section
        eyebrow="Step 4 · Use"
        title="One record, three ways out."
        intro="When you ask a question, retrieval gathers the evidence and a validator decides what the model's draft is allowed to say."
      >
        <div className="mb-6 grid gap-4 xl:grid-cols-2">
          <RetrievalDiagram />
          <ValidatorDiagram />
        </div>
        <div className="stagger grid gap-4 lg:grid-cols-3">
          <Card>
            <h3 className="font-medium">Ask in the app</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              The model may cite only evidence Why-Code fetched — repository files, matching PRs and issues, and ledger
              evidence. Unresolvable citations are dropped; an answer with none is refused. Confidence is computed, not
              taken from the model.
            </p>
          </Card>
          <Card>
            <h3 className="font-medium">Brief coding agents</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              An MCP server with <code className="font-mono text-ink">get_why</code>,{" "}
              <code className="font-mono text-ink">search_decisions</code>,{" "}
              <code className="font-mono text-ink">check_change</code> and{" "}
              <code className="font-mono text-ink">record_decision</code>. Agents learn the rules before they edit.
            </p>
          </Card>
          <Card>
            <h3 className="font-medium">Guard pull requests</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              A GitHub Action comments with the decisions a PR touches and fails when a pinned decision changes without a{" "}
              <code className="font-mono text-ink">Decision-Ack:</code> line explaining why.
            </p>
          </Card>
        </div>
      </Section>
    </>
  );
}
