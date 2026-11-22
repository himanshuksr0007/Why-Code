"use client";

import { useStepper } from "@/lib/use-stepper";

import { Box, Diagram, Edge, Packet, Txt, phase, type Tone, type Vis } from "./kit";

/* ------------------------------------------------------------------ Git */

const GIT_STEPS = [
  "Git keeps history as a chain of commits. Each commit is a snapshot that points back at its parent.",
  "Why-Code records the decision at the commit where it was agreed — here a3f9 — together with the files it governs.",
  "On every index it asks git what changed between that commit and HEAD (git diff a3f9..HEAD, following renames).",
  "One of the two governed files changed. When half or more change, the decision is flagged needs_review.",
  "No model involved: freshness is plain arithmetic over git history, recomputed every time the ledger is indexed.",
];

const COMMITS = [
  [60, "1c0d"],
  [160, "a3f9"],
  [260, "7b21"],
  [360, "e004"],
  [460, "9d5a"],
] as const;

export function GitDiagram() {
  const stepper = useStepper(GIT_STEPS.length);
  const { step } = stepper;
  const commitClass = (i: number) => {
    if (i === 1 && step >= 1) return "fill-ink stroke-ink";
    if (i === 3 && step >= 3) return "fill-warn/25 stroke-warn";
    return "fill-canvas stroke-ink-faint";
  };
  const changed = step >= 3;

  return (
    <Diagram
      stepper={stepper}
      steps={GIT_STEPS}
      viewBox="0 0 560 250"
      title="git · decision currency"
      label="Diagram: a decision recorded at commit a3f9 governs two files; git diff to HEAD shows one changed, so the decision needs review."
    >
      <rect
        x={146}
        y={166}
        width={328}
        height={28}
        rx={14}
        className="dg-sweep fill-ink/5 stroke-ink/30"
        style={{ transform: `scaleX(${step >= 2 ? 1 : 0})` }}
      />
      {COMMITS.slice(0, -1).map(([x], i) => (
        <path key={x} d={`M${x + 12} 180 H${COMMITS[i + 1][0] - 12}`} className="stroke-line-strong" strokeWidth={1.5} />
      ))}
      {COMMITS.map(([x, sha], i) => (
        <g key={sha}>
          <circle cx={x} cy={180} r={11} strokeWidth={1.5} className={`dg ${commitClass(i)}`} />
          <Txt x={x} y={212} anchor="middle" tone={i === 1 && step >= 1 ? "ink" : "faint"}>
            {sha}
          </Txt>
        </g>
      ))}
      <Box x={436} y={130} w={48} h={20} rx={5} label="HEAD" />
      <path d="M460 150 V167" className="stroke-line-strong" strokeWidth={1.25} />

      <Box x={24} y={28} w={200} h={46} label="dec_1a2b · retries off" sub="agreed at a3f9" vis={phase(step, 1, 1, "dim")} />
      <Edge d="M124 74 C124 120 160 120 160 166" vis={phase(step, 1, 1, "dim")} dashed />
      <Box x={300} y={18} w={124} h={30} label="client.py" vis={phase(step, 1, [], "dim")} tone={changed ? "ok" : "ink"} />
      <Box x={300} y={60} w={124} h={30} label="transport.py" vis={phase(step, 1, 3, "dim")} tone={changed ? "warn" : "ink"} />
      <Edge d="M224 46 C262 46 262 33 298 33" vis={phase(step, 1, [], "dim")} label="governs" lx={262} ly={28} />
      <Edge d="M224 56 C262 56 262 75 298 75" vis={phase(step, 1, [], "dim")} />

      <Txt x={310} y={238} anchor="middle" vis={phase(step, 2)} tone="soft">
        git diff a3f9..HEAD
      </Txt>
      <Txt x={360} y={157} anchor="middle" vis={phase(step, 3)} tone="warn">
        touches transport.py
      </Txt>
      <Edge d="M424 75 C432 75 432 60 440 60" vis={phase(step, 3)} tone="warn" />
      <Box
        x={442}
        y={36}
        w={106}
        h={44}
        label="needs_review"
        sub="1 of 2 changed"
        tone="warn"
        vis={phase(step, 3, [3, 4])}
      />
      <Txt x={495} y={98} anchor="middle" vis={phase(step, 4)} tone="faint">
        git only · no AI
      </Txt>
    </Diagram>
  );
}

