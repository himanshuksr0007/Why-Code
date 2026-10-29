"use client";

import { DecisionCard } from "@/components/answer/decision-card";
import { DecisionStatusBadge } from "@/components/badges";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DecisionThread, TimelineStep } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEP_META: Record<
  TimelineStep["kind"],
  { label: string; dot: string }
> = {
  origin: { label: "Origin", dot: "var(--chart-2)" },
  revision: { label: "Revision", dot: "var(--chart-4)" },
  reversal: { label: "Reversal", dot: "var(--destructive)" },
};

function ThreadCard({
  thread,
  index = 0,
}: {
  thread: DecisionThread;
  index?: number;
}) {
  return (
    <Card
      className="animate-rise-in gap-0 overflow-hidden py-0"
      style={{ animationDelay: `${Math.min(index, 6) * 80}ms` }}
    >
      <CardHeader className="gap-1 border-b border-border/70 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold">
            {thread.topic}
          </h2>
          <DecisionStatusBadge status={thread.current_status} />
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {thread.steps.length} step{thread.steps.length === 1 ? "" : "s"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="py-4">
        <ol className="space-y-4">
          {thread.steps.map((step, index) => {
            const meta = STEP_META[step.kind];
            const isLast = index === thread.steps.length - 1;
            return (
              <li key={step.decision.decision_id} className="relative pl-7">
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-4 bottom-[-1rem] left-[5px] w-px bg-border"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 left-0 size-3 rounded-full ring-2 ring-background"
                  style={{ backgroundColor: meta.dot }}
                />
                <p className="flex items-center gap-2 text-xs tracking-wide text-muted-foreground uppercase">
                  <span
                    className={cn(
                      "font-medium",
                      step.kind === "reversal" && "text-destructive",
                    )}
                  >
                    {meta.label}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(step.decision.created_at)}</span>
                </p>
                <div className="mt-2">
                  <DecisionCard decision={step.decision} />
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

export function DecisionTimeline({ threads }: { threads: DecisionThread[] }) {
  if (threads.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
        No decisions have been extracted yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {threads.map((thread, index) => (
        <ThreadCard key={thread.thread_id} thread={thread} index={index} />
      ))}
    </div>
  );
}
