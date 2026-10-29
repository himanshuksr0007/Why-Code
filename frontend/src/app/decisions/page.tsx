import { Suspense } from "react";
import { ScaleIcon } from "lucide-react";

import { AuditSummary } from "@/components/decisions/audit-summary";
import { DecisionExplorer } from "@/components/decisions/decision-explorer";
import { DecisionTimeline } from "@/components/decisions/decision-timeline";
import { DecisionsAside } from "@/components/decisions/decisions-aside";
import { PageHeader } from "@/components/explorer/page-header";
import { RepoSwitcher } from "@/components/explorer/repo-switcher";
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
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <AuditSummary repo={repo} />
        <DecisionExplorer repo={repo} />
        <DecisionTimeline threads={threads} />
      </div>
      <DecisionsAside repo={repo} />
    </div>
  );
}

export default function DecisionsPage() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        icon={ScaleIcon}
        title="Decision center"
        subtitle="Decisions are extracted from the evidence, then kept honest: a later revision or reversal is recorded rather than silently overwriting the original."
      >
        <RepoSwitcher />
      </PageHeader>

      <div className="mt-8">
        <Suspense fallback={<DecisionsSkeleton />}>
          <DecisionsContent />
        </Suspense>
      </div>
    </div>
  );
}