/* --------------------------------------------------------------- Miners */

const MINER_STEPS = [
  "Rules, not guesses: every source is read by plain pattern matchers. First, a code comment with a WHY: marker becomes a decision.",
  "A commit with no stated choice and reason is skipped — most commits are not decisions.",
  "A commit that states a choice plus a reason (“… because …”) becomes a decision, linked to that commit.",
  "Accepted ADR files are read in Nygard, MADR and frontmatter layouts; one that names its files is in force on its own.",
  "Same input, same output, every time — no model call, so mining is fast, free and reproducible.",
];

const MINER_ROWS: { kind: string; text: string; rule: string; out: string; outSub: string; tone: Tone }[] = [
  { kind: "comment · client.py:2", text: "# WHY: no retries — they duplicated orders", rule: "WHY: marker", out: "decision", outSub: "from comment", tone: "ok" },
  { kind: "commit 4be1", text: "fix typo in README", rule: "no choice+reason", out: "skipped", outSub: "not a decision", tone: "bad" },
  { kind: "commit 7b21", text: "use Redis because carts vanished on deploy", rule: "choice + because", out: "decision", outSub: "from commit", tone: "ok" },
  { kind: "docs/adr/0007-money-in-cents.md", text: "Status: Accepted · scope billing/", rule: "ADR · Accepted", out: "decision", outSub: "from ADR", tone: "ok" },
];

export function MinersDiagram() {
  const stepper = useStepper(MINER_STEPS.length);
  const { step } = stepper;

  return (
    <Diagram
      stepper={stepper}
      steps={MINER_STEPS}
      viewBox="0 0 560 254"
      title="deterministic miners"
      label="Diagram: four sources pass through rule-based miners; three become decisions, a typo-fix commit is skipped."
    >
      {MINER_ROWS.map((row, i) => {
        const y = 14 + i * 60;
        const current = step === i;
        const reached = step >= i;
        const input: Vis = current ? "hot" : reached ? "on" : "dim";
        const rest: Vis = reached ? (current ? "hot" : "on") : "hidden";
        return (
          <g key={row.kind}>
            <Box x={12} y={y} w={272} h={46} label={row.kind} sub={row.text} align="start" vis={input} />
            <Edge d={`M284 ${y + 23} H298`} vis={rest} arrow={false} />
            <Box x={298} y={y + 10} w={134} h={26} rx={13} label={row.rule} vis={rest === "hot" ? "on" : rest} />
            <Edge d={`M432 ${y + 23} H446`} vis={rest} tone={row.tone} />
            <Box x={448} y={y} w={100} h={46} label={row.out} sub={row.outSub} tone={row.tone} vis={rest} />
            {current ? <Packet path={`M284 ${y + 23} H446`} dur={1.2} tone={row.tone} /> : null}
          </g>
        );
      })}
    </Diagram>
  );
}

/* ---------------------------------------------------------- tree-sitter */

const TS_STEPS = [
  "To a regular expression, source code is just lines of text.",
  "tree-sitter parses it into a concrete syntax tree: every construct becomes a typed node with exact line and byte ranges.",
  "Walking the tree finds the regions that matter — the class Client and its method send (lines 4–6).",
  "So the WHY: comment is attached to the symbol Client.send, not just “line 5” — and it still resolves when lines shift.",
  "Today Python is parsed structurally; other languages fall back to path-based detection, and config keys come from YAML, TOML and .env files.",
];

const CODE = ["class Client:", "    retries = 0", "", "    def send(self, req):", "        # WHY: no retry on POST", "        return self._send(req)"];

