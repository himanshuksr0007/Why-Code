"use client";

import { useStepper } from "@/lib/use-stepper";

import { Box, Diagram, Edge, Packet, Txt, phase, type Vis } from "./kit";

/* ------------------------------------------------------------ Retrieval */

const RETRIEVAL_STEPS = [
  "A question fans out to four retrievers at once.",
  "Each ranks candidates its own way: exact identifiers, full-text keywords (BM25), vector meaning, and graph neighbours.",
  "Their scores aren't comparable, so only ranks are fused: each list adds weight ÷ (60 + rank). Agreement across lists wins.",
  "A deterministic reranker orders the fused list — active decisions ahead of superseded ones — with reasons you can inspect.",
  "The top results become the evidence pack: [E1]…[En] are the only things the answer is allowed to cite.",
];

const LANES = [
  ["exact · w 5", "#1 dec_1a2b"],
  ["full-text · w 2", "#1 dec_77c0"],
  ["vector · w 1.5", "#1 dec_1a2b"],
  ["graph · w 2.5", "#2 dec_1a2b"],
] as const;

export function RetrievalDiagram() {
  const stepper = useStepper(RETRIEVAL_STEPS.length);
  const { step } = stepper;
  const laneY = (i: number) => 12 + i * 60;

  return (
    <Diagram
      stepper={stepper}
      steps={RETRIEVAL_STEPS}
      viewBox="0 0 560 256"
      title="hybrid retrieval · WRRF"
      label="Diagram: a question goes to exact, full-text, vector and graph retrievers; ranks are fused with weighted reciprocal rank fusion, reranked and packed as evidence."
    >
      <Box x={8} y={104} w={118} h={46} label="question" sub="why retries off?" vis={phase(step, 0, 0)} />
      {LANES.map(([name, top], i) => {
        const y = laneY(i);
        const d = `M126 127 C146 127 146 ${y + 21} 164 ${y + 21}`;
        const out = `M300 ${y + 21} C318 ${y + 21} 318 92 334 92`;
        return (
          <g key={name}>
            <Edge d={d} vis={phase(step, 0, 0)} />
            <Box x={166} y={y} w={134} h={42} label={name} sub={top} vis={phase(step, 1, 1, "dim")} />
            <Edge d={out} vis={phase(step, 2, 2, "hidden")} />
            <Packet path={d} dur={1.1} delay={i * 0.15} show={step === 0} />
            <Packet path={out} dur={1.1} delay={i * 0.2} show={step === 2} />
          </g>
        );
      })}
      <Box x={336} y={68} w={110} h={48} label="WRRF fuse" sub="Σ w ÷ (60 + rank)" vis={phase(step, 2, 2, "dim")} />
      <Edge d="M391 116 V146" vis={phase(step, 3, 3, "hidden")} />
      <Box x={336} y={148} w={110} h={42} label="rerank" sub="active first" vis={phase(step, 3, 3, "dim")} />
      <Edge d="M446 169 C458 169 458 150 468 150" vis={phase(step, 4, 4, "hidden")} />
      <Packet path="M446 169 C458 169 458 150 468 150" dur={0.9} show={step === 4} />

      <g className={`dg ${step >= 4 ? "opacity-100" : "opacity-25"}`}>
        <rect
          x={470}
          y={56}
          width={82}
          height={150}
          rx={8}
          strokeWidth={1.25}
          className={`dg ${step === 4 ? "fill-ink/10 stroke-ink" : "fill-surface stroke-line-strong"}`}
        />
        <Txt x={511} y={78} anchor="middle" tone="ink" size={11}>
          pack
        </Txt>
        {["[E1] file", "[E2] PR", "[E3] review", "[D1] ledger"].map((line, i) => (
          <Txt key={line} x={480} y={104 + i * 24} size={9.5} tone={step === 4 ? "ink" : "faint"}>
            {line}
          </Txt>
        ))}
      </g>
    </Diagram>
  );
}

/* -------------------------------------------------------- DistilBERT */

