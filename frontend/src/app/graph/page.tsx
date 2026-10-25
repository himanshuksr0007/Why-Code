import { Suspense } from "react";

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
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-xl font-semibold sm:text-2xl">
          Graph path
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Every claim should be traceable. This view walks a decision back
          through the graph — from the config key or symbol, to the commit and
          pull request, to the evidence that supports it.
        </p>
      </header>

      <Suspense fallback={<GraphSkeleton />}>
        <GraphContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
