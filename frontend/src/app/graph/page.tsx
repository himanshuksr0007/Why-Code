import { Suspense } from "react";
import { NetworkIcon } from "lucide-react";

import { PageHeader } from "@/components/explorer/page-header";
import { RepoSwitcher } from "@/components/explorer/repo-switcher";
import { GraphExplorer } from "@/components/graph/graph-explorer";
import { RepoNotIndexed } from "@/components/repo/not-indexed";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveRepo } from "@/lib/active-repo";
import { api, findRepo } from "@/lib/api";

export const metadata = { title: "Graph path" };

function GraphSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-[360px] w-full rounded-xl" />
    </div>
  );
}

async function GraphContent({
  searchParams,
}: {
  searchParams: PageProps<"/graph">["searchParams"];
}) {
  const params = await searchParams;
  const decision =
    typeof params.decision === "string" ? params.decision : undefined;

  const repo = await getActiveRepo();
  if (!findRepo(repo)?.indexed) {
    return <RepoNotIndexed repo={repo} />;
  }
  const threads = await api.listDecisions(repo);
  const options = threads.flatMap((thread) =>
    thread.steps.map((step) => ({
      id: step.decision.decision_id,
      label: step.decision.title ?? step.decision.claim,
    })),
  );

  // Keyed on the decision so a different ?decision= remounts with fresh state.
  return (
    <GraphExplorer
      key={decision ?? "_"}
      options={options}
      initialDecision={decision}
    />
  );
}

export default function GraphPage(props: PageProps<"/graph">) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        icon={NetworkIcon}
        title="Graph explorer"
        subtitle="Every claim should be traceable. This view walks a decision back through the graph — from the config key or symbol, to the commit and pull request, to the evidence that supports it."
      >
        <RepoSwitcher />
      </PageHeader>

      <div className="mt-8">
        <Suspense fallback={<GraphSkeleton />}>
          <GraphContent searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
