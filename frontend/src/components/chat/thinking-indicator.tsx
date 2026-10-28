"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const STEPS = [
  "Searching the graph for decisions",
  "Reading reviews, commits and pull requests",
  "Checking the evidence it found",
];

const PLAN_STEPS = [
  "Searching the graph for decisions",
  "Walking the code timeline",
  "Mapping how the pieces connect",
];

/**
 * The "thinking" state shown between a question and its answer.
 *
 * Rotating detail keeps the wait legible — it says what the system is doing,
 * not just that it is busy. Motion is opt-in, so reduced-motion users get the
 * static label instead of bouncing dots. Plan mode gets its own wording.
 */
export function ThinkingIndicator({
  className,
  mode,
}: {
  className?: string;
  mode?: "why" | "plan";
}) {
  const [step, setStep] = useState(0);
  const steps = mode === "plan" ? PLAN_STEPS : STEPS;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((value) => (value + 1) % steps.length);
    }, 1600);
    return () => window.clearInterval(timer);
  }, [steps]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-2xl bg-card shadow-neumorph p-4",
        className,
      )}
    >
      <div className="size-8 rounded-full overflow-hidden shrink-0 border border-border/60 shadow-xs bg-muted mt-0.5">
        <img
          src="/WhyAgent.png"
          alt="WhyAgent logo"
          className="size-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p aria-hidden="true" className="font-heading text-sm font-medium text-foreground">
            {mode === "plan" ? "WhyAgent is drafting your plan…" : "WhyAgent is thinking…"}
          </p>
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center gap-1"
          >
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="size-1.5 rounded-full bg-primary motion-safe:animate-bounce"
                style={{ animationDelay: `${index * 160}ms` }}
              />
            ))}
          </span>
        </div>
        <p aria-hidden="true" className="mt-0.5 text-xs text-muted-foreground">
          {steps[step]}
        </p>
        <span className="sr-only">
          {mode === "plan" ? "Drafting a grounded plan" : "Retrieving a grounded answer"}
        </span>
      </div>
    </div>
  );
}
