"use client";

import { useEffect, useState } from "react";
import type { ComponentType, KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  DatabaseIcon,
  EyeOffIcon,
  FileTextIcon,
  GitPullRequestIcon,
  GlobeIcon,
  LockIcon,
  Share2Icon,
  SparklesIcon,
} from "lucide-react";

import { KIND_COLORS } from "@/components/graph/graph-canvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import {
  dismissTour,
  hydrateTour,
  openTour,
  useTour,
} from "@/lib/onboarding/tour";
import { cn } from "@/lib/utils";

/**
 * The new-user product tour: a stepper of bubbles in the site's own
 * design language. Each step is a small living render of the real UI
 * (the same scenes and animation vocabulary as the signup showcase)
 * on a dotted inset stage, the feature's name under it, then what it
 * does and a "try it" hint. Skip / finish once and it never nags
 * again; replay lives in the profile bubble's menu.
 */

const rise = (delay: number) => ({
  animation: `why-rise-in 600ms ease ${delay}ms both`,
});
const pop = (delay: number) => ({
  animation: `why-scale-in 450ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both`,
});

/* ------------------------------ Scenes ------------------------------ */

function AskScene() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-5">
      <div
        className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-4 shadow-neumorph"
        style={rise(100)}
      >
        <div className="flex items-start gap-2 text-[14px] text-foreground">
          <span
            className="overflow-hidden whitespace-nowrap"
            style={{ animation: "why-type 1900ms steps(38) 250ms both" }}
          >
            Why are retries disabled by default?
          </span>
          <span
            aria-hidden="true"
            className="mt-0.5 inline-block h-4.5 w-0.5 shrink-0 bg-primary"
            style={{ animation: "why-caret 850ms step-end infinite" }}
          />
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
            <DatabaseIcon className="size-3" /> encode/httpx
          </span>
          <span className="inline-flex rounded-full border border-border/60 bg-background/60 p-0.5 text-[11px]">
            <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground">
              Why?
            </span>
            <span className="px-2 py-0.5 text-muted-foreground">Plan</span>
          </span>
          <span
            className="ml-auto flex size-8 items-center justify-center rounded-full bg-primary-gradient text-white"
            style={pop(2300)}
          >
            <ArrowUpIcon className="size-4" />
          </span>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground" style={rise(650)}>
        The question nobody documented — answered from the repo itself.
      </p>
    </div>
  );
}

function AnswerScene() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 p-5">
      <div
        className="ml-auto max-w-[75%] rounded-2xl rounded-br-md bg-primary/15 px-3.5 py-2 text-[12.5px] text-foreground"
        style={rise(100)}
      >
        Why are retries disabled by default?
      </div>
      <div
        className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-neumorph"
        style={rise(320)}
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
            High confidence
          </span>
          <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
            Grounded answer
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground" style={rise(520)}>
          Retries are opt-in because the transport stays explicit about side
          effects — predictability over magic.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px]" style={pop(900)}>
            <GitPullRequestIcon className="size-3 text-primary" /> PR #1525
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px]" style={pop(1100)}>
            <FileTextIcon className="size-3 text-primary" /> httpx/_config.py
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px]" style={pop(1300)}>
            <CheckIcon className="size-3 text-emerald-500" /> Refuses when evidence is thin
          </span>
        </div>
      </div>
    </div>
  );
}

const PLAN_SCENE_ROWS = [
  { label: "Retries stay opt-in — recorded as a decision", status: "Done", at: 450 },
  { label: "Surface retry.max_attempts in the client config", status: "Needed", at: 950 },
  { label: "Cover the new behaviour with tests", status: "Needed", at: 1450 },
] as const;

function PlanScene() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-5">
      <div
        className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-4 shadow-neumorph"
        style={rise(100)}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[10.5px] font-medium tracking-wider text-muted-foreground uppercase">
            Plan · step timeline
          </span>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            Plan mode
          </span>
        </div>
        <div className="space-y-1.5">
          {PLAN_SCENE_ROWS.map((row, index) => (
            <div
              key={row.label}
              className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/50 px-3 py-2"
              style={rise(220 + index * 200)}
            >
              {row.status === "Done" ? (
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
                  style={pop(row.at)}
                >
                  <CheckIcon className="size-3" />
                </span>
              ) : (
                <span className="size-5 shrink-0 rounded-full border border-dashed border-amber-500/60" />
              )}
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                {row.label}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  row.status === "Done"
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-amber-500/15 text-amber-500",
                )}
              >
                {row.status}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/50">
          <div
            className="h-full w-1/3 rounded-full bg-primary-gradient"
            style={{ animation: `why-fill 2400ms ease 400ms both` }}
          />
        </div>
      </div>
    </div>
  );
}

