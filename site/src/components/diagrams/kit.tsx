"use client";

import { createContext, useContext, useId, type ReactNode } from "react";

import type { Stepper } from "@/lib/use-stepper";

/* Shared pieces for the animated, step-by-step SVG diagrams.
   Every diagram is a pure function of `step`; CSS transitions do the motion,
   so reduced motion only has to stop the timer and the moving packets. */

const MarkerContext = createContext("dg");
const MotionContext = createContext(false);

export type Vis = "hidden" | "dim" | "mute" | "on" | "hot";
export type Tone = "ink" | "ok" | "warn" | "bad";

const VIS: Record<Vis, string> = {
  hidden: "opacity-0",
  dim: "opacity-25",
  mute: "opacity-50",
  on: "opacity-100",
  hot: "opacity-100",
};
const STROKE: Record<Tone, string> = {
  ink: "stroke-line-strong",
  ok: "stroke-ok",
  warn: "stroke-warn",
  bad: "stroke-bad",
};
const HOT_FILL: Record<Tone, string> = {
  ink: "fill-ink",
  ok: "fill-ok/15",
  warn: "fill-warn/15",
  bad: "fill-bad/15",
};
const TEXT: Record<Tone, string> = {
  ink: "fill-ink",
  ok: "fill-ok",
  warn: "fill-warn",
  bad: "fill-bad",
};

/** "hot" on the listed steps, "on" from `from` onwards, otherwise `before`. */
export function phase(step: number, from: number, hot: number | number[] = [], before: Vis = "hidden"): Vis {
  const hotSteps = Array.isArray(hot) ? hot : [hot];
  if (hotSteps.includes(step)) return "hot";
  return step >= from ? "on" : before;
}

