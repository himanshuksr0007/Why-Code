"use client";

import Link from "next/link";
import { GitPullRequestIcon, RouteIcon } from "lucide-react";

import { ConfidenceBadge, DecisionStatusBadge } from "@/components/badges";
import { usePullRequestPanel } from "@/components/pull-request/pull-request-provider";
import { Button } from "@/components/ui/button";
import type { Decision } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

/**
 * A single extracted decision. Shared by the answer panel and the decision
 * timeline so the same claim renders identically in both places.
 */
export function DecisionCard({ decision }: { decision: Decision }) {
  const { openPullRequest } = usePullRequestPanel();

  return (
    <article className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <DecisionStatusBadge status={decision.status} />
        <ConfidenceBadge confidence={decision.confidence} />
        {decision.pr_number ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => openPullRequest(decision.pr_number as number)}
          >
            <GitPullRequestIcon aria-hidden="true" />
            PR #{decision.pr_number}
          </Button>
        ) : null}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {formatDate(decision.created_at)}
        </span>
      </div>

      {decision.title ? (
        <h3 className="mt-3 font-heading text-sm font-semibold">
          {decision.title}
        </h3>
      ) : null}
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {decision.claim}
      </p>

      {decision.targets.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {decision.targets.map((target, idx) => (
            <span
              key={`${target.type}:${target.identifier}-${idx}`}
              className="rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
            >
              {target.identifier}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">
          {decision.evidence_ids.length} evidence
          {decision.evidence_ids.length === 1 ? "" : " items"}
        </span>
        <Button
          render={<Link href={`/graph?decision=${decision.decision_id}`} />}
          nativeButton={false}
          variant="ghost"
          size="xs"
          className="ml-auto"
        >
          <RouteIcon aria-hidden="true" />
          Graph path
        </Button>
      </div>
    </article>
  );
}