const GRAPH_NODES = [
  { id: "goal", label: "Goal", kind: "feature", x: 6, delay: 150 },
  { id: "cfg", label: "retry.max_attempts", kind: "config", x: 118, delay: 480 },
  { id: "file", label: "httpx/_config.py", kind: "file", x: 230, delay: 810 },
  { id: "pr", label: "PR #1525", kind: "pr", x: 342, delay: 1140 },
  { id: "dec", label: "Retries disabled", kind: "decision", x: 454, delay: 1470 },
] as const;

function GraphScene() {
  const y = 44;
  return (
    <div className="flex h-full flex-col items-center justify-center p-5">
      <svg
        viewBox="0 0 560 128"
        className="w-full max-w-lg"
        role="img"
        aria-label="The connection graph drawing itself"
      >
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
          d={`M ${GRAPH_NODES[0].x + 50} ${y} C ${GRAPH_NODES[0].x + 130} ${y - 40}, ${GRAPH_NODES[4].x - 30} ${y - 40}, ${GRAPH_NODES[4].x + 50} ${y}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.4"
          strokeDasharray="560"
          strokeDashoffset="560"
          style={{ animation: `why-draw-long 900ms ease 1900ms both` }}
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
      <p className="mt-2 text-center text-xs text-muted-foreground" style={rise(2200)}>
        Goal → config → file → pull request → decision. Nothing invented.
      </p>
    </div>
  );
}

function DecisionsScene() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 p-5">
      <div className="flex gap-2" style={rise(100)}>
        {[
          { top: "6", bottom: "decisions on record" },
          { top: "100%", bottom: "carry a rationale" },
          { top: "2", bottom: "superseded, kept" },
        ].map((stat) => (
          <div
            key={stat.bottom}
            className="flex-1 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-neumorph"
          >
            <p className="text-base leading-none font-semibold text-foreground">{stat.top}</p>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">{stat.bottom}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-neumorph" style={rise(320)}>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
            Active
          </span>
          <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
            High confidence
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground">ADR export</span>
        </div>
        <p className="mt-1.5 text-[13px] font-medium text-foreground">
          Retries are disabled by default; callers must opt in explicitly.
        </p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card p-3.5 opacity-80 shadow-neumorph" style={rise(540)}>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
            Superseded
          </span>
          <span className="text-[10px] text-muted-foreground">kept on record, never overwritten</span>
        </div>
        <p className="mt-1.5 text-[13px] font-medium text-foreground">
          Retry automatically up to 3 times on any failure.
        </p>
      </div>
    </div>
  );
}

function YoursScene() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 p-5">
      <div
        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-neumorph"
        style={rise(100)}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Share2Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground">Share this chat</p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            A read-only copy, behind your link
          </p>
        </div>
        <span className="inline-flex shrink-0 gap-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-[10px]">
            <GlobeIcon className="size-3" /> Public
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">
            <LockIcon className="size-3" /> Private
          </span>
        </span>
      </div>
      <div
        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-neumorph"
        style={rise(320)}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <EyeOffIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground">Incognito mode</p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            History hidden — new chats are never saved
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-500">
          On
        </span>
      </div>
      <div
        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-neumorph"
        style={rise(540)}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <SparklesIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground">Bring your own model</p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            Any OpenAI-compatible model, key encrypted
          </p>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">0.0k / 128k</span>
      </div>
    </div>
  );
}

/* ------------------------------ Steps ------------------------------- */

interface TourStep {
  kicker: string;
  title: string;
  details: string;
  tip: string;
  Scene: ComponentType;
}

const STEPS: TourStep[] = [
  {
    kicker: "Start here",
    title: "Ask why, in plain words",
    details:
      "Pick or paste any public GitHub repository and ask the question nobody documented. No account and no API keys — everything runs on the server, you just ask.",
    tip: "Try one of the example questions on the home page.",
    Scene: AskScene,
  },
  {
    kicker: "Why? mode",
    title: "Answers grounded in evidence",
    details:
      "Every claim cites the pull request, commit or review behind it, with a confidence rating. When the record is too thin, Why-Code refuses instead of guessing.",
    tip: "Open the Evidence tab on any answer to inspect the actual diff.",
    Scene: AnswerScene,
  },
  {
    kicker: "Plan mode",
    title: "What's done, what's needed",
    details:
      "Flip the composer to Plan and ask how to build something. You get a step timeline — what the codebase already does, and what your change still needs — every step tied to evidence.",
    tip: "Plan answers also get a Connections tab with the graph.",
    Scene: PlanScene,
  },
  {
    kicker: "Connection graph",
    title: "See how it all connects",
    details:
      "Every answer carries its graph path: goal, config, files, commits, the PR and the decision it led to. Open it fullscreen from the right rail to pan, zoom and drag nodes.",
    tip: "Ask how a repo is structured to get a directory-tree graph.",
    Scene: GraphScene,
  },
  {
    kicker: "Decision center",
    title: "Every decision, on record",
    details:
      "The Decisions page collects what the repo has decided — searchable, filterable, with an audit summary. Later reversals are recorded as supersessions, never silently overwritten, and any record exports as an ADR.",
    tip: "Search across every indexed repo with “All indexed repos”.",
    Scene: DecisionsScene,
  },
  {
    kicker: "Your space",
    title: "Keep it, hide it, share it",
    details:
      "Chats live in your browser. Share one with a public link — or a private link only whitelisted @handles can open. Incognito mode hides your history and keeps new chats completely unsaved.",
    tip: "Replay this tour anytime from your profile menu.",
    Scene: YoursScene,
  },
];

/* ----------------------------- Dialog ------------------------------- */

export function TutorialDialog() {
  const { open } = useTour();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open ]);

  const last = step === STEPS.length - 1;
  const { kicker, title, details, tip, Scene } = STEPS[step];

  const goTo = (next: number) => {
    hapticSelection();
    setStep(Math.min(Math.max(next, 0), STEPS.length - 1));
  };

  const finish = () => {
    hapticSuccess();
    dismissTour();
  };

  const handleKeys = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") goTo(step + 1);
    if (event.key === "ArrowLeft") goTo(step - 1);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismissTour();
      }}
    >
      <DialogContent
        showCloseButton
        onKeyDown={handleKeys}
        className="max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto rounded-3xl border-border/60 bg-card p-0 shadow-neumorph sm:max-w-xl"
        aria-label="Product tour"
      >
        {/* The stage: a living render of the feature, in the site's
            inset dotted bubble like the signup showcase. */}
        <div className="relative m-3 mb-0 h-60 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-background/40 shadow-[inset_2px_2px_5px_var(--neu-dark),inset_-2px_-2px_5px_var(--neu-light)] sm:m-4 sm:mb-0 sm:h-64">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(color-mix(in oklab, var(--muted-foreground) 26%, transparent) 1px, transparent 1.1px)",
              backgroundSize: "18px 18px",
            }}
          />
          <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase backdrop-blur">
            <SparklesIcon className="size-3 text-primary" />
            Quick tour · {step + 1} of {STEPS.length}
          </span>
          <div key={step} className="relative h-full">
            <Scene />
          </div>
        </div>

        {/* Feature name + what it does. */}
        <div key={`copy-${step}`} className="px-6 pt-4 sm:px-7" style={{ animation: "why-fade-in 350ms ease both" }}>
          <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
            {kicker}
          </p>
          <DialogTitle className="pt-1 font-heading text-xl font-semibold text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="pt-1.5 leading-relaxed">
            {details}
          </DialogDescription>
          <p className="flex items-start gap-1.5 pt-3 text-xs text-muted-foreground">
            <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">Try it: </span>
              {tip}
            </span>
          </p>
        </div>

        {/* Stepper footer: Skip on the left, dots in the middle,
            Back / Next on the right — like the reference card. */}
        <div className="flex items-center gap-2 px-6 pt-5 pb-5 sm:px-7">
          {last ? (
            <span className="w-20" aria-hidden="true" />
          ) : (
            <Button variant="ghost" onClick={() => dismissTour()} className="w-20">
              Skip tour
            </Button>
          )}
          <div className="flex flex-1 items-center justify-center gap-1.5" role="tablist" aria-label="Tour steps">
            {STEPS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                role="tab"
                aria-selected={index === step}
                aria-label={`Step ${index + 1}: ${item.title}`}
                onClick={() => goTo(index)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  index === step
                    ? "w-6 bg-primary"
                    : "w-2 bg-border hover:bg-muted-foreground/50",
                )}
              />
            ))}
          </div>
          {step > 0 && (
            <Button variant="ghost" size="icon" onClick={() => goTo(step - 1)} aria-label="Previous step">
              <ArrowLeftIcon className="size-4" />
            </Button>
          )}
          {last ? (
            <Button onClick={finish}>
              Start asking
              <ArrowRightIcon className="size-4" />
            </Button>
          ) : (
            <Button onClick={() => goTo(step + 1)}>
              Next
              <ArrowRightIcon className="size-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mounted by the app shell on every framed page: reads the seen-flag
 * once, and auto-opens the tour a beat after a first-time visitor
 * lands on the home page. Replay (profile menu) works from anywhere.
 */
export function TutorialHost() {
  const pathname = usePathname();
  const { seen, hydrated } = useTour();

  useEffect(() => {
    hydrateTour();
  }, []);

  useEffect(() => {
    if (pathname !== "/" || !hydrated || seen) return;
    const timer = setTimeout(() => openTour(), 900);
    return () => clearTimeout(timer);
  }, [pathname, hydrated, seen]);

  return <TutorialDialog />;
}
