import { Suspense } from "react";

import { CodeChangeCard } from "@/components/changes/code-change-card";
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
  return (
    <div className="space-y-4">
      {changes.map((change) => (
        <CodeChangeCard key={change.change_id} change={change} />
      ))}
    </div>
  );
}

export default function ChangesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-xl font-semibold sm:text-2xl">
          Code changes
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Each change is shown with the reasoning behind it and the pull request
          that carried it — including who wrote it, who reviewed it, and who
          took part. The question &ldquo;why is this line like this?&rdquo;
          should be answerable from one card.
        </p>
      </header>

      <Suspense fallback={<ChangesSkeleton />}>
        <ChangesContent />
      </Suspense>
    </div>
  );
}
