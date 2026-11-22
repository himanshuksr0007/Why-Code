import { ArchitectureDiagram } from "@/components/diagrams/architecture-diagram";
import { TechExplorer } from "@/components/tech-explorer";
import { Card, PageHero, Pill, Section } from "@/components/ui";
import { TECH } from "@/lib/tech";

export const metadata = {
  title: "Technology",
  description:
    "Animated diagrams of every component in Why-Code — git, tree-sitter, Neo4j, the decision ledger, hybrid retrieval, DistilBERT, the citation validator, MCP and the GitHub Action — what each does and how Why-Code uses it.",
};

const PRINCIPLES = [
  [
    "Models propose, code decides",
    "The LLM drafts text and optional extractions. Whether a quote is real, whether a decision is current, and whether an answer may be shown are decided by ordinary, tested code.",
  ],
  [
    "Git is the source of truth",
    "Every quote is checked against the repository, and every decision's freshness is computed from diffs — never from a model's opinion.",
  ],
  [
    "History only grows",
    "The authority log is append-only at the database level. You can supersede a decision; you can't quietly rewrite who agreed to it.",
  ],
];

export default function TechnologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Technology"
        title="How each piece works — and what we use it for."
        intro="Every component below has an animated diagram. Hover to pause, click the dots to step through, and read what the technology does in general next to what Why-Code does with it."
      />

      <Section
        eyebrow="Architecture"
        title="Five layers. Truth is decided in the boring ones."
        intro="Data moves down through the layers. Dashed parts use a language model — and only to propose. Everything that decides whether a claim is true is plain code with tests."
      >
        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
          <ArchitectureDiagram />
          <div className="stagger grid gap-3">
            {PRINCIPLES.map(([title, body]) => (
              <Card key={title} className="p-5">
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      <Section
        id="explorer"
        eyebrow="Component by component"
        title="Pick a technology. Watch it work."
        intro="Ten components, each with a diagram of the real flow inside Why-Code. Use the list, or the arrow keys once it has focus."
      >
        <TechExplorer />
      </Section>

      <Section eyebrow="At a glance" title="Honest status of every component.">
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Each component and its current status</caption>
            <thead className="bg-surface text-xs tracking-wider text-ink-faint uppercase">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Component</th>
                <th scope="col" className="hidden px-5 py-3 font-medium sm:table-cell">In one line</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {TECH.map((t) => (
                <tr key={t.id} className="border-t border-line align-top transition-colors hover:bg-surface">
                  <th scope="row" className="px-5 py-3.5 font-mono text-[13px] font-normal text-ink">
                    <a href={`#${t.id}`} className="hover:underline">
                      {t.name}
                    </a>
                  </th>
                  <td className="hidden px-5 py-3.5 text-ink-soft sm:table-cell">{t.simple}</td>
                  <td className="px-5 py-3.5">
                    <Pill tone={t.status.tone}>{t.status.text}</Pill>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line align-top">
                <th scope="row" className="px-5 py-3.5 font-mono text-[13px] font-normal text-ink">
                  FastAPI + Next.js
                </th>
                <td className="hidden px-5 py-3.5 text-ink-soft sm:table-cell">
                  The web server (/ask, evidence, ledger API, webhooks) and the web app (chat, Decisions page, sharing).
                </td>
                <td className="px-5 py-3.5">
                  <Pill tone="ok">Shipped</Pill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
