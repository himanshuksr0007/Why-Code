"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRightIcon,
  FileCode2Icon,
  GitCommitHorizontalIcon,
  GitPullRequestIcon,
  ScrollTextIcon,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { evidenceHref, getDecision } from "@/lib/ledger/client";
import type { LedgerDecision, LedgerEvidence } from "@/lib/ledger/types";

import {
  CurrencyBadge,
  CURRENCY_META,
  PinnedMark,
  SOURCE_LABEL,
  VerificationMark,
} from "./decision-badges";

const ACTION_LABEL: Record<string, string> = {
  record: "Recorded",
  accept: "Put in force",
  reaffirm: "Reaffirmed",
  pin: "Pinned",
  unpin: "Unpinned",
  dismiss: "Dismissed",
  supersede: "Superseded",
  merge: "Came into force on merge",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function EvidenceRow({ repo, row }: { repo: string; row: LedgerEvidence }) {
  const href = evidenceHref(repo, row);
  const Icon = row.commit_sha
    ? GitCommitHorizontalIcon
    : row.pr_number
      ? GitPullRequestIcon
      : FileCode2Icon;
  const where = row.path
    ? `${row.path}${row.start_line ? `:${row.start_line}` : ""}`
    : row.commit_sha
      ? row.commit_sha.slice(0, 12)
      : row.pr_number
        ? `PR #${row.pr_number}`
        : row.kind;
  return (
    <li className="rounded-xl border border-border/70 bg-background/60 p-3">
      <blockquote className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
        {row.quote}
      </blockquote>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <VerificationMark level={row.verification} />
        <span className="inline-flex min-w-0 items-center gap-1 font-mono">
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{where}</span>
        </span>
        {row.author ? <span>{row.author}</span> : null}
        {row.created_at ? <span>{formatDate(row.created_at)}</span> : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
          >
            Open
            <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The full record for one decision: what was decided and why, the files
 * it governs, each evidence quote with its verification, and the
 * append-only log of who put it in force.
 */
export function DecisionDetailSheet({
  repo,
  decisionId,
  fallback,
  onOpenChange,
}: {
  repo: string;
  decisionId: string | null;
  fallback: LedgerDecision | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const [loaded, setLoaded] = useState<{ id: string; data: LedgerDecision } | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  useEffect(() => {
    if (!decisionId) return;
    let cancelled = false;
    getDecision(decisionId)
      .then((data) => {
        if (!cancelled) setLoaded({ id: decisionId, data });
      })
      .catch(() => {
        if (!cancelled) setFailedId(decisionId);
      });
    return () => {
      cancelled = true;
    };
  }, [decisionId]);

  const detail = loaded?.id === decisionId ? loaded.data : fallback;
  const log = loaded?.id === decisionId ? loaded.data.authority_log : undefined;

  return (
    <Sheet open={decisionId !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl"
      >
        {detail ? (
          <>
            <SheetHeader className="gap-3 border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <CurrencyBadge currency={detail.currency} />
                {detail.pinned ? <PinnedMark /> : null}
                <span className="text-xs text-muted-foreground">
                  {SOURCE_LABEL[detail.source] ?? detail.source}
                </span>
              </div>
              <SheetTitle className="text-lg leading-snug">{detail.title}</SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {detail.decision_id}
                {detail.changed_fraction !== null && detail.in_force
                  ? ` · ${Math.round(detail.changed_fraction * 100)}% of its files changed since settled`
                  : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-8">
              <p className="rounded-xl bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                {CURRENCY_META[detail.currency]?.hint}
                {detail.currency === "background"
                  ? ". Treat it as a lead, not a rule, until someone accepts it."
                  : "."}
              </p>

              <Section title="Decision">
                <p className="text-sm leading-relaxed text-foreground">{detail.decision}</p>
              </Section>

              {detail.rationale ? (
                <Section title="Why">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    {detail.rationale}
                  </p>
                </Section>
              ) : null}

              {detail.context ? (
                <Section title="Context">
                  <p className="text-sm leading-relaxed text-foreground">{detail.context}</p>
                </Section>
              ) : null}

              {detail.alternatives.length > 0 ? (
                <Section title="Alternatives rejected">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                    {detail.alternatives.map((alt) => (
                      <li key={alt}>{alt}</li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {detail.consequences.length > 0 ? (
                <Section title="Consequences accepted">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                    {detail.consequences.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              <Section title={`Governs (${detail.scope.length})`}>
                {detail.scope.length ? (
                  <ul className="space-y-1">
                    {detail.scope.map((path) => (
                      <li
                        key={path}
                        className="flex items-center gap-1.5 font-mono text-xs text-foreground"
                      >
                        <FileCode2Icon
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="truncate">{path}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No files named, so it cannot be checked against the code.
                  </p>
                )}
              </Section>

              <Section
                title={`Evidence (${detail.verification.verified}/${detail.verification.total} verified)`}
              >
                <ul className="space-y-2">
                  {detail.evidence.map((row) => (
                    <EvidenceRow key={row.evidence_id} repo={repo} row={row} />
                  ))}
                </ul>
              </Section>

              <Section title="Authority log">
                {log ? (
                  <ol className="relative space-y-4 border-l border-border pl-5">
                    {log.map((event) => (
                      <li key={`${event.seq}-${event.action}`} className="relative">
                        <span
                          className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-card bg-primary"
                          aria-hidden="true"
                        />
                        <p className="text-sm font-medium text-foreground">
                          {ACTION_LABEL[event.action] ?? event.action}
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            by {event.signer}
                            <span className="ml-1 rounded bg-muted px-1.5 py-px text-[10.5px] tracking-wide uppercase">
                              {event.signer_kind}
                            </span>
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(event.at)} · {event.reason}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : failedId === decisionId ? (
                  <p className="text-sm text-muted-foreground">
                    The authority log could not be loaded.
                  </p>
                ) : (
                  <div className="space-y-2" aria-busy="true">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                )}
                <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <ScrollTextIcon className="size-3.5" aria-hidden="true" />
                  Append-only: the database rejects edits and deletions.
                </p>
              </Section>
            </div>
          </>
        ) : (
          <div className="space-y-3 p-6" aria-busy="true">
            <SheetTitle className="sr-only">Loading decision</SheetTitle>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
