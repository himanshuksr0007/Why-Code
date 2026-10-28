"use client";

import { useId, useMemo } from "react";
import {
  CheckIcon,
  CircleDashedIcon,
  LoaderIcon,
  NetworkIcon,
} from "lucide-react";

import type { Citation, PlanStep } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Timeline table                                                      */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<
  PlanStep["status"],
  { label: string; className: string; Icon: typeof CheckIcon }
> = {
  done: {
    label: "Done",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Icon: CheckIcon,
  },
  needed: {
    label: "Needed",
    className: "bg-primary/10 text-primary",
    Icon: CircleDashedIcon,
  },
  in_progress: {
    label: "In progress",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    Icon: LoaderIcon,
  },
};

function EvidenceChips({
  ids,
  citations,
}: {
  ids: string[];
  citations: Citation[];
}) {
  if (ids.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const index = citations.findIndex((c) => c.evidence_id === id);
        if (index === -1) return null;
        return (
          <span
            key={id}
            title={citations[index].title ?? id}
            className="rounded-md bg-accent/60 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground/80"
          >
            E{index + 1}
          </span>
        );
      })}
    </span>
  );
}

/**
 * The plan's code timeline as a proper table: what is already in the
 * repository (done, proven by decisions), what the goal still needs,
 * and the evidence each row stands on.
 */
export function PlanTable({
  steps,
  citations,
}: {
  steps: PlanStep[];
  citations: Citation[];
}) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        The plan has no steps — the retrieval returned nothing to build on.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="bg-accent/40 text-left">
            <th className="px-3 py-2.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              #
            </th>
            <th className="px-3 py-2.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Step
            </th>
            <th className="px-3 py-2.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Status
            </th>
            <th className="px-3 py-2.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Evidence
            </th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, index) => {
            const status = STATUS_STYLE[step.status];
            return (
              <tr
                key={`${step.title}-${index}`}
                className="border-t border-border/50 align-top"
              >
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full font-mono text-[11px] font-semibold",
                      step.status === "done"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {index + 1}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-foreground">{step.title}</p>
                  {step.detail ? (
                    <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      status.className,
                    )}
                  >
                    <status.Icon className="size-3" aria-hidden="true" />
                    {status.label}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <EvidenceChips ids={step.evidence_ids} citations={citations} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
