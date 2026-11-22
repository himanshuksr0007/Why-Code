"use client";

import { useStepper } from "@/lib/use-stepper";

import { Diagram, Packet, Txt } from "./kit";

type Chip = { text: string; model?: boolean };

const LAYERS: { name: string; caption: string; chips: Chip[] }[] = [
  {
    name: "Sources",
    caption: "01 · Sources — it starts from what your team already wrote: git history, pull requests and reviews, ADR files and WHY: comments.",
    chips: [{ text: "git history" }, { text: "PRs & reviews" }, { text: "ADRs" }, { text: "WHY: comments" }],
  },
  {
    name: "Understand",
    caption:
      "02 · Understand — rules mine decisions, tree-sitter maps code structure, and DistilBERT reads what kind of question was asked. An LLM can optionally help extract (dashed: it proposes, never decides).",
    chips: [{ text: "rule miners" }, { text: "tree-sitter" }, { text: "DistilBERT intent" }, { text: "LLM extract", model: true }],
  },
  {
    name: "Store",
    caption: "03 · Store — decisions live in a SQLite ledger with an append-only authority log; fully ingested repositories also get a Neo4j evidence graph.",
    chips: [{ text: "ledger (SQLite)" }, { text: "evidence graph (Neo4j)" }],
  },
  {
    name: "Check",
    caption: "04 · Check — quotes are verified against git, freshness is computed from diffs, and every citation in an answer is validated. All plain, tested code.",
    chips: [{ text: "quote verify" }, { text: "git currency" }, { text: "citation validator" }],
  },
  {
    name: "Serve",
    caption: "05 · Serve — one record, three ways out: the app, MCP for coding agents, and a PR check. The LLM only phrases answers.",
    chips: [{ text: "FastAPI + Next.js" }, { text: "MCP" }, { text: "GitHub Action" }, { text: "LLM phrasing", model: true }],
  },
];

const CHAR = 6.1;
const CHIP_X = 126;

function layout(chips: Chip[]) {
  let x = CHIP_X;
  return chips.map((chip) => {
    const w = Math.round(chip.text.length * CHAR + 18);
    const out = { ...chip, x, w };
    x += w + 8;
    return out;
  });
}

export function ArchitectureDiagram() {
  const stepper = useStepper(LAYERS.length, 3000);
  const { step } = stepper;
  const bandY = (i: number) => 10 + i * 58;

  return (
    <Diagram
      stepper={stepper}
      steps={LAYERS.map((l) => l.caption)}
      viewBox="0 0 560 330"
      title="architecture · five layers"
      label="Architecture diagram: sources flow through understand, store, check and serve layers. Only two dashed components use an LLM, and only to propose."
    >
      <path d={`M108 ${bandY(0) + 8} V${bandY(4) + 40}`} className="stroke-line" strokeWidth={1.25} />
      <Packet path={`M108 ${bandY(0) + 8} V${bandY(4) + 40}`} dur={3.6} />
      <Packet path={`M108 ${bandY(0) + 8} V${bandY(4) + 40}`} dur={3.6} delay={1.2} />
      <Packet path={`M108 ${bandY(0) + 8} V${bandY(4) + 40}`} dur={3.6} delay={2.4} />

      {LAYERS.map((layer, i) => {
        const y = bandY(i);
        const on = step === i;
        return (
          <g key={layer.name} className={`dg ${on ? "opacity-100" : "opacity-55"}`}>
            <rect
              x={4}
              y={y}
              width={552}
              height={48}
              rx={10}
              strokeWidth={on ? 1.5 : 1}
              className={`dg ${on ? "fill-ink/5 stroke-ink" : "fill-transparent stroke-line"}`}
            />
            <Txt x={16} y={y + 20} tone="faint" size={9}>
              {`0${i + 1}`}
            </Txt>
            <Txt x={16} y={y + 35} tone="ink" size={12} mono={false}>
              {layer.name}
            </Txt>
            <circle cx={108} cy={y + 24} r={4} className={`dg ${on ? "fill-ink" : "fill-line-strong"}`} />
            {layout(layer.chips).map((chip) => (
              <g key={chip.text}>
                <rect
                  x={chip.x}
                  y={y + 11}
                  width={chip.w}
                  height={26}
                  rx={6}
                  strokeWidth={1}
                  strokeDasharray={chip.model ? "4 3" : undefined}
                  className={`dg ${on && !chip.model ? "fill-raised stroke-ink-faint" : "fill-surface stroke-line-strong"}`}
                />
                <Txt x={chip.x + chip.w / 2} y={y + 28} anchor="middle" tone={on ? "ink" : "soft"} size={10}>
                  {chip.text}
                </Txt>
              </g>
            ))}
          </g>
        );
      })}

      <rect x={126} y={311} width={20} height={10} rx={2} className="fill-surface stroke-line-strong" />
      <Txt x={152} y={320} tone="faint" size={9.5}>
        deterministic code
      </Txt>
      <rect x={270} y={311} width={20} height={10} rx={2} strokeDasharray="4 3" className="fill-surface stroke-line-strong" />
      <Txt x={296} y={320} tone="faint" size={9.5}>
        model — proposes, never decides
      </Txt>
    </Diagram>
  );
}
