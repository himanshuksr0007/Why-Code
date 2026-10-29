"use client";

import Link from "next/link";
import {
  GitCommitHorizontalIcon,
  GitPullRequestIcon,
  RouteIcon,
} from "lucide-react";

import {
  ChangeKindBadge,
  ConfidenceBadge,
  DecisionStatusBadge,
} from "@/components/badges";
import { GithubMark } from "@/components/icons/github-mark";
import { PersonAvatarStack, PersonChip } from "@/components/people/person-chip";
import { Button } from "@/components/ui/button";
import { useEvidencePanel } from "@/components/evidence/evidence-provider";
import { usePullRequestPanel } from "@/components/pull-request/pull-request-provider";
import type { CodeChange } from "@/lib/api/types";
import { formatDate, truncate } from "@/lib/format";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function CodeBlock({
  variant,
  code,
}: {
  variant: "before" | "after";
  code: string;
}) {
  const isBefore = variant === "before";
  return (
    <div
      className={
        isBefore
          ? "overflow-hidden rounded-lg border border-destructive/30 bg-destructive/5"
          : "overflow-hidden rounded-lg border border-primary/30 bg-primary/5"
      }
    >
      <p
        className={
          isBefore
            ? "border-b border-destructive/20 px-3 py-1 font-mono text-[10px] tracking-wide text-destructive uppercase"
            : "border-b border-primary/20 px-3 py-1 font-mono text-[10px] tracking-wide text-primary uppercase"
        }
      >
        {isBefore ? "− before" : "+ after"}
      </p>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * What changed, why it changed, and who was involved.
 *
 * The "why" is the extracted decision; the "who" is the pull request together
 * with its author, reviewers and participants. One card carries the whole
 * story behind a line of code so a reader never has to piece it together.
 */
export function CodeChangeCard({
  change,
  showCode = true,
}: {
  change: CodeChange;
  showCode?: boolean;
}) {
  const { openEvidence } = useEvidencePanel();
  const { openPullRequest } = usePullRequestPanel();
  const { decision, pr } = change;

  const evidenceIds = Array.from(
    new Set([...(decision?.evidence_ids ?? []), ...change.evidence_ids]),
  );
  const reviewers = pr.reviewers;
  const participants = pr.participants;

  // A PR number of 0 means the commit landed directly — there is no
  // pull request to open, and the card must not offer one.
  const hasPr = pr.number > 0;
  const commitUrl =
    change.commit_url ??
    (() => {
      const commitEvidence = change.evidence_ids.find((id) =>
        id.includes(":commit:"),
      );
      const sha = commitEvidence?.split(":")[2];
      if (!sha) return hasPr ? null : pr.url;
      // Live evidence ids carry the full slug ("owner/repo:commit:…");
      // fixture ids carry just the repo name, so fall back to the
      // owner/repo embedded in the pull request URL.
      const evidenceRepo = commitEvidence.split(":")[0];
      const repoSlug = evidenceRepo.includes("/")
        ? evidenceRepo
        : (pr.url ?? "").match(/github\.com\/([^/]+\/[^/]+)\//)?.[1];
      return repoSlug
        ? `https://github.com/${repoSlug}/commit/${sha}`
        : null;
    })();
  const hasStats = change.additions > 0 || change.deletions > 0;

  return (
    <article className="rounded-xl border border-border/70 bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
        <ChangeKindBadge kind={change.change_kind} />
        <span className="min-w-0 font-mono text-xs break-all">
          {change.path}
          {change.start_line
            ? `:${change.start_line}${change.end_line ? `-${change.end_line}` : ""}`
            : ""}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          {hasStats ? (
            <span className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-primary">+{change.additions}</span>
              <span className="text-destructive">−{change.deletions}</span>
            </span>
          ) : change.files_changed ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              {change.files_changed} file
              {change.files_changed === 1 ? "" : "s"}
            </span>
          ) : null}
          {commitUrl ? (
            <a
              href={commitUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#171009] px-2.5 py-1.5 text-xs font-medium text-white shadow-neumorph transition-transform outline-none hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="View this commit on GitHub"
              title="View this commit on GitHub"
            >
              <GithubMark className="size-4" />
              GitHub
            </a>
          ) : null}
        </span>
      </header>

      <div className="space-y-3 px-4 py-3">
        {change.symbol ? (
          <p className="font-mono text-[11px] text-muted-foreground">
            {change.symbol}
          </p>
        ) : null}

        {showCode && (change.code_before || change.code_after) ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {change.code_before ? (
              <CodeBlock variant="before" code={change.code_before} />
            ) : null}
            {change.code_after ? (
              <CodeBlock variant="after" code={change.code_after} />
            ) : null}
          </div>
        ) : null}

        <section className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Why
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">{change.reasoning}</p>

          {decision ? (
            <>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <DecisionStatusBadge status={decision.status} />
                <ConfidenceBadge confidence={decision.confidence} />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {decision.decision_id}
                </span>
                <Button
                  render={<Link href={`/graph?decision=${decision.decision_id}`} />}
                  nativeButton={false}
                  variant="ghost"
                  size="xs"
                  className="ml-auto"
                >
                  <RouteIcon aria-hidden="true" />
                  Graph path
                </Button>
              </div>

              {evidenceIds.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                    Evidence
                  </span>
                  {evidenceIds.map((evidenceId, idx) => (
                    <button
                      key={`${evidenceId}-${idx}`}
                      type="button"
                      onClick={() => openEvidence(evidenceId)}
                      className="rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {evidenceId}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No decision was extracted for this change.
            </p>
          )}
        </section>

        <section className="border-t border-border/70 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {hasPr ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPullRequest(pr.number)}
                >
                  <GitPullRequestIcon aria-hidden="true" />
                  <span className="font-mono">#{pr.number}</span>
                  <span className="hidden max-w-56 truncate font-normal text-muted-foreground sm:inline">
                    {truncate(pr.title, 48)}
                  </span>
                </Button>
                {pr.merged_at ? (
                  <span className="text-xs text-muted-foreground">
                    merged {formatDate(pr.merged_at)}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitCommitHorizontalIcon
                  className="size-4"
                  aria-hidden="true"
                />
                Direct commit — no pull request carried this change
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Author">
              {change.author ? (
                <PersonChip person={change.author} />
              ) : (
                <span className="text-xs text-muted-foreground">Unknown</span>
              )}
            </Field>

            {hasPr ? (
              <>
                <Field label={`Reviewed by (${reviewers.length})`}>
                  {reviewers.length > 0 ? (
                    reviewers.map((reviewer, idx) => (
                      <PersonChip key={`${reviewer.login}-${idx}`} person={reviewer} />
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No reviewers recorded
                    </span>
                  )}
                </Field>

                <Field label={`Participants (${participants.length})`}>
                  {participants.length > 0 ? (
                    <>
                      <PersonAvatarStack people={participants} />
                      <span className="text-xs text-muted-foreground">
                        {participants.length} in this pull request
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No participants recorded
                    </span>
                  )}
                </Field>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </article>
  );
}
