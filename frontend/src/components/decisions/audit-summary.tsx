"use client";

import { useEffect, useState } from "react";
import {
  FileTextIcon,
  HistoryIcon,
  ScrollTextIcon,
  ShieldAlertIcon,
  WebhookIcon,
} from "lucide-react";

import { CountUp } from "@/components/explorer/count-up";
import { api } from "@/lib/api";
import type { AuditReport, WebhookEvents } from "@/lib/api/types";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  delay,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: typeof ScrollTextIcon;
  delay: number;
}) {
  return (
    <div
      className="animate-rise-in rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-neumorph"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        <Icon className="size-3.5 text-primary" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * Compliance snapshot for the repository (from /api/v1/audit) plus the
 * latest GitHub webhook deliveries that keep the data fresh.
 */
export function AuditSummary({ repo }: { repo: string }) {
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

  return (
    <section aria-label="Audit summary" className="mb-10">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard
          label="Decisions on record"
          icon={ScrollTextIcon}
          delay={0}
          value={<CountUp value={audit.total} />}
          hint={`${audit.with_evidence_pct}% carry evidence`}
        />
        <StatCard
          label="With rationale"
          icon={FileTextIcon}
          delay={70}
          value={<CountUp value={audit.with_rationale_pct} suffix="%" />}
          hint="claims backed by a written why"
        />
        <StatCard
          label="Superseded / reversed"
          icon={HistoryIcon}
          delay={140}
          value={<CountUp value={audit.superseded} />}
          hint="kept on record, never overwritten"
        />
        <StatCard
          label="Security-flagged"
          icon={ShieldAlertIcon}
          delay={210}
          value={<CountUp value={audit.security_flagged} />}
          hint={
            audit.security_missing_rationale.length > 0
              ? `${audit.security_missing_rationale.length} missing a rationale`
              : "all carry a rationale"
          }
        />
      </div>

      {audit.security_missing_rationale.length > 0 ? (
        <p className="mt-3.5 flex items-start gap-2 rounded-[1.25rem] border border-amber-500/30 bg-amber-500/10 p-3.5 text-[13px] leading-relaxed text-amber-700 dark:text-amber-300">
          <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Audit: security-relevant decisions without a rationale —{" "}
            <span className="font-mono text-xs">
              {audit.security_missing_rationale.join(", ")}
            </span>
            . Compliance reports flag these until the why is recorded.
          </span>
        </p>
      ) : null}

      {hooks && hooks.events.length > 0 ? (
        <div className="mt-3.5 rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-neumorph">
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            <WebhookIcon className="size-3.5 text-primary" aria-hidden="true" />
            Live updates — recent webhook deliveries
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {hooks.events.slice(0, 5).map((event) => (
              <li key={event.delivery_id} className="text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">
                  {event.event}
                  {event.action ? ` · ${event.action}` : ""}
                </span>{" "}
                {event.repo ?? ""}
                {event.pr_number ? ` — PR #${event.pr_number}` : ""}
                {event.title ? ` “${event.title}”` : ""}{" "}
                <span className="font-mono text-[11px]">
                  {event.received_at.slice(0, 16).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
          {hooks.jobs.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {hooks.jobs.length} incremental refresh job
              {hooks.jobs.length === 1 ? "" : "s"} recorded — merged PRs
              invalidate the cached decisions so the next read is fresh.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
