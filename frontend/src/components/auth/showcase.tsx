"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpIcon,
  CheckIcon,
  DatabaseIcon,
  FileTextIcon,
  GitPullRequestIcon,
  SparklesIcon,
} from "lucide-react";

import { Logo } from "@/components/logo";
import { KIND_COLORS } from "@/components/graph/graph-canvas";
import { cn } from "@/lib/utils";

/**
 * The auth pages' showcase: a living, animated render of the product
 * inside the site's neumorphic bubble — a loop of the four things
 * WhyCode does. Ask (a question types itself into the composer) →
 * Answer (a grounded reply with evidence chips) → Graph (the
 * connection graph draws itself) → Plan (the timeline checks itself
 * off). Pure CSS animation driven by a phase clock; reduced-motion
 * visitors get the answer scene, static.
 */

const PHASES = [
  { label: "Ask", caption: "Ask why — in plain words, about any public repo" },
  { label: "Answer", caption: "Every claim cites the PR, commit or review behind it" },
  { label: "Graph", caption: "Trace the graph path that connects question to decision" },
  { label: "Plan", caption: "Plan mode — what is already done, and what is needed" },
] as const;

const PHASE_MS = 4000;

const rise = (delay: number) => ({
  animation: `why-rise-in 600ms ease ${delay}ms both`,
});
const pop = (delay: number) => ({
  animation: `why-scale-in 450ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both`,
});

function AskScene() {
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-5 sm:p-7">
      <div
        className="rounded-2xl border border-border/60 bg-card p-4 shadow-neumorph"
        style={rise(100)}
      >
        <div className="flex items-start gap-2 text-[15px] text-foreground">
          <span className="overflow-hidden whitespace-nowrap" style={{ animation: "why-type 2100ms steps(38) 250ms both" }}>
            Why are retries disabled by default?
          </span>
          <span
            aria-hidden="true"
            className="mt-0.5 inline-block h-5 w-0.5 shrink-0 bg-primary"
            style={{ animation: "why-caret 850ms step-end infinite" }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
            <DatabaseIcon className="size-3" /> encode/httpx
          </span>
          <span className="inline-flex rounded-full border border-border/60 bg-background/60 p-0.5 text-[11px]">
            <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground">Why?</span>
            <span className="px-2 py-0.5 text-muted-foreground">Plan</span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <SparklesIcon className="size-3 text-primary" /> Nemotron
          </span>
          <span
            className="flex size-8 items-center justify-center rounded-full bg-primary-gradient text-white"
            style={pop(2500)}
          >
            <ArrowUpIcon className="size-4" />
          </span>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground" style={rise(600)}>
        Paste a repo, ask the question nobody documented.
      </p>
    </div>
  );
}

function AnswerScene() {
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-5 sm:p-7">
      <div
        className="ml-auto max-w-[75%] rounded-2xl rounded-br-md bg-primary/15 px-3.5 py-2.5 text-[13px] text-foreground"
        style={rise(100)}
      >
        Why are retries disabled by default?
      </div>
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-neumorph" style={rise(350)}>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
            High confidence
          </span>
          <span className="text-[10px] tracking-wider text-muted-foreground uppercase">Grounded answer</span>
        </div>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-foreground" style={rise(550)}>
          Retries are opt-in because the transport stays explicit about side
          effects — the maintainer chose predictability over magic.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px]" style={pop(950)}>
            <GitPullRequestIcon className="size-3 text-primary" /> PR #1525
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px]" style={pop(1150)}>
            <FileTextIcon className="size-3 text-primary" /> httpx/_config.py
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px]" style={pop(1350)}>
            <CheckIcon className="size-3 text-emerald-500" /> Refused when evidence is thin
          </span>
        </div>
      </div>
    </div>
  );
}

const GRAPH_NODES = [
  { id: "goal", label: "Goal", kind: "feature", x: 6, delay: 150 },
  { id: "cfg", label: "retry.max_attempts", kind: "config", x: 118, delay: 500 },
  { id: "file", label: "httpx/_config.py", kind: "file", x: 230, delay: 850 },
  { id: "pr", label: "PR #1525", kind: "pr", x: 342, delay: 1200 },
  { id: "dec", label: "Retries disabled", kind: "decision", x: 454, delay: 1550 },
] as const;

