import { Suspense } from "react";
import { GitCommitHorizontalIcon } from "lucide-react";

import { ChangesAside } from "@/components/changes/changes-aside";
import { CodeChangeCard } from "@/components/changes/code-change-card";
import { PageHeader } from "@/components/explorer/page-header";
import { RepoSwitcher } from "@/components/explorer/repo-switcher";
import { RepoNotIndexed } from "@/components/repo/not-indexed";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveRepo } from "@/lib/active-repo";
import { api, findRepo } from "@/lib/api";

export const metadata = { title: "Code changes" };

function ChangesSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="rounded-xl border border-border/70 bg-card p-4"
        >
          <Skeleton className="h-5 w-64" />
          <Skeleton className="mt-4 h-20 w-full" />
          <Skeleton className="mt-4 h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

async function ChangesContent() {
  const repo = await getActiveRepo();
  if (!findRepo(repo)?.indexed) return <RepoNotIndexed repo={repo} />;
  const changes = await api.listChanges(repo);
  if (changes.length === 0) {
    return (
      <div className="animate-rise-in mx-auto max-w-xl rounded-[1.5rem] border border-dashed border-border/70 bg-card/60 p-8 text-center shadow-neumorph">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <GitCommitHorizontalIcon
            className="size-6 text-primary"
            aria-hidden="true"
          />
        </div>
        <p className="text-sm font-medium text-foreground">
          No code changes found for this repository
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          The feed reads the repository&rsquo;s recent commits. Either
          nothing has landed yet, or the service could not reach the
          repository — switch the repository above to check another one.
        </p>
      </div>
    );
  }
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {changes.map((change, index) => (
          <div
            key={change.change_id}
            className="animate-rise-in"
            style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
          >
            <CodeChangeCard change={change} />
          </div>
        ))}
      </div>
      <ChangesAside changes={changes} />
    </div>
  );
}

export default function ChangesPage() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        icon={GitCommitHorizontalIcon}
        title="Code changes"
        subtitle="Each change is shown with the reasoning behind it and the pull request that carried it — including who wrote it, who reviewed it, and who took part. The question “why is this line like this?” should be answerable from one card."
      >
        <RepoSwitcher />
      </PageHeader>

      <div className="mt-8">
        <Suspense fallback={<ChangesSkeleton />}>
          <ChangesContent />
        </Suspense>
      </div>
    </div>
  );
}
