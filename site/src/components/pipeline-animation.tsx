"use client";

import { useEffect, useRef, useState } from "react";
import {
  DatabaseIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  MessageSquareTextIcon,
  PickaxeIcon,
  ShieldCheckIcon,
  BotIcon,
  type LucideIcon,
} from "lucide-react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

type Stage = {
  id: string;
  label: string;
  icon: LucideIcon;
  caption: string;
  sample: { title: string; lines: { text: string; tone?: "ok" | "warn" | "bad" | "dim" }[] };
};

/** Every sample below is the real shape of what that stage produces. */
const STAGES: Stage[] = [
  {
    id: "history",
    label: "Your repo",
    icon: GitBranchIcon,
    caption:
      "Why-Code starts from what your team already wrote: commits, pull requests, reviews, ADR files and WHY: comments.",
    sample: {
      title: "shop/client.py",
      lines: [
        { text: "class Client:", tone: "dim" },
        { text: "    # WHY: retries are off by default because" },
        { text: "    # retrying POSTs duplicated orders." },
        { text: "    retries = 0", tone: "dim" },
      ],
    },
  },
  {
    id: "mine",
    label: "Find decisions",
    icon: PickaxeIcon,
    caption:
      "Plain rules — no AI guessing — pick out statements of a choice plus a reason, and the files they apply to.",
    sample: {
      title: "decision found",
      lines: [
        { text: "title   Retries are off by default" },
        { text: "why     retrying POSTs duplicated orders" },
        { text: "governs shop/client.py" },
        { text: "source  code comment, lines 2-3", tone: "dim" },
      ],
    },
  },
  {
    id: "verify",
    label: "Check it",
    icon: ShieldCheckIcon,
    caption:
      "Every quote is checked against the actual files and commits, and git tells us whether the code has moved on since.",
    sample: {
      title: "checks",
      lines: [
        { text: "✓ quote found verbatim at lines 2-3", tone: "ok" },
        { text: "✓ file still exists at HEAD", tone: "ok" },
        { text: "! 1 of 2 governed files changed since → needs review", tone: "warn" },
      ],
    },
  },
  {
    id: "ledger",
    label: "Decision ledger",
    icon: DatabaseIcon,
    caption:
      "The decision is stored with its evidence and an append-only log of who put it in force. Nobody — not even the app — can quietly rewrite that log.",
    sample: {
      title: "authority log",
      lines: [
        { text: "record   whycode-indexer   mined from code comment", tone: "dim" },
        { text: "accept   alice             “still how we do it”" },
        { text: "pin      alice             “duplicate orders are an incident”" },
      ],
    },
  },
  {
    id: "serve",
    label: "Use it everywhere",
    icon: MessageSquareTextIcon,
    caption:
      "The same record answers your questions with citations, briefs coding agents before they edit, and guards pull requests.",
    sample: {
      title: "three ways out",
      lines: [
        { text: "you    “why are retries off?” → answer + [E1] evidence" },
        { text: "agent  get_why(shop/client.py) → 1 pinned decision" },
        { text: "PR     touches pinned decision → needs Decision-Ack", tone: "bad" },
      ],
    },
  },
];

const OUTLETS = [
  { icon: MessageSquareTextIcon, label: "Answers" },
  { icon: BotIcon, label: "Agents (MCP)" },
  { icon: GitPullRequestIcon, label: "PR check" },
];

const STEP_MS = 3400;

export function PipelineAnimation() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.3,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || reduced || !visible) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % STAGES.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, [paused, reduced, visible]);

  const stage = STAGES[active];

  return (
    <div
      ref={rootRef}
      className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Stage rail */}
      <ol className="grid grid-cols-5 gap-1 sm:gap-2" aria-label="How Why-Code works, step by step">
        {STAGES.map((s, index) => {
          const Icon = s.icon;
          const on = index === active;
          const done = index < active;
          return (
            <li key={s.id} className="relative flex flex-col items-center">
              {index < STAGES.length - 1 ? (
                <svg
                  className="absolute top-5 left-1/2 h-2 w-full sm:top-6"
                  viewBox="0 0 100 2"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line
                    x1="18"
                    y1="1"
                    x2="82"
                    y2="1"
                    stroke={done || on ? "#ededed" : "#3a3a3a"}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    className={on ? "flow-line" : undefined}
                  />
                </svg>
              ) : null}
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-current={on ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${s.label}`}
                className={`relative z-10 flex size-10 cursor-pointer items-center justify-center rounded-xl border transition-all duration-300 sm:size-12 ${
                  on
                    ? "scale-110 border-ink bg-ink text-canvas shadow-[0_0_24px_rgba(255,255,255,0.25)]"
                    : done
                      ? "border-ink/60 bg-raised text-ink"
                      : "border-line-strong bg-canvas text-ink-faint hover:text-ink"
                }`}
              >
                <Icon className="size-4 sm:size-5" aria-hidden="true" />
              </button>
              <span
                className={`mt-2 text-center text-[10.5px] leading-tight sm:text-xs ${
                  on ? "text-ink" : "text-ink-faint"
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Stage detail */}
      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.15fr] md:items-stretch">
        <div key={`c-${stage.id}`} className="rise flex flex-col justify-center" aria-live="polite">
          <p className="font-mono text-xs text-ink-faint">
            {String(active + 1).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
          </p>
          <p className="mt-2 text-lg leading-snug font-medium text-ink">{stage.label}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{stage.caption}</p>
          {stage.id === "serve" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {OUTLETS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-xs text-ink"
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div key={`s-${stage.id}`} className="rise overflow-hidden rounded-xl border border-line bg-canvas">
          <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="ml-2 font-mono text-[11px] text-ink-faint">{stage.sample.title}</span>
          </div>
          <div className="space-y-1 overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed">
            {stage.sample.lines.map((line, i) => (
              <p
                key={line.text}
                className={`rise whitespace-pre ${
                  line.tone === "ok"
                    ? "text-ok"
                    : line.tone === "warn"
                      ? "text-warn"
                      : line.tone === "bad"
                        ? "text-bad"
                        : line.tone === "dim"
                          ? "text-ink-faint"
                          : "text-ink"
                }`}
                style={{ animationDelay: `${i * 140}ms` }}
              >
                {line.text}
              </p>
            ))}
            <span className="caret inline-block h-4 w-2 translate-y-0.5 bg-ink" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-ink-faint">
        <span>{reduced ? "Animation off (reduced motion). Use the steps above." : paused ? "Paused" : "Click a step to jump"}</span>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-ink transition-[width] duration-300"
            style={{ width: `${((active + 1) / STAGES.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