function GraphScene() {
  const y = 78;
  return (
    <div className="flex h-full flex-col justify-center p-5 sm:p-7">
      <svg viewBox="0 0 560 176" className="w-full" role="img" aria-label="The connection graph drawing itself">
        {GRAPH_NODES.slice(0, -1).map((node, index) => (
          <path
            key={node.id}
            d={`M ${node.x + 100} ${y + 21} C ${node.x + 112} ${y + 21}, ${GRAPH_NODES[index + 1].x - 12} ${y + 21}, ${GRAPH_NODES[index + 1].x} ${y + 21}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth="1.6"
            strokeDasharray="260"
            style={{ animation: `why-draw 700ms ease ${node.delay + 200}ms both` }}
          />
        ))}
        <path
          d={`M ${GRAPH_NODES[0].x + 50} ${y} C ${GRAPH_NODES[0].x + 130} ${y - 62}, ${GRAPH_NODES[4].x - 30} ${y - 62}, ${GRAPH_NODES[4].x + 50} ${y}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.4"
          strokeDasharray="560"
          strokeDashoffset="560"
          style={{ animation: `why-draw-long 900ms ease 2000ms both` }}
        />
        {GRAPH_NODES.map((node) => (
          <g
            key={node.id}
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: `why-scale-in 450ms cubic-bezier(0.34, 1.56, 0.64, 1) ${node.delay}ms both`,
            }}
          >
            <rect x={node.x} y={y} width="100" height="42" rx="10" fill="var(--card)" stroke="var(--border)" />
            <circle cx={node.x + 13} cy={y + 21} r="4" fill={KIND_COLORS[node.kind] ?? KIND_COLORS.module} />
            <text x={node.x + 24} y={y + 19} fontSize="9.5" fontWeight="600" fill="var(--foreground)">
              {node.label.length > 15 ? `${node.label.slice(0, 14)}…` : node.label}
            </text>
            <text x={node.x + 24} y={y + 32} fontSize="8" fill="var(--muted-foreground)">
              {node.kind}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-center text-xs text-muted-foreground" style={rise(2300)}>
        Goal → config → file → pull request → decision. Nothing invented.
      </p>
    </div>
  );
}

const PLAN_ROWS = [
  { label: "Keep transport explicit about side effects", at: 500 },
  { label: "Surface retry.max_attempts in config", at: 1200 },
  { label: "Document the opt-in in the client guide", at: 1900 },
] as const;

function PlanScene() {
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-5 sm:p-7">
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-neumorph" style={rise(100)}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Plan · implementation timeline
          </span>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            Plan mode
          </span>
        </div>
        <div className="space-y-2">
          {PLAN_ROWS.map((row, index) => (
            <div
              key={row.label}
              className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/50 px-3 py-2"
              style={rise(250 + index * 220)}
            >
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
                style={pop(row.at)}
              >
                <CheckIcon className="size-3" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{row.label}</span>
              <span
                className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-500"
                style={pop(row.at)}
              >
                done
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-border/50">
          <div
            className="h-full rounded-full bg-primary-gradient"
            style={{ animation: `why-fill 2600ms ease 400ms both` }}
          />
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground" style={rise(800)}>
        Steps grounded in the same evidence as the answer.
      </p>
    </div>
  );
}

const SCENES = [AskScene, AnswerScene, GraphScene, PlanScene];

export function Showcase() {
  const [phase, setPhase] = useState(1);
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(
      () => setPhase((value) => (value + 1) % PHASES.length),
      PHASE_MS,
    );
    return () => clearInterval(timer);
  }, [reducedMotion]);

  const Scene = SCENES[phase];

  return (
    <section
      aria-label="What WhyCode does"
      className="w-full rounded-3xl border border-border/60 bg-card p-5 shadow-neumorph sm:p-6"
    >
      <header className="flex items-center gap-3 px-1">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-gradient text-white shadow-neumorph">
          <Logo className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            WhyCode in action
          </p>
          <p className="truncate text-xs text-muted-foreground">
            The reasoning layer for your codebase
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live demo
        </span>
      </header>

      <div className="relative mt-4 min-h-[320px] overflow-hidden rounded-2xl border border-border/60 bg-background/40 shadow-[inset_2px_2px_5px_var(--neu-dark),inset_-2px_-2px_5px_var(--neu-light)] sm:min-h-[340px]">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(color-mix(in oklab, var(--muted-foreground) 26%, transparent) 1px, transparent 1.1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div key={phase} className="relative h-full min-h-[320px] sm:min-h-[340px]">
          <Scene />
        </div>
      </div>

      <footer className="px-1 pt-4">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Demo phases">
          {PHASES.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="tab"
              aria-selected={index === phase}
              onClick={() => setPhase(index)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                index === phase
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p
          key={`caption-${phase}`}
          className="pt-3 text-sm text-muted-foreground"
          style={{ animation: "why-fade-in 500ms ease both" }}
        >
          {PHASES[phase].caption}
        </p>
      </footer>
    </section>
  );
}
