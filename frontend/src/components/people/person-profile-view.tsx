"use client";

import Link from "next/link";
import { ExternalLinkIcon, GitPullRequestIcon } from "lucide-react";

import { CodeChangeCard } from "@/components/changes/code-change-card";
import { ParticipationRoleBadge } from "@/components/badges";
import { PersonAvatar } from "@/components/people/person-avatar";
import { PersonAvatarStack, PersonChip } from "@/components/people/person-chip";
import { usePullRequestPanel } from "@/components/pull-request/pull-request-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ParticipationRole,
  PersonProfile,
  PullRequestRef,
} from "@/lib/api/types";
import { formatDate } from "@/lib/format";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="font-heading text-lg font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function PullRequestRow({
  pull,
  roles,
}: {
  pull: PullRequestRef;
  roles?: ParticipationRole[];
}) {
  const { openPullRequest } = usePullRequestPanel();
  return (
    <li className="rounded-xl border border-border/70 bg-card px-4 py-3">
      <button
        type="button"
        onClick={() => openPullRequest(pull.number)}
        className="flex w-full items-center gap-2 text-left"
      >
        <GitPullRequestIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="font-mono text-xs text-muted-foreground">
          #{pull.number}
        </span>
        <span className="min-w-0 truncate text-sm font-medium hover:underline">
          {pull.title}
        </span>
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {roles && roles.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {roles.map((role) => (
              <ParticipationRoleBadge key={role} role={role} />
            ))}
          </span>
        ) : null}
        {pull.author ? <PersonChip person={pull.author} /> : null}
        {pull.reviewers.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <PersonAvatarStack people={pull.reviewers} />
            <span className="sr-only">Reviewers</span>
          </span>
        ) : null}
        <span className="ml-auto">merged {formatDate(pull.merged_at)}</span>
      </div>
    </li>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * A person's page: who they are, how much they contributed, and every change
 * they made with the reasoning attached to it.
 */
export function PersonProfileView({ profile }: { profile: PersonProfile }) {
  const rolesFor = (pull: PullRequestRef): ParticipationRole[] =>
    pull.participants.find((member) => member.login === profile.login)?.roles ??
    [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5 sm:flex-row sm:items-start">
        <PersonAvatar login={profile.login} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-lg font-semibold">
              {profile.name || profile.login}
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              @{profile.login}
            </span>
            {profile.role_tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Active {formatDate(profile.first_seen)} –{" "}
            {formatDate(profile.last_seen)}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="PRs" value={profile.authored_pull_requests} />
            <Stat label="Reviews" value={profile.reviews} />
            <Stat label="Comments" value={profile.comments} />
            <Stat label="Commits" value={profile.commits} />
            <Stat label="Decisions" value={profile.decisions} />
          </dl>
        </div>

        {profile.url ? (
          <Button
            render={<a href={profile.url} target="_blank" rel="noreferrer" />}
            nativeButton={false}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            <ExternalLinkIcon aria-hidden="true" />
            GitHub profile
          </Button>
        ) : null}
      </section>

      <Tabs defaultValue="changes">
        <TabsList variant="line">
          <TabsTrigger value="changes">
            Code changes
            <span className="ml-1 font-mono text-[11px] text-muted-foreground">
              {profile.changes.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="authored">
            Authored PRs
            <span className="ml-1 font-mono text-[11px] text-muted-foreground">
              {profile.authored.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="reviewed">
            Reviews
            <span className="ml-1 font-mono text-[11px] text-muted-foreground">
              {profile.reviewed.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="participated">
            Participated
            <span className="ml-1 font-mono text-[11px] text-muted-foreground">
              {profile.participated.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="changes" className="pt-4">
          {profile.changes.length > 0 ? (
            <div className="space-y-3">
              {profile.changes.map((change) => (
                <CodeChangeCard key={change.change_id} change={change} />
              ))}
            </div>
          ) : (
            <EmptyNote>
              No code changes were attributed to this person.
            </EmptyNote>
          )}
        </TabsContent>

        <TabsContent value="authored" className="pt-4">
          {profile.authored.length > 0 ? (
            <ul className="space-y-2">
              {profile.authored.map((pull) => (
                <PullRequestRow key={pull.number} pull={pull} />
              ))}
            </ul>
          ) : (
            <EmptyNote>No authored pull requests recorded.</EmptyNote>
          )}
        </TabsContent>

        <TabsContent value="reviewed" className="pt-4">
          {profile.reviewed.length > 0 ? (
            <ul className="space-y-2">
              {profile.reviewed.map((pull) => (
                <PullRequestRow key={pull.number} pull={pull} />
              ))}
            </ul>
          ) : (
            <EmptyNote>No reviews recorded.</EmptyNote>
          )}
        </TabsContent>

        <TabsContent value="participated" className="pt-4">
          {profile.participated.length > 0 ? (
            <ul className="space-y-2">
              {profile.participated.map((pull) => (
                <PullRequestRow
                  key={pull.number}
                  pull={pull}
                  roles={rolesFor(pull)}
                />
              ))}
            </ul>
          ) : (
            <EmptyNote>No participation recorded.</EmptyNote>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Looking for someone else?{" "}
        <Link href="/people" className="underline hover:text-foreground">
          Back to all contributors
        </Link>
      </p>
    </div>
  );
}
