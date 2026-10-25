import { Suspense } from "react";

import { PersonList } from "@/components/people/person-list";
import { RepoNotIndexed } from "@/components/repo/not-indexed";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveRepo } from "@/lib/active-repo";
import { api, findRepo } from "@/lib/api";

export const metadata = { title: "People" };

function PeopleSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="rounded-xl border border-border/70 bg-card p-4"
        >
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="mt-3 h-4 w-40" />
          <Skeleton className="mt-2 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

async function PeopleContent() {
  const repo = await getActiveRepo();
  if (!findRepo(repo)?.indexed) return <RepoNotIndexed repo={repo} />;
  const people = await api.listPeople(repo);
  return <PersonList people={people} />;
}

export default function PeoplePage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-xl font-semibold sm:text-2xl">
          People
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The contributors behind the code: who authored changes, who reviewed
          them, and how much of the decision making they account for.
        </p>
      </header>

      <Suspense fallback={<PeopleSkeleton />}>
        <PeopleContent />
      </Suspense>
    </div>
  );
}
