"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const STEPS = [
  "Searching the graph for decisions",
  "Reading reviews, commits and pull requests",
  "Checking the evidence it found",
];

/**
 * The "thinking" state shown between a question and its answer.
 *
 * Rotating detail keeps the wait legible — it says what the system is doing,
 * not just that it is busy. Motion is opt-in, so reduced-motion users get the
 * static label instead of bouncing dots.
 */
export function ThinkingIndicator({ className }: { className?: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((value) => (value + 1) % STEPS.length);
    }, 1600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mt-1.5 flex shrink-0 items-center gap-1"
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 rounded-full bg-primary motion-safe:animate-bounce"
            style={{ animationDelay: `${index * 160}ms` }}
          />
        ))}
      </span>
      <div className="min-w-0">
        <p aria-hidden="true" className="font-heading text-sm font-medium">
          Thinking…
        </p>
        <p aria-hidden="true" className="mt-0.5 text-xs text-muted-foreground">
          {STEPS[step]}
        </p>
        <span className="sr-only">Retrieving a grounded answer</span>
      </div>
    </div>
  );
}