const INTENT_STEPS = [
  "Every question is first checked by keyword rules — “who…”, “where is…”, “X instead of Y” — which are instant and usually right.",
  "This one has no trigger words, so the rules can't settle it and hand it to DistilBERT.",
  "DistilBERT, a compact BERT model, turns the question into a 768-number embedding that captures its meaning.",
  "That embedding is compared with labelled example questions; the three nearest vote. Here, “how it works” wins.",
  "prompt.py picks the matching answer layout — In short → How it works → Why — while the evidence rules stay fixed on top.",
];

const DOTS: [number, number, string][] = [
  [330, 148, "why"],
  [344, 164, "why"],
  [326, 172, "why"],
  [404, 132, "who"],
  [418, 146, "who"],
  [352, 214, "where"],
  [368, 204, "where"],
  [392, 178, "how"],
  [408, 170, "how"],
  [400, 196, "how"],
];
const QUERY: [number, number] = [384, 188];

export function IntentDiagram() {
  const stepper = useStepper(INTENT_STEPS.length);
  const { step } = stepper;
  const model: Vis = step === 2 ? "hot" : step >= 2 ? "on" : step === 1 ? "on" : "dim";

  return (
    <Diagram
      stepper={stepper}
      steps={INTENT_STEPS}
      viewBox="0 0 560 250"
      title="DistilBERT · question intent"
      label="Diagram: a question without trigger words is embedded by DistilBERT and classified by its nearest labelled examples; prompt.py then chooses an answer layout."
    >
      <Box x={8} y={100} w={132} h={46} label="question" sub="no trigger words" vis={phase(step, 0, [0, 1])} />
      <Edge d="M140 116 C158 116 158 60 174 60" vis={phase(step, 0, 0)} />
      <Box x={176} y={38} w={124} h={44} label="keyword rules" sub="who · where · vs" vis={phase(step, 0, 0)} />
      <Edge d="M300 60 C380 60 380 60 438 84" vis={step === 0 ? "on" : "dim"} dashed label="clear signal" lx={372} ly={52} />
      <Edge d="M238 82 V146" vis={phase(step, 1, 1, "hidden")} tone={step === 1 ? "warn" : "ink"} label="unclear" lx={246} ly={118} anchor="start" />
      <Box x={176} y={148} w={124} h={46} label="DistilBERT" sub="embed → 768 dims" vis={model} />
      <Edge d="M300 171 H316" vis={phase(step, 2, 2, "hidden")} />
      <Packet path="M238 82 V146" dur={1} tone="warn" show={step === 1} />

      <rect
        x={318}
        y={120}
        width={112}
        height={110}
        rx={12}
        strokeDasharray="3 4"
        className={`dg ${step >= 2 ? "stroke-line-strong" : "stroke-line"} fill-transparent`}
      />
      <Txt x={374} y={244} anchor="middle" tone="faint" size={9}>
        labelled examples
      </Txt>
      {DOTS.map(([x, y, kind], i) => {
        const near = step >= 3 && kind === "how";
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={near ? 5 : 3.5}
            className={`dg ${near ? "fill-ink" : "fill-ink-faint"}`}
            opacity={step >= 2 ? 1 : 0.35}
          />
        );
      })}
      {[
        [326, 140, "why"],
        [416, 128, "who"],
        [334, 226, "where"],
        [414, 200, "how"],
      ].map(([x, y, t]) => (
        <Txt key={t as string} x={x as number} y={y as number} tone="faint" size={8.5} vis={step >= 2 ? "on" : "dim"}>
          {t}
        </Txt>
      ))}
      <g className={`dg ${step >= 3 ? "opacity-100" : "opacity-0"}`}>
        {DOTS.filter(([, , k]) => k === "how").map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${QUERY[0]} ${QUERY[1]} L${x} ${y}`} className="stroke-ink" strokeWidth={1} />
        ))}
      </g>
      <circle
        cx={QUERY[0]}
        cy={QUERY[1]}
        r={5}
        className={`dg ${step >= 2 ? "fill-warn" : "fill-transparent"}`}
        style={{ filter: step >= 2 ? "drop-shadow(0 0 6px rgba(251,191,36,0.7))" : undefined }}
      />

      <Edge d="M430 150 C440 150 440 108 452 104" vis={phase(step, 3, 3, "hidden")} />
      <Box x={440} y={62} w={112} h={42} label="intent" sub={step >= 3 ? "behaviour" : "?"} vis={phase(step, 3, 3, "dim")} />
      <Edge d="M496 104 V148" vis={phase(step, 4, 4, "hidden")} />
      <Box x={440} y={150} w={112} h={46} label="prompt.py" sub="layout for it" vis={phase(step, 4, 4, "dim")} />
    </Diagram>
  );
}

/* ----------------------------------------------------- LLM + validator */

const VALIDATOR_STEPS = [
  "The model only ever sees the evidence pack Why-Code fetched — nothing else.",
  "It drafts an answer. The draft is a proposal: code, not the model, decides what gets out.",
  "The validator splits the draft into claims and checks each cites a real alias whose text supports it.",
  "A claim naming a file, person, PR number, date or SHA that isn't in the pack is flagged as invented and dropped.",
  "What survives ships with a computed confidence. If nothing survives, the answer is refused: no evidence, no answer.",
];

const CLAIMS = [
  ["Retries are off by default [E1]", "✓ cites E1", "ok"],
  ["Callers opt in when idempotent [E1]", "✓ cites E1", "ok"],
  ["Added in PR #9999 by bob", "✗ PR invented", "bad"],
] as const;

export function ValidatorDiagram() {
  const stepper = useStepper(VALIDATOR_STEPS.length);
  const { step } = stepper;

  return (
    <Diagram
      stepper={stepper}
      steps={VALIDATOR_STEPS}
      viewBox="0 0 560 250"
      title="LLM proposes · code validates"
      label="Diagram: the LLM drafts three claims from the evidence pack; the validator keeps two cited claims and drops one invented PR reference."
    >
      <Box x={8} y={20} w={118} h={46} label="evidence pack" sub="E1 · E2 · E3" vis={phase(step, 0, 0)} />
      <Edge d="M67 66 V146" vis={phase(step, 0, 0)} />
      <Packet path="M67 66 V146" dur={1} show={step === 0} />
      <Box x={8} y={148} w={118} h={46} label="LLM" sub="proposes only" dashed vis={phase(step, 1, 1, "dim")} />
      {CLAIMS.map(([claim, verdict, tone], i) => {
        const y = 12 + i * 52;
        const checked = tone === "bad" ? step >= 3 : step >= 2;
        const dropped = tone === "bad" && step >= 3;
        return (
          <g key={claim}>
            <Edge d={`M126 171 C142 171 142 ${y + 21} 158 ${y + 21}`} vis={phase(step, 1, 1, "dim")} />
            <Box
              x={160}
              y={y}
              w={262}
              h={42}
              label={claim}
              vis={dropped ? "dim" : phase(step, 1, tone === "bad" ? 3 : 2, "dim")}
              tone={dropped ? "bad" : "ink"}
            />
            {dropped ? <path d={`M172 ${y + 21} H410`} className="stroke-bad" strokeWidth={1.25} /> : null}
            <Edge d={`M422 ${y + 21} H436`} vis={checked ? "on" : "hidden"} tone={tone} />
            <Box x={438} y={y + 4} w={114} h={34} label={verdict} tone={tone} vis={checked ? (step === (tone === "bad" ? 3 : 2) ? "hot" : "on") : "hidden"} />
          </g>
        );
      })}
      <Box
        x={160}
        y={176}
        w={392}
        h={54}
        label="answered · 2 claims kept · 1 dropped"
        sub="confidence computed from the evidence, never taken from the model"
        tone="ok"
        vis={phase(step, 4, 4, "dim")}
      />
    </Diagram>
  );
}

/* ------------------------------------------------------------------ MCP */

const MCP_STEPS = [
  "Before editing, a coding agent (Claude Code, Cursor, Codex) calls get_why on the file over MCP — a standard plug that lets AI tools call outside tools.",
  "The Why-Code MCP server looks up the decisions in force over that path in the ledger.",
  "The ledger returns the decision, its state and its verified evidence.",
  "The agent learns the rule before it touches the code — not after a reviewer catches it.",
  "Agents can record what they decide, but only as a proposal: a person has to accept it.",
];

const LIFELINES = [
  [92, "coding agent"],
  [280, "MCP server · stdio"],
  [468, "decision ledger"],
] as const;

const MESSAGES: [number, number, string][] = [
  [92, 280, "get_why(shop/client.py)"],
  [280, 468, "decisions in force over path"],
  [468, 280, "dec_1a2b · pinned · active"],
  [280, 92, "1 pinned decision + evidence"],
  [92, 280, "record_decision → proposed"],
];

export function McpDiagram() {
  const stepper = useStepper(MCP_STEPS.length);
  const { step } = stepper;

  return (
    <Diagram
      stepper={stepper}
      steps={MCP_STEPS}
      viewBox="0 0 560 268"
      title="MCP · get_why"
      label="Sequence diagram: a coding agent calls get_why over MCP, the server queries the ledger, and the agent receives the pinned decision before editing."
    >
      {LIFELINES.map(([x, name]) => (
        <g key={name}>
          <Box x={x - 74} y={8} w={148} h={32} label={name} />
          <path d={`M${x} 40 V262`} className="stroke-line" strokeDasharray="3 5" />
        </g>
      ))}
      {MESSAGES.map(([from, to, text], i) => {
        const y = 76 + i * 44;
        const dir = to > from ? -1 : 1;
        const d = `M${from + (to > from ? 6 : -6)} ${y} H${to + dir * 8}`;
        const vis = phase(step, i, i, "dim");
        return (
          <g key={text}>
            <Edge d={d} vis={vis} tone={i === 4 ? "warn" : "ink"} label={text} lx={(from + to) / 2} ly={y - 8} />
            <Packet path={d} dur={1.2} tone={i === 4 ? "warn" : "ink"} show={step === i} />
          </g>
        );
      })}
    </Diagram>
  );
}

/* -------------------------------------------------------- GitHub Action */

const ACTION_STEPS = [
  "A pull request changes shop/client.py.",
  "The GitHub Action rebuilds the ledger in CI and checks which recorded decisions the diff touches.",
  "It touches a pinned decision with no acknowledgement, so the check fails and the PR gets a comment listing the decision.",
  "The author adds a Decision-Ack: line explaining why the change is still right.",
  "The re-run passes, and the acknowledgement stays on record next to the change.",
];

export function ActionDiagram() {
  const stepper = useStepper(ACTION_STEPS.length);
  const { step } = stepper;

  return (
    <Diagram
      stepper={stepper}
      steps={ACTION_STEPS}
      viewBox="0 0 560 250"
      title="GitHub Action · decision check"
      label="Diagram: a PR touching a pinned decision fails the check until a Decision-Ack line is added, then passes."
    >
      <Box x={8} y={98} w={128} h={50} label="PR #57" sub="edits shop/client.py" vis={phase(step, 0, 0)} />
      <Edge d="M136 123 H170" vis={phase(step, 1, 1, "hidden")} />
      <Packet path="M136 123 H170" dur={0.9} show={step === 1} />
      <Box x={172} y={98} w={146} h={50} label="GitHub Action" sub="index → check_change" vis={phase(step, 1, 1, "dim")} />
      <Edge d="M318 112 C336 112 336 50 352 50" vis={phase(step, 2, 2, "hidden")} tone="bad" />
      <Box x={354} y={24} w={198} h={52} label="✗ check failed" sub="pinned dec_1a2b touched · no ack" tone="bad" vis={phase(step, 2, 2, "dim")} />
      <Edge d="M453 76 C453 150 245 140 245 184" vis={phase(step, 3, 3, "hidden")} dashed />
      <Box x={172} y={186} w={146} h={50} label="Decision-Ack:" sub="dec_1a2b — GETs only" vis={phase(step, 3, 3, "dim")} />
      <Edge d="M318 211 H352" vis={phase(step, 4, 4, "hidden")} tone="ok" />
      <Packet path="M318 211 H352" dur={0.9} tone="ok" show={step === 4} />
      <Box x={354} y={186} w={198} h={50} label="✓ check passed" sub="ack recorded with the change" tone="ok" vis={phase(step, 4, 4, "dim")} />
      <Txt x={10} y={24} tone="faint" vis={step >= 2 ? "on" : "hidden"}>
        blocks the merge, not the developer
      </Txt>
    </Diagram>
  );
}
