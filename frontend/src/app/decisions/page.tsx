import { Suspense } from "react";

import { AuditSummary } from "@/components/decisions/audit-summary";
import { DecisionExplorer } from "@/components/decisions/decision-explorer";
import { DecisionTimeline } from "@/components/decisions/decision-timeline";
import { RepoNotIndexed } from "@/components/repo/not-indexed";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveRepo } from "@/lib/active-repo";
import { api, findRepo } from "@/lib/api";

export const metadata = { title: "Decisions" };

function DecisionsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="rounded-xl border border-border/70 bg-card p-4"
        >
          <Skeleton className="h-5 w-56" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function DecisionsContent() {
  const repo = await getActiveRepo();
  if (!findRepo(repo)?.indexed) return <RepoNotIndexed repo={repo} />;
  const threads = await api.listDecisions(repo);
  return (
    <>
      <AuditSummary repo={repo} />
      <DecisionExplorer repo={repo} />
      <DecisionTimeline threads={threads} />
    </>
  );
}

export default function DecisionsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-xl font-semibold sm:text-2xl">
          Decision timeline
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Decisions are extracted from the evidence, then kept honest: a later
          revision or reversal is recorded rather than silently overwriting the
          original.
        </p>
      </header>

      <Suspense fallback={<DecisionsSkeleton />}>
        <DecisionsContent />
      </Suspense>
    </div>
  );
}
