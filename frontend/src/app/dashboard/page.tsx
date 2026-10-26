import { Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  FileCode2Icon,
  GitPullRequestIcon,
  ScaleIcon,
  UsersIcon,
} from "lucide-react";

import { PersonAvatar } from "@/components/people/person-avatar";
import { RepoNotIndexed } from "@/components/repo/not-indexed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveRepo } from "@/lib/active-repo";
import { api, findRepo } from "@/lib/api";
import { DECISION_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { exampleQuestionsFor } from "@/lib/mock";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof ScaleIcon;
  value: number | string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <Icon
        className="size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="mt-3 font-heading text-2xl font-semibold tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {linkLabel ?? "View all"}
            <ArrowRightIcon className="size-3" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

async function DashboardContent() {
  const repo = await getActiveRepo();
  const meta = findRepo(repo);

  if (!meta?.indexed) {
    return <RepoNotIndexed repo={repo} />;
  }

  // Wrap API calls with error handling for 404s
  const [threads, changes, people] = await Promise.all([
    api.listDecisions(repo).catch(() => []),
    api.listChanges(repo).catch(() => []),
    api.listPeople(repo).catch(() => []),
  ]);

  const decisions = threads.flatMap((thread) =>
    thread.steps.map((step) => step.decision),
  );
  const activeDecisions = decisions.filter(
    (decision) => decision.status === "active",
  ).length;
  const pullRequests = new Set(changes.map((change) => change.pr.number)).size;

  const recentDecisions = [...decisions]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 5);
  const recentChanges = changes.slice(0, 5);
  const questions = exampleQuestionsFor(repo).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/70 bg-card p-5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-medium tracking-wide text-primary uppercase">
            {repo}
          </p>
          <h2 className="mt-1 font-heading text-lg font-semibold">
            {meta?.name ?? repo} decision index
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {meta?.description}. Ask why the code works this way, or jump
            straight into the evidence below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/" />} nativeButton={false}>
            Ask a question
            <ArrowRightIcon aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            render={<Link href="/decisions" />}
            nativeButton={false}
          >
            Decision timeline
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={ScaleIcon}
          value={activeDecisions}
          label={`Active decision${activeDecisions === 1 ? "" : "s"}`}
        />
        <Stat
          icon={FileCode2Icon}
          value={changes.length}
          label={`Code change${changes.length === 1 ? "" : "s"}`}
        />
        <Stat
          icon={UsersIcon}
          value={people.length}
          label={`Contributor${people.length === 1 ? "" : "s"}`}
        />
        <Stat
          icon={GitPullRequestIcon}
          value={pullRequests}
          label={`Pull request${pullRequests === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Recent decisions"
          href="/decisions"
          linkLabel="Decision timeline"
        >
          <ul className="space-y-3">
            {recentDecisions.map((decision) => {
              const tone = DECISION_STATUS[decision.status];
              return (
                <li key={decision.decision_id}>
                  <Link
                    href={`/graph?decision=${encodeURIComponent(decision.decision_id)}`}
                    className="block rounded-lg border border-transparent p-2 -mx-2 transition-colors hover:border-border/70 hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("gap-1", tone.className)}
                      >
                        {tone.label}
                      </Badge>
                      {decision.created_at ? (
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(decision.created_at)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-sm font-medium">
                      {decision.title ?? decision.claim}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {decision.claim}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Recent code changes" href="/changes">
          <ul className="space-y-3">
            {recentChanges.map((change) => (
              <li key={change.change_id} className="flex gap-3">
                <FileCode2Icon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{change.path}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {change.reasoning}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    <span className="font-mono">#{change.pr.number}</span>
                    {change.author ? ` · ${change.author.name ?? change.author.login}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Contributors" href="/people">
        <ul className="flex flex-wrap gap-x-6 gap-y-4">
          {people.slice(0, 6).map((person) => (
            <li key={person.login}>
              <Link
                href={`/people/${person.login}`}
                className="flex items-center gap-2.5 rounded-lg p-1 -m-1 transition-colors hover:bg-muted/50"
              >
                <PersonAvatar login={person.login} />
                <span className="leading-tight">
                  <span className="block text-sm font-medium">
                    {person.name ?? person.login}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {person.role_tags.join(" · ")} · {person.decisions} decision
                    {person.decisions === 1 ? "" : "s"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Try asking">
        <ul className="grid gap-2 sm:grid-cols-2">
          {questions.map((question) => (
            <li key={question}>
              <Link
                href={`/?q=${encodeURIComponent(question)}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="min-w-0 text-balance">{question}</span>
                <ArrowRightIcon
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="text-xs text-muted-foreground">
        Showing the sample index for{" "}
        <span className="font-mono">{repo}</span>
        {meta ? ` (${meta.description.toLowerCase()})` : ""}.
      </p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-xl font-semibold sm:text-2xl">
          Dashboard
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          An overview of the repository in context: the decisions that shape it,
          the changes that carried them, and the people behind both.
        </p>
      </header>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