export function TreeSitterDiagram() {
  const stepper = useStepper(TS_STEPS.length);
  const { step } = stepper;
  const tree = phase(step, 1, 1, "dim");

  return (
    <Diagram
      stepper={stepper}
      steps={TS_STEPS}
      viewBox="0 0 560 252"
      title="tree-sitter · client.py"
      label="Diagram: a Python file parsed by tree-sitter into a syntax tree; the WHY comment is attached to the method Client.send."
    >
      <rect x={12} y={12} width={262} height={190} rx={10} className="fill-surface stroke-line" />
      <rect
        x={18}
        y={98}
        width={250}
        height={76}
        rx={6}
        className={`dg ${step >= 2 ? "fill-ink/10 stroke-ink/40" : "fill-transparent stroke-transparent"}`}
      />
      <rect
        x={22}
        y={127}
        width={242}
        height={20}
        rx={4}
        className={`dg ${step >= 3 ? "fill-ok/15 stroke-ok/50" : "fill-transparent stroke-transparent"}`}
      />
      {CODE.map((line, i) => (
        <g key={i}>
          <Txt x={26} y={44 + i * 24} tone="faint" size={10}>
            {i + 1}
          </Txt>
          <text x={44} y={44 + i * 24} className="fill-ink font-mono whitespace-pre" style={{ fontSize: 11, whiteSpace: "pre" }}>
            {line}
          </text>
        </g>
      ))}

      <Box x={384} y={12} w={104} h={28} rx={14} label="module" vis={tree} />
      <Edge d="M436 40 V62" vis={tree} />
      <Box x={366} y={64} w={140} h={38} label="class_definition" sub="Client" vis={phase(step, 1, 2, "dim")} />
      <Edge d="M436 102 C436 116 356 112 356 126" vis={tree} />
      <Edge d="M436 102 C436 116 496 112 496 126" vis={phase(step, 1, [2, 3], "dim")} />
      <Box x={296} y={128} w={120} h={38} label="assignment" sub="retries" vis={tree === "hot" ? "on" : tree} />
      <Box x={436} y={128} w={120} h={38} label="function_def" sub="send · L4–6" vis={phase(step, 1, [2, 3], "dim")} />
      <Edge d="M496 166 V186" vis={phase(step, 1, 3, "dim")} />
      <Box x={436} y={188} w={120} h={38} label="comment" sub="WHY: no retry…" tone={step >= 3 ? "ok" : "ink"} vis={phase(step, 1, 3, "dim")} />

      <Box x={12} y={212} w={262} h={30} label="evidence → Client.send · L4–6" tone="ok" vis={phase(step, 3, 3)} />
      <Txt x={296} y={244} vis={phase(step, 4)} tone="faint">
        python: structural ✓ · others: path-based
      </Txt>
    </Diagram>
  );
}

/* ---------------------------------------------------------------- Neo4j */

const GRAPH_STEPS = [
  "A graph database stores things as nodes and the relationships between them as typed, directed links.",
  "A question about httpx/_config.py starts at its File node: the seed.",
  "Hop 1 — follow links: the Decision that GOVERNS it, the PullRequest that changed it, the code region inside it.",
  "Hop 2 — from the pull request: its commits and the people who AUTHORED or reviewed it.",
  "That neighbourhood becomes the graph candidates for retrieval — connected context that a keyword search would miss.",
];

export function GraphDiagram() {
  const stepper = useStepper(GRAPH_STEPS.length);
  const { step } = stepper;
  const hop1: Vis = step === 2 ? "hot" : step >= 2 ? "on" : "dim";
  const hop2: Vis = step === 3 ? "hot" : step >= 3 ? "on" : "dim";
  const seed: Vis = step === 1 ? "hot" : step >= 1 ? "on" : "dim";

  return (
    <Diagram
      stepper={stepper}
      steps={GRAPH_STEPS}
      viewBox="0 0 560 256"
      title="neo4j · evidence graph"
      label="Diagram: graph expansion from a File node to the Decision that governs it, the PullRequest that changed it, its commits and authors."
    >
      <Edge d="M215 44 C180 50 170 80 162 108" vis={hop1} label="GOVERNS" lx={150} ly={64} anchor="end" />
      <Edge d="M280 62 V196" vis={hop1} label="PRODUCED_IN" lx={288} ly={132} anchor="start" />
      <Edge d="M215 214 C180 210 170 170 162 152" vis={hop1} label="CHANGED_FILE" lx={178} ly={160} anchor="start" />
      <Edge d="M95 152 V196" vis={hop1} label="HAS_REGION" lx={88} ly={178} anchor="end" />
      <Edge d="M347 222 H398" vis={hop2} label="HAS_COMMIT" lx={373} ly={238} />
      <Edge d="M440 152 C420 180 380 196 347 206" vis={hop2} label="AUTHORED" lx={444} ly={184} anchor="start" />

      <Box x={215} y={20} w={130} h={42} rx={21} label="Decision" sub="retries off" vis={hop1} />
      <Box x={30} y={110} w={132} h={42} rx={21} label="File" sub="httpx/_config.py" vis={seed} />
      <Box x={30} y={198} w={132} h={42} rx={21} label="CodeRegion" sub="Client.send" vis={hop1} />
      <Box x={215} y={198} w={132} h={42} rx={21} label="PullRequest" sub="#1525" vis={hop1} />
      <Box x={400} y={198} w={132} h={42} rx={21} label="Commit" sub="5f3a1c9" vis={hop2} />
      <Box x={400} y={110} w={132} h={42} rx={21} label="Person" sub="reviewer · author" vis={hop2} />

      <Packet path="M215 44 C180 50 170 80 162 108" dur={1.6} show={step === 4} />
      <Packet path="M215 214 C180 210 170 170 162 152" dur={1.6} delay={0.4} show={step === 4} />
      <Packet path="M347 222 H215" dur={1.6} delay={0.8} show={step === 4} />
    </Diagram>
  );
}