export function Diagram({
  stepper,
  steps,
  viewBox,
  label,
  title,
  children,
}: {
  stepper: Stepper;
  steps: string[];
  viewBox: string;
  label: string;
  title?: string;
  children: ReactNode;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { ref, step, go, reduced, paused, setPaused } = stepper;

  return (
    <figure
      ref={ref}
      className="overflow-hidden rounded-xl border border-line bg-canvas"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {title ? (
        <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="ml-2 truncate font-mono text-[11px] text-ink-faint">{title}</span>
        </div>
      ) : null}
      <MarkerContext value={uid}>
        <MotionContext value={reduced}>
          {/* On phones the diagram keeps a legible size and scrolls sideways
              inside its frame; from `sm` up it scales to fit. */}
          <div className="overflow-x-auto [scrollbar-width:thin]">
          <svg
            viewBox={viewBox}
            role="img"
            aria-label={label}
            className="block h-auto w-full min-w-[500px] select-none sm:min-w-0"
          >
            <defs>
              {(
                [
                  ["ink", "fill-ink-faint"],
                  ["hot", "fill-ink"],
                  ["ok", "fill-ok"],
                  ["warn", "fill-warn"],
                  ["bad", "fill-bad"],
                ] as const
              ).map(([key, cls]) => (
                <marker
                  key={key}
                  id={`${uid}-${key}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L10,5 L0,10 z" className={cls} />
                </marker>
              ))}
            </defs>
            {children}
          </svg>
          </div>
        </MotionContext>
      </MarkerContext>
      <figcaption className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-1">
          {steps.map((text, i) => (
            <button
              key={text}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show step ${i + 1} of ${steps.length}`}
              aria-current={i === step ? "step" : undefined}
              className="group cursor-pointer py-2 pr-1"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-ink" : i < step ? "w-3 bg-ink-soft" : "w-3 bg-line-strong group-hover:bg-ink-faint"
                }`}
              />
            </button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-ink-faint sm:hidden" aria-hidden="true">
            swipe ↔ ·{" "}
          </span>
          <span className="font-mono text-[11px] text-ink-faint max-sm:ml-1 sm:ml-auto">
            {reduced ? "" : paused ? "paused · " : ""}
            {step + 1}/{steps.length}
          </span>
        </div>
        <p key={step} className="rise mt-1.5 min-h-[4.5rem] text-sm leading-relaxed text-ink-soft sm:min-h-[3rem]">
          {steps[step]}
        </p>
        <ol className="sr-only">
          {steps.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}

export function Box({
  x,
  y,
  w,
  h = 34,
  label,
  sub,
  vis = "on",
  tone = "ink",
  rx = 8,
  dashed = false,
  align = "middle",
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  label: string;
  sub?: string;
  vis?: Vis;
  tone?: Tone;
  rx?: number;
  dashed?: boolean;
  align?: "middle" | "start";
}) {
  const hot = vis === "hot";
  const inkHot = hot && tone === "ink";
  const tx = align === "start" ? x + 12 : x + w / 2;
  const stroke = inkHot ? "stroke-ink" : tone !== "ink" ? STROKE[tone] : "stroke-line-strong";
  return (
    <g className={`dg ${VIS[vis]}`}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        strokeWidth={1.25}
        strokeDasharray={dashed ? "4 4" : undefined}
        className={`dg ${hot ? HOT_FILL[tone] : "fill-surface"} ${stroke}`}
        style={inkHot ? { filter: "drop-shadow(0 0 10px rgba(255,255,255,0.28))" } : undefined}
      />
      <text
        x={tx}
        y={sub ? y + h / 2 - 2.5 : y + h / 2 + 4}
        textAnchor={align}
        className={`dg font-mono text-[11.5px] ${inkHot ? "fill-canvas" : TEXT[tone]}`}
      >
        {label}
      </text>
      {sub ? (
        <text
          x={tx}
          y={y + h / 2 + 11.5}
          textAnchor={align}
          className={`dg font-mono text-[9.5px] ${inkHot ? "fill-canvas/70" : "fill-ink-faint"}`}
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

export function Edge({
  d,
  vis = "on",
  tone = "ink",
  label,
  lx,
  ly,
  anchor = "middle",
  dashed = false,
  arrow = true,
}: {
  d: string;
  vis?: Vis;
  tone?: Tone;
  label?: string;
  lx?: number;
  ly?: number;
  anchor?: "start" | "middle" | "end";
  dashed?: boolean;
  arrow?: boolean;
}) {
  const uid = useContext(MarkerContext);
  const hot = vis === "hot";
  const stroke = tone !== "ink" ? STROKE[tone] : hot ? "stroke-ink" : "stroke-ink-faint";
  const marker = tone !== "ink" ? tone : hot ? "hot" : "ink";
  return (
    <g className={`dg ${VIS[vis]}`}>
      <path
        d={d}
        fill="none"
        strokeWidth={hot ? 1.75 : 1.25}
        className={`${stroke} ${dashed ? (hot ? "flow-line" : "") : "dg-draw"}`}
        pathLength={dashed ? undefined : 1}
        strokeDasharray={dashed ? "4 6" : undefined}
        data-drawn={vis !== "hidden"}
        markerEnd={arrow ? `url(#${uid}-${marker})` : undefined}
      />
      {label && lx !== undefined && ly !== undefined ? (
        <text x={lx} y={ly} textAnchor={anchor} className={`font-mono text-[9px] ${hot ? "fill-ink-soft" : "fill-ink-faint"}`}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** A dot travelling along a path, forever. Omitted under reduced motion. */
export function Packet({
  path,
  dur = 1.8,
  delay = 0,
  tone = "ink",
  show = true,
}: {
  path: string;
  dur?: number;
  delay?: number;
  tone?: Tone;
  show?: boolean;
}) {
  const reduced = useContext(MotionContext);
  if (reduced || !show) return null;
  return (
    <circle
      r={3.5}
      className={TEXT[tone]}
      opacity={delay ? 0 : 1}
      style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.55))" }}
    >
      {delay ? <set attributeName="opacity" to="1" begin={`${delay}s`} /> : null}
      <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
    </circle>
  );
}

export function Txt({
  x,
  y,
  children,
  tone = "soft",
  size = 10,
  anchor = "start",
  vis = "on",
  mono = true,
}: {
  x: number;
  y: number;
  children: ReactNode;
  tone?: "soft" | "faint" | Tone;
  size?: number;
  anchor?: "start" | "middle" | "end";
  vis?: Vis;
  mono?: boolean;
}) {
  const cls =
    tone === "soft" ? "fill-ink-soft" : tone === "faint" ? "fill-ink-faint" : TEXT[tone];
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className={`dg ${VIS[vis]} ${cls} ${mono ? "font-mono" : "font-sans"}`}
      style={{ fontSize: size }}
    >
      {children}
    </text>
  );
}
