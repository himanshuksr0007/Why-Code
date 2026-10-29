"use client";

import { useEffect, useState } from "react";
import {
  ChartColumnIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  WebhookIcon,
} from "lucide-react";

import { api } from "@/lib/api";
import type { AuditReport, WebhookEvents } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function AsideCard({
  icon: Icon,
  label,
  delay,
  children,
}: {
  icon: typeof ChartColumnIcon;
  label: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="animate-rise-in rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-neumorph"
      style={{ animationDelay: `${delay}ms` }}
      aria-label={label}
    >
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        <Icon className="size-3.5 text-primary" aria-hidden="true" />
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const STATUS_ORDER = [
  "active",
  "superseded",
  "reversed",
  "contested",
  "uncertain",
] as const;

/**
 * The decision center's right rail: a status breakdown of everything
 * on record, the audit's "needs attention" list, and the live-updates
 * feed — all from the same audit + webhook endpoints the summary
 * cards use, so the rail can never disagree with the page.
 */
export function DecisionsAside({ repo }: { repo: string }) {
  const [audit, setAudit] = useState<AuditReport | null>(null);
  const [hooks, setHooks] = useState<WebhookEvents | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getAudit(repo)
      .then((result) => {
        if (!cancelled) setAudit(result);
      })
      .catch(() => {
        if (!cancelled) setAudit(null);
      });
    api
      .listWebhookEvents()
      .then((result) => {
        if (!cancelled) setHooks(result);
      })
      .catch(() => {
        if (!cancelled) setHooks(null);
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  if (!audit) return null;

  const statusRows = STATUS_ORDER.filter(
    (status) => (audit.by_status[status] ?? 0) > 0,
  ).map((status) => ({
    status,
    count: audit.by_status[status] ?? 0,
    pct: audit.total > 0 ? Math.round(((audit.by_status[status] ?? 0) / audit.total) * 100) : 0,
  }));
  const kindRows = Object.entries(audit.by_kind).sort((a, b) => b[1] - a[1]);
  const flagged = audit.security_missing_rationale;
  const missingEvidence = audit.missing_evidence;

  return (
    <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Decision insights">
      {audit.total === 0 ? (
        <AsideCard icon={ChartColumnIcon} label="On record" delay={100}>
          <p className="text-sm leading-relaxed text-foreground">
            No decisions extracted for this repository yet.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Extraction reads the repository&rsquo;s pull requests, reviews
            and commits. Until it has run, this page stays empty — switch
            the repository above to one with decisions on record.
          </p>
        </AsideCard>
      ) : (
        <>
          <AsideCard icon={ChartColumnIcon} label="Status breakdown" delay={100}>
            <ul className="space-y-2.5">
              {statusRows.map((row, index) => (
                <li key={row.status}>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-medium text-foreground capitalize">
                      {row.status}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.count} · {row.pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-accent/60">
                    <div
                      className="animate-bar-grow h-full rounded-full bg-primary-gradient"
                      style={{
                        width: `${row.pct}%`,
                        animationDelay: `${150 + index * 90}ms`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {kindRows.length > 0 ? (
              <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                {kindRows.map(([kind, count]) => (
                  <span
                    key={kind}
                    className="rounded-full bg-accent/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize"
                  >
                    {kind} · {count}
                  </span>
                ))}
              </div>
            ) : null}
          </AsideCard>

          <AsideCard
            icon={flagged.length + missingEvidence.length > 0 ? ShieldAlertIcon : ShieldCheckIcon}
            label="Needs attention"
            delay={200}
          >
            {flagged.length === 0 && missingEvidence.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Nothing flagged — every security-relevant decision carries
                a rationale, and every record carries evidence.
              </p>
            ) : (
              <div className="space-y-3">
                {flagged.length > 0 ? (
                  <div>
                    <p className="text-[13px] font-medium text-amber-700 dark:text-amber-300">
                      Security-flagged, no rationale ({flagged.length})
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {flagged.slice(0, 6).map((id) => (
                        <span
                          key={id}
                          className="rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-300"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {missingEvidence.length > 0 ? (
                  <div>
                    <p className="text-[13px] font-medium text-foreground">
                      Missing evidence ({missingEvidence.length})
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {missingEvidence.slice(0, 6).map((id) => (
                        <span
                          key={id}
                          className="rounded-md bg-accent/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground/75"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </AsideCard>
        </>
      )}

      {hooks && hooks.events.length > 0 ? (
        <AsideCard icon={WebhookIcon} label="Live updates" delay={300}>
          <ul className="space-y-2.5">
            {hooks.events.slice(0, 4).map((event) => (
              <li key={event.delivery_id} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full bg-primary",
                    "animate-pulse",
                  )}
                />
                <div className="min-w-0 text-[13px] leading-snug">
                  <p className="font-medium text-foreground">
                    {event.event}
                    {event.action ? ` · ${event.action}` : ""}
                    {event.pr_number ? ` — PR #${event.pr_number}` : ""}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {event.title ?? event.repo ?? ""}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {event.received_at.slice(0, 16).replace("T", " ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {hooks.jobs.length > 0 ? (
            <p className="mt-3 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
              {hooks.jobs.length} incremental refresh job
              {hooks.jobs.length === 1 ? "" : "s"} recorded.
            </p>
          ) : null}
        </AsideCard>
      ) : null}
    </aside>
  );
}
