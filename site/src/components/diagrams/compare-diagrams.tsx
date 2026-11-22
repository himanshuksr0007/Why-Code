"use client";

import { useStepper } from "@/lib/use-stepper";

import { Box, Diagram, Edge, Packet, Txt, phase, type Vis } from "./kit";

/* ------------------------------------------------- chat vs. a record */

const RECORD_STEPS = [
  "Ask a chat why retries are off and you get a good answer — kept in your own chat history.",
  "A teammate asks next week. They get an answer too: worded differently, checked against nothing, visible only to them.",
  "Why-Code records the decision once, from the repository: the quote verified against git, and a named person who accepted it.",
  "Everyone reads that same record — you, your teammate, and coding agents over MCP.",
  "And the PR check enforces it: a change that breaks a pinned decision can't merge without an acknowledgement.",
];

export function ChatVsRecordDiagram() {
  const stepper = useStepper(RECORD_STEPS.length);
  const { step } = stepper;
  const reader = (i: number): Vis => (step === 3 && i < 2 ? "hot" : step >= 3 ? "on" : "dim");

  return (
    <Diagram
      stepper={stepper}
      steps={RECORD_STEPS}
      viewBox="0 0 560 280"
      title="a chat answer vs. a decision record"
      label="Diagram: two people asking a chat get separate, unchecked answers; Why-Code records one verified decision that people, agents and the PR check all read."
    >
      <Txt x={12} y={18} tone="faint" size={9.5}>
        A CHAT
      </Txt>
      <Box x={12} y={28} w={118} h={36} label="you · Monday" vis={phase(step, 0, 0)} />
      <Edge d="M130 46 H168" vis={phase(step, 0, 0)} />
      <Box x={170} y={28} w={230} h={36} label="“because POSTs duplicated…”" sub="in your history only" vis={phase(step, 0, 0)} />
      <Box x={12} y={76} w={118} h={36} label="teammate · Fri" vis={phase(step, 1, 1, "dim")} />
      <Edge d="M130 94 H168" vis={phase(step, 1, 1, "dim")} />
      <Box x={170} y={76} w={230} h={36} label="“probably for safety…”" sub="different words · unchecked" vis={phase(step, 1, 1, "dim")} />
      <Txt x={414} y={60} tone="bad" vis={phase(step, 1)}>
        ✗ no shared record
      </Txt>
      <Txt x={414} y={78} tone="bad" vis={phase(step, 1)}>
        ✗ nothing verified
      </Txt>
      <Txt x={414} y={96} tone="bad" vis={phase(step, 1)}>
        ✗ can&rsquo;t block a merge
      </Txt>

      <path d="M12 130 H548" className="stroke-line" strokeDasharray="3 5" />

      <Txt x={12} y={152} tone="faint" size={9.5}>
        WHY-CODE
      </Txt>
      <Box x={12} y={186} w={118} h={44} label="repo history" sub="comment · PR · ADR" vis={phase(step, 2, 2, "dim")} />
      <Edge d="M130 208 H168" vis={phase(step, 2, 2, "dim")} />
      <Packet path="M130 208 H168" dur={0.9} show={step === 2} />
      <Box
        x={170}
        y={178}
        w={190}
        h={60}
        label="dec_1a2b · retries off"
        sub="verified · accepted by alice"
        vis={phase(step, 2, [2, 3, 4], "dim")}
      />
      {(
        [
          [142, "you"],
          [176, "teammate"],
          [210, "agents · MCP"],
        ] as const
      ).map(([y, name], i) => {
        const d = `M360 208 C380 208 380 ${y + 14} 398 ${y + 14}`;
        return (
          <g key={name}>
            <Edge d={d} vis={reader(i)} />
            <Packet path={d} dur={1.1} delay={i * 0.2} show={step === 3} />
            <Box x={400} y={y} w={148} h={28} label={name} vis={reader(i)} />
          </g>
        );
      })}
      <Edge d="M360 216 C380 216 380 258 398 258" vis={step === 4 ? "hot" : "dim"} tone={step === 4 ? "warn" : "ink"} />
      <Packet path="M360 216 C380 216 380 258 398 258" dur={1} tone="warn" show={step === 4} />
      <Box
        x={400}
        y={244}
        w={148}
        h={28}
        label="PR check · enforces"
        tone={step === 4 ? "warn" : "ink"}
        vis={step === 4 ? "hot" : "dim"}
      />
    </Diagram>
  );
}

/* ------------------------------------------------------- remove the AI */

const AI_STEPS = [
  "Model on: answers are phrased in plain language, citing only the evidence Why-Code fetched. Optional LLM extraction can propose extra decisions.",
  "Model off: the ledger, verification, freshness, authority log, PR check and MCP server keep working. Answers come back as the recorded decisions and their evidence instead of prose.",
];

const PARTS: { name: string; model?: boolean }[] = [
  { name: "rule miners" },
  { name: "quote verification" },
  { name: "git currency" },
  { name: "decision ledger" },
  { name: "authority log" },
  { name: "PR check" },
  { name: "MCP server" },
  { name: "evidence search" },
  { name: "answer phrasing", model: true },
  { name: "LLM extraction", model: true },
];

export function RemoveAiDiagram() {
  const stepper = useStepper(AI_STEPS.length, 3400);
  const { step } = stepper;
  const off = step === 1;

  return (
    <Diagram
      stepper={stepper}
      steps={AI_STEPS}
      viewBox="0 0 560 236"
      title="the test · switch the model off"
      label="Diagram: with the language model switched off, every part of the ledger keeps running; only answer phrasing and optional LLM extraction stop."
    >
      <g>
        <rect
          x={12}
          y={10}
          width={52}
          height={26}
          rx={13}
          strokeWidth={1.25}
          className={`dg ${off ? "fill-surface stroke-line-strong" : "fill-ink stroke-ink"}`}
        />
        <circle
          cx={25}
          cy={23}
          r={9}
          className={`dg ${off ? "fill-ink-faint" : "fill-canvas"}`}
          style={{
            transform: `translateX(${off ? 0 : 26}px)`,
            transition: "transform 0.45s cubic-bezier(0.2,0.7,0.2,1), fill 0.45s ease",
          }}
        />
        <Txt x={76} y={27} tone="ink" size={11}>
          {off ? "model: off" : "model: on"}
        </Txt>
        <Txt x={548} y={27} anchor="end" tone={off ? "ok" : "faint"} size={10}>
          {off ? "8 of 10 parts still running" : "all parts running"}
        </Txt>
      </g>

      {PARTS.map((part, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 12 + col * 136;
        const y = 50 + row * 46;
        const stopped = off && part.model;
        return (
          <g key={part.name}>
            <Box
              x={x}
              y={y}
              w={128}
              h={36}
              label={part.name}
              sub={stopped ? "stopped" : off ? "✓ running" : part.model ? "uses the model" : "plain code"}
              dashed={part.model}
              tone={off && !part.model ? "ok" : "ink"}
              vis={stopped ? "dim" : "on"}
            />
          </g>
        );
      })}

      <Box
        x={284}
        y={142}
        w={264}
        h={36}
        label={off ? "answer = decisions + evidence" : "answer = prose + [E1] citations"}
        tone={off ? "ok" : "ink"}
        vis="hot"
      />
      <Txt x={12} y={204} tone="faint" size={9.5}>
        dashed = uses a language model · everything else is ordinary code with tests
      </Txt>
      <Txt x={12} y={222} tone="faint" size={9.5}>
        the model makes answers readable; it never decides what is true
      </Txt>
    </Diagram>
  );
}
