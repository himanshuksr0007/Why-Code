import { Suspense } from "react";
import { ScaleIcon, TerminalIcon } from "lucide-react";

import { DecisionsExplorer } from "@/components/decisions/decisions-explorer";
import { PageHeader } from "@/components/explorer/page-header";
import { RepoSwitcher } from "@/components/explorer/repo-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveRepo } from "@/lib/active-repo";
import { getHealth, listDecisions } from "@/lib/ledger/client";

export const metadata = { title: "Decisions" };

function DecisionsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[88px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-36 w-full rounded-2xl" />
      ))}
    </div>
  );
}

function NotIndexed({ repo, reason }: { repo: string; reason: string }) {
  return (
    <div className="animate-rise-in mx-auto max-w-xl rounded-[1.5rem] border border-dashed border-border/70 bg-card/60 p-8 text-center shadow-neumorph">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
        <ScaleIcon className="size-6 text-primary" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">
        <span className="font-mono">{repo}</span> has no decision ledger yet
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
        {reason} Index a checkout on the server to mine its ADRs, WHY: comments
        and commit history — no model or API key needed:
      </p>
      <pre className="mt-4 flex items-center gap-2 overflow-x-auto rounded-xl bg-[var(--code-block)] px-4 py-3 text-left font-mono text-xs text-[var(--code-block-foreground)]">
        <TerminalIcon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
        <code>
          python -m app.ledger index /path/to/checkout --repo {repo}
        </code>
      </pre>
    </div>
  );
}

async function DecisionsContent() {
  const repo = await getActiveRepo();
  let health;
  let decisions;
  try {
    [health, decisions] = await Promise.all([getHealth(repo), listDecisions(repo)]);
  } catch {
    return (
      <NotIndexed
        repo={repo}
        reason="The decision service could not be reached, so nothing is shown rather than a guess."
      />
    );
  }
  if (health.mode === "not_indexed" || decisions.length === 0) {
    return (
      <NotIndexed
        repo={repo}
        reason="Decisions are only shown when they were mined from the repository or recorded by someone."
      />
    );
  }
  return <DecisionsExplorer repo={repo} health={health} decisions={decisions} />;
}

export default function DecisionsPage() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        icon={ScaleIcon}
        title="Decisions"
        subtitle="The repository's decision ledger: each choice with the files it governs, verbatim evidence checked against the code, whether it still holds, and the append-only record of who put it in force."
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
