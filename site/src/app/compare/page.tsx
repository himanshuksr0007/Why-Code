import { CheckIcon, MinusIcon, XIcon } from "lucide-react";

import { Card, PageHero, Section } from "@/components/ui";

export const metadata = { title: "Why-Code vs. ChatGPT & Claude" };

type Mark = "yes" | "partial" | "no";

const ROWS: { need: string; chat: Mark; chatNote: string; why: Mark; whyNote: string }[] = [
  {
    need: "Explain what a piece of code does",
    chat: "yes",
    chatNote: "Excellent, often better than Why-Code.",
    why: "partial",
    whyNote: "Not its focus; it explains why, from recorded evidence.",
  },
  {
    need: "Read PRs, commits and issues and summarise the reason",
    chat: "yes",
    chatNote: "With repo access (connectors, Claude Code) it can do this well.",
    why: "yes",
    whyNote: "Same job — but saves the result as a decision instead of a chat reply.",
  },
  {
    need: "Write or refactor code",
    chat: "yes",
    chatNote: "Their core strength.",
    why: "no",
    whyNote: "Doesn’t write code. It briefs the agents that do.",
  },
  {
    need: "Keep a durable, shared record of decisions for the whole team",
    chat: "no",
    chatNote: "Chats and memory are per person and live with the vendor.",
    why: "yes",
    whyNote: "One ledger in your infrastructure; every person and agent reads the same records.",
  },
  {
    need: "Prove a quoted reason really exists in the repo",
    chat: "partial",
    chatNote: "Can be asked to check, but a model cannot certify its own output.",
    why: "yes",
    whyNote: "Code verifies every quote against files and commits: verified / fuzzy / unverified.",
  },
  {
    need: "Notice when a decision no longer matches the code",
    chat: "no",
    chatNote: "Has no memory of what was agreed last month to compare against.",
    why: "yes",
    whyNote: "Diffs the governed files since agreement: active → needs review → stale.",
  },
  {
    need: "Show who approved a decision, unchangeably",
    chat: "no",
    chatNote: "No authority model.",
    why: "yes",
    whyNote: "Append-only authority log; the database rejects edits and deletions.",
  },
  {
    need: "Block a merge that breaks an agreed rule",
    chat: "no",
    chatNote: "Can advise in a chat; can’t sit in CI and fail a check.",
    why: "yes",
    whyNote: "GitHub Action fails when a pinned decision changes without a Decision-Ack.",
  },
  {
    need: "Refuse instead of guessing",
    chat: "partial",
    chatNote: "Sometimes, probabilistically — depends on the prompt and the day.",
    why: "yes",
    whyNote: "Enforced by code: no resolvable citation, no answer.",
  },
  {
    need: "Give the same answer to everyone, every time",
    chat: "partial",
    chatNote: "Answers vary by phrasing, model version and context.",
    why: "partial",
    whyNote: "Records and checks are deterministic; the wording of answers still comes from a model.",
  },
  {
    need: "Work across huge, many-language codebases today",
    chat: "partial",
    chatNote: "Limited by context windows and connectors.",
    why: "partial",
    whyNote: "Ledger works on any language; structural parsing is Python-only; GitHub only.",
  },
];

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === "yes")
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-ink text-canvas">
        <CheckIcon className="size-3.5" aria-label="Yes" />
      </span>
    );
  if (mark === "partial")
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full border border-line-strong text-ink-soft">
        <MinusIcon className="size-3.5" aria-label="Partly" />
      </span>
    );
  return (
    <span className="inline-flex size-6 items-center justify-center rounded-full border border-line text-ink-faint">
      <XIcon className="size-3.5" aria-label="No" />
    </span>
  );
}

export default function ComparePage() {
  return (
    <>
      <PageHero
        eyebrow="Honest comparison"
        title="What Why-Code can do that a chat can’t — and what it can’t."
        intro="ChatGPT and Claude are better general reasoners than anything we’ve built, and Why-Code uses a language model too. The difference isn’t intelligence. It’s that Why-Code is a system of record, and a chat window isn’t one."
      />

      <Section eyebrow="Side by side" title="Feature by feature.">
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Comparison of ChatGPT/Claude and Why-Code</caption>
            <thead className="bg-surface text-xs tracking-wider text-ink-faint uppercase">
              <tr>
                <th scope="col" className="w-[30%] px-5 py-3 font-medium">Need</th>
                <th scope="col" className="px-5 py-3 font-medium">ChatGPT / Claude</th>
                <th scope="col" className="px-5 py-3 font-medium">Why-Code</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.need} className="border-t border-line align-top">
                  <th scope="row" className="px-5 py-4 font-medium text-ink">{r.need}</th>
                  <td className="px-5 py-4">
                    <div className="flex gap-3">
                      <MarkIcon mark={r.chat} />
                      <span className="leading-relaxed text-ink-soft">{r.chatNote}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3">
                      <MarkIcon mark={r.why} />
                      <span className="leading-relaxed text-ink-soft">{r.whyNote}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        eyebrow="The test"
        title="Remove the AI. Would anyone still use it?"
        intro="That’s the question that separates a tool from a wrapper. For Why-Code’s ledger the answer is yes: decisions, evidence, verification, currency, the authority log, the PR check and the MCP server all run with no model and no API key. The model makes answers readable. It doesn’t decide what is true."
      />

      <Section eyebrow="Limits" title="Where Why-Code falls short today.">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Thin live answers", "The hosted app reads up to four ranked files and matching issues for unindexed repos. It refuses rather than guesses, but deep answers need an indexed repository."],
            ["Heuristic commit mining", "Roughly two in three commit-mined decisions on httpx were real design decisions. They start as ‘background’ and are labelled until someone accepts them."],
            ["No public benchmark yet", "We publish throughput and verification figures, not precision/recall. A labelled benchmark is the next thing to build."],
            ["Narrow coverage", "Structural parsing is Python-only and ingestion is GitHub-only. The ledger itself works on any language."],
          ].map(([title, body]) => (
            <Card key={title}>
              <h3 className="font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Use them together"
        title="The best setup is both."
        intro="Let Claude Code or Cursor write the code. Plug Why-Code in over MCP so the agent asks get_why before it edits, records the decisions it makes, and gets stopped at the PR if it breaks a pinned one."
      />
    </>
  );
}
