"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, ExternalLinkIcon, GitMergeIcon } from "lucide-react";

import { ParticipationRoleBadge } from "@/components/badges";
import {
  initialsAvatarDataUrl,
} from "@/components/people/person-avatar";
import { PersonChip } from "@/components/people/person-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SharedTooltipAvatars } from "@/components/ui/shared-tooltip-avatars";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { PullRequestDetail } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { CHANGE_KIND } from "@/lib/labels";
import { useLocalProfile } from "@/lib/local/profile";

type PanelState = "idle" | "loading" | "ready" | "error";

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
        {count !== undefined ? (
          <span className="ml-1.5 font-mono text-[11px] normal-case">
            {count}
          </span>
        ) : null}
      </h3>
      {children}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function PullRequestSheet({
  number,
  onOpenChange,
}: {
  number: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile } = useLocalProfile();
  const repo = profile.default_repo;
  const [result, setResult] = useState<{
    number: number;
    detail: PullRequestDetail;
  } | null>(null);
  const [failedNumber, setFailedNumber] = useState<number | null>(null);

  useEffect(() => {
    if (number === null) return;
    let cancelled = false;
    api
      .getPullRequest(repo, number)
      .then((detail) => {
        if (cancelled) return;
        setResult({ number, detail });
        setFailedNumber(null);
      })
      .catch(() => {
        if (cancelled) return;
        setFailedNumber(number);
      });
    return () => {
      cancelled = true;
    };
  }, [number, repo]);

  // Derived, never set synchronously in the effect.
  const detail = result && result.number === number ? result.detail : null;
  const state: PanelState =
    number === null
      ? "idle"
      : failedNumber === number
        ? "error"
        : detail
          ? "ready"
          : "loading";

  return (
    <Sheet open={number !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="gap-1 pr-10">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              #{number}
            </span>
            {detail?.title ?? "Pull request"}
          </SheetTitle>
          <SheetDescription>
            The change that carried this code, and everyone involved.
          </SheetDescription>
        </SheetHeader>
        <Separator />

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {state === "loading" ? <DetailSkeleton /> : null}

          {state === "error" ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">
                Could not load pull request #{number}
              </p>
              <p className="mt-1 text-muted-foreground">
                It may not be present in the graph, or the service is
                unreachable.
              </p>
            </div>
          ) : null}

          {state === "ready" && detail ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge
                  variant="outline"
                  className="gap-1 border-primary/40 bg-primary/15 text-primary"
                >
                  <GitMergeIcon aria-hidden="true" />
                  {detail.state}
                </Badge>
                {detail.merged_at ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <CalendarIcon className="size-3.5" aria-hidden="true" />
                    {formatDate(detail.merged_at)}
                  </span>
                ) : null}
                {detail.author ? (
                  <PersonChip person={detail.author} className="ml-auto" />
                ) : null}
              </div>

              {detail.body ? (
                <p className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm leading-relaxed">
                  {detail.body}
                </p>
              ) : null}

              {detail.reviewers.length > 0 ? (
                <Section title="Reviewed by" count={detail.reviewers.length}>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.reviewers.map((reviewer) => (
                      <PersonChip key={reviewer.login} person={reviewer} />
                    ))}
                  </div>
                </Section>
              ) : null}

              {detail.participants.length > 0 ? (
                <Section
                  title="Participants"
                  count={detail.participants.length}
                >
                  <div className="rounded-lg border border-border/70 bg-muted/10 px-3 pt-1 pb-2">
                    <SharedTooltipAvatars
                      role="list"
                      aria-label="People who participated in this pull request"
                      className="justify-start py-2"
                      items={detail.participants.map((member) => ({
                        id: member.login,
                        name: `${member.name ?? member.login} (@${member.login})`,
                        image: initialsAvatarDataUrl(member.login),
                      }))}
                    />
                  </div>
                  <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
                    {detail.participants.map((member) => (
                      <li
                        key={member.login}
                        className="flex flex-wrap items-center gap-2 px-3 py-2"
                      >
                        <PersonChip person={member} />
                        <span className="flex flex-wrap gap-1">
                          {member.roles.map((role) => (
                            <ParticipationRoleBadge key={role} role={role} />
                          ))}
                        </span>
                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                          {member.contributions} contribution
                          {member.contributions === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {detail.commits.length > 0 ? (
                <Section title="Commits" count={detail.commits.length}>
                  <ul className="space-y-2">
                    {detail.commits.map((commit) => (
                      <li
                        key={commit.sha}
                        className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
                      >
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {commit.sha.slice(0, 7)}
                        </span>
                        <span className="min-w-0 flex-1 text-sm">
                          {commit.message}
                        </span>
                        {commit.author ? (
                          <PersonChip person={commit.author} linked={false} />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {detail.changed_files.length > 0 ? (
                <Section
                  title="Changed files"
                  count={detail.changed_files.length}
                >
                  <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
                    {detail.changed_files.map((file) => (
                      <li
                        key={file.path}
                        className="flex items-center gap-2 px-3 py-2"
                      >
                        <span
                          className="font-mono text-xs"
                          title={CHANGE_KIND[file.change_kind].label}
                        >
                          {file.path}
                        </span>
                        <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[11px]">
                          <span className="text-primary">
                            +{file.additions}
                          </span>
                          <span className="text-destructive">
                            −{file.deletions}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {detail.url ? (
                <Button
                  render={<a href={detail.url} target="_blank" rel="noreferrer" />}
                  nativeButton={false}
                  variant="outline"
                  className="w-full"
                >
                  <ExternalLinkIcon aria-hidden="true" />
                  Open pull request on GitHub
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