/* --------------------------------------------------------------- Ledger */

const LEDGER_STEPS = [
  "The ledger is one SQLite file: decisions, their evidence, and an authority log of who put each one in force.",
  "The indexer records what it mined — a proposal, not yet in force.",
  "A person accepts it, giving a reason and the files it governs. Coding agents can propose but never self-approve.",
  "Pinning raises the bar: a pull request that changes these files now needs an explicit acknowledgement.",
  "Rewriting history fails: a database trigger aborts any UPDATE or DELETE on the log — not even the app itself can do it.",
];

const LOG_ROWS = [
  ["1", "record", "whycode-indexer", "mined from code comment"],
  ["2", "accept", "alice", "still how we do it"],
  ["3", "pin", "alice", "duplicate orders are an incident"],
] as const;

export function LedgerDiagram() {
  const stepper = useStepper(LEDGER_STEPS.length);
  const { step } = stepper;
  const cols = [30, 70, 150, 300];

  return (
    <Diagram
      stepper={stepper}
      steps={LEDGER_STEPS}
      viewBox="0 0 560 250"
      title="decision ledger · authority_log"
      label="Diagram: an append-only authority log gains record, accept and pin rows; an UPDATE attempt is aborted by a trigger."
    >
      <rect x={12} y={12} width={536} height={30} rx={8} className="fill-surface stroke-line" />
      {["seq", "action", "actor", "reason"].map((h, i) => (
        <Txt key={h} x={cols[i]} y={31} tone="faint" size={9.5}>
          {h.toUpperCase()}
        </Txt>
      ))}
      {LOG_ROWS.map((row, i) => {
        const y = 48 + i * 36;
        const vis = phase(step, i + 1, i + 1);
        const attacked = step === 4 && i === 1;
        return (
          <g key={row[0]} className={`dg ${vis === "hidden" ? "opacity-20" : "opacity-100"}`}>
            <rect
              x={12}
              y={y}
              width={536}
              height={30}
              rx={6}
              className={`dg ${attacked ? "fill-bad/10 stroke-bad" : vis === "hot" ? "fill-ink/10 stroke-ink/50" : "fill-transparent stroke-line"}`}
            />
            {row.map((cell, c) => (
              <Txt key={c} x={cols[c]} y={y + 19} tone={c === 1 ? "ink" : c === 3 ? "soft" : "faint"} size={10.5}>
                {c === 3 ? `“${cell}”` : cell}
              </Txt>
            ))}
          </g>
        );
      })}
      <Box
        x={12}
        y={168}
        w={536}
        h={30}
        label="UPDATE authority_log SET actor='mallory' WHERE seq=2"
        tone="bad"
        vis={phase(step, 4, 4)}
      />
      <Edge d="M280 168 V130" tone="bad" vis={phase(step, 4)} />
      <Txt x={280} y={222} anchor="middle" tone="bad" size={11} vis={phase(step, 4)}>
        ABORT: authority_log is append-only
      </Txt>
      <Txt x={280} y={240} anchor="middle" tone="faint" vis={phase(step, 4)}>
        trigger authority_log_no_update · BEFORE UPDATE
      </Txt>
      <Txt x={548} y={196} anchor="end" tone="faint" vis={step >= 1 && step < 4 ? "on" : "hidden"}>
        rows only ever append ↓
      </Txt>
    </Diagram>
  );
}
