"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  DownloadIcon,
  SearchIcon,
} from "lucide-react";

import { ConfidenceBadge, DecisionStatusBadge } from "@/components/badges";
import { api } from "@/lib/api";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import type {
  Confidence,
  DecisionRecord,
  DecisionStatus,
  SupersessionPair,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  "all",
  "active",
  "superseded",
  "reversed",
  "contested",
  "uncertain",
] as const;

function RecordCard({
  record,
  expanded,
  onToggle,
}: {
  record: DecisionRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  const evidenceCount = Math.max(
    record.evidence.length,
    record.evidence_ids.length,
  );
  return (
    <article className="rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-neumorph sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <DecisionStatusBadge status={record.status as DecisionStatus} />
        <ConfidenceBadge confidence={record.confidence as Confidence} />
        <span className="rounded-full bg-accent/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
          {record.kind}
        </span>
        {record.topic ? (
          <span className="text-[11px] text-muted-foreground">
            {record.topic}
          </span>
        ) : null}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {record.decision_id}
        </span>
      </div>

      <h3 className="mt-2.5 font-medium text-foreground">
        {record.title ?? record.claim}
      </h3>
      {record.title ? (
        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {record.claim}
        </p>
      ) : null}
      {record.rationale && record.rationale !== record.claim ? (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground/90">
          {record.rationale}
        </p>
      ) : null}

      {record.target_ids.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {record.target_ids.slice(0, 4).map((target) => (
            <span
              key={target}
              className="rounded-md bg-accent/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground/75"
            >
              {target}
            </span>
          ))}
          {record.target_ids.length > 4 ? (
            <span className="text-[11px] text-muted-foreground">
              +{record.target_ids.length - 4} more
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1 font-medium text-foreground/80 transition-colors hover:text-foreground"
          aria-expanded={expanded}
        >
          {evidenceCount} evidence
          <ChevronDownIcon
            className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {record.pr_number ? <span>PR #{record.pr_number}</span> : null}
        {record.created_at ? (
          <span>{record.created_at.slice(0, 10)}</span>
        ) : null}
        {record.superseded_by ? (
          <span className="text-amber-600 dark:text-amber-400">
            superseded by {record.superseded_by}
          </span>
        ) : null}
        <a
          href={api.recordExportUrl(record.decision_id, record.repo)}
          download
          className="ml-auto inline-flex items-center gap-1 font-medium text-primary transition-opacity hover:opacity-80"
        >
          <DownloadIcon className="size-3.5" aria-hidden="true" />
          ADR export
        </a>
      </div>

      {expanded ? (
        <div className="mt-3 rounded-xl bg-accent/30 p-3">
          {record.evidence.length > 0 ? (
            <ul className="space-y-1.5">
              {record.evidence.map((ref) => (
                <li
                  key={ref.evidence_id}
                  className="flex flex-wrap items-baseline gap-x-2 text-[13px]"
                >
                  <span className="rounded bg-accent/70 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                    {ref.kind || "evidence"}
                  </span>
                  {ref.url ? (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {ref.path ?? ref.evidence_id}
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-foreground/80">
                      {ref.path ?? ref.evidence_id}
                    </span>
                  )}
                  {ref.author ? (
                    <span className="text-xs text-muted-foreground">
                      by {ref.author}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {record.evidence_ids.map((id) => (
                <span
                  key={id}
                  className="rounded-md bg-accent/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground/75"
                >
                  {id}
                </span>
              ))}
              {record.evidence_ids.length === 0 ? (
                <span className="text-[13px] text-muted-foreground">
                  No evidence attached to this record.
                </span>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function SupersessionCard({ pair }: { pair: SupersessionPair }) {
  const side = (record: DecisionRecord, muted: boolean) => (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-xl border border-border/60 bg-accent/20 p-3",
        muted && "opacity-75",
      )}
    >
      <div className="flex items-center gap-2">
        <DecisionStatusBadge status={record.status as DecisionStatus} />
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {record.decision_id}
        </span>
      </div>
      <p
        className={cn(
          "mt-1.5 line-clamp-2 text-sm font-medium text-foreground",
          muted && "line-through decoration-muted-foreground/60",
        )}
      >
        {record.title ?? record.claim}
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {record.claim}
      </p>
    </div>
  );
  return (
    <article className="rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-neumorph sm:p-5">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {side(pair.earlier, true)}
        <div className="flex shrink-0 items-center justify-center gap-1.5 text-primary">
          <ArrowRightIcon className="size-4 rotate-90 sm:rotate-0" aria-hidden="true" />
          <span className="font-mono text-[10px] tracking-wider uppercase">
            {pair.relation === "REVERSED_BY" ? "reversed by" : "superseded by"}
          </span>
        </div>
        {side(pair.later, false)}
      </div>
    </article>
  );
}

/**
 * Search + filter explorer over the normalized decision-records API,
 * with a supersession view. Searches can span every indexed repo.
 */
export function DecisionExplorer({ repo }: { repo: string }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [allRepos, setAllRepos] = useState(false);
  const [view, setView] = useState<"records" | "supersessions">("records");
  const [records, setRecords] = useState<DecisionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pairs, setPairs] = useState<SupersessionPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load =
      allRepos && query
        ? api
            .searchRecords(query)
            .then((result) => ({ total: result.total, records: result.results }))
        : api.listRecords({
            repo,
            q: query || undefined,
            status: status === "all" ? undefined : status,
            limit: 50,
          });
    load
      .then((page) => {
        if (cancelled) return;
        setRecords(page.records);
        setTotal(page.total);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load decision records.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo, query, status, allRepos]);

  useEffect(() => {
    let cancelled = false;
    api
      .listSupersessions(repo)
      .then((result) => {
        if (!cancelled) setPairs(result);
      })
      .catch(() => {
        if (!cancelled) setPairs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const visibleRecords = useMemo(
    () =>
      allRepos && query && status !== "all"
        ? records.filter((r) => r.status === status)
        : records,
    [records, allRepos, query, status],
  );

  return (
    <section aria-label="Decision explorer" className="mb-10">
      <form
        className="flex items-center gap-2 rounded-full border border-border/70 bg-card p-1.5 shadow-neumorph"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(input.trim());
          hapticLight();
        }}
      >
        <SearchIcon className="ml-2.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Search decisions — try “retries”, “timeout”, a config key…"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          aria-label="Search decisions"
        />
        <label className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
          <input
            type="checkbox"
            checked={allRepos}
            onChange={(event) => setAllRepos(event.target.checked)}
            className="size-3.5 accent-primary"
          />
          All indexed repos
        </label>
        <button
          type="submit"
          className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Search
        </button>
      </form>

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => {
              setStatus(filter);
              hapticSelection();
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
              status === filter
                ? "bg-primary/10 text-primary shadow-neumorph-inset"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={status === filter}
          >
            {filter}
          </button>
        ))}
        <div className="ml-auto inline-flex rounded-full border border-border/70 bg-card p-0.5 shadow-neumorph">
          {(["records", "supersessions"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setView(option);
                hapticSelection();
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                view === option
                  ? "bg-primary/10 text-primary shadow-neumorph-inset"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={view === option}
            >
              {option}
              {option === "supersessions" && pairs.length > 0
                ? ` (${pairs.length})`
                : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {view === "supersessions" ? (
          pairs.length > 0 ? (
            pairs.map((pair) => (
              <SupersessionCard
                key={`${pair.earlier.decision_id}->${pair.later.decision_id}`}
                pair={pair}
              />
            ))
          ) : (
            <p className="rounded-[1.5rem] border border-border/70 bg-card p-5 text-sm text-muted-foreground shadow-neumorph">
              No superseded or reversed decisions recorded for this repository
              yet — when a later decision overturns an earlier one, the pair
              shows up here with its evidence chain intact.
            </p>
          )
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading records…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : visibleRecords.length === 0 ? (
          <p className="rounded-[1.5rem] border border-border/70 bg-card p-5 text-sm text-muted-foreground shadow-neumorph">
            No decision records match
            {query ? (
              <>
                {" "}
                <span className="font-medium text-foreground">“{query}”</span>
              </>
            ) : null}
            {status !== "all" ? <> with status {status}</> : null}. Try a
            broader term, or clear the filter.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {allRepos && query
                ? `${total} result${total === 1 ? "" : "s"} across indexed repos`
                : `${total} decision record${total === 1 ? "" : "s"}`}
            </p>
            {visibleRecords.map((record) => (
              <RecordCard
                key={`${record.repo}:${record.decision_id}`}
                record={record}
                expanded={expandedId === record.decision_id}
                onToggle={() => {
                  hapticSelection();
                  setExpandedId((current) =>
                    current === record.decision_id ? null : record.decision_id,
                  );
                }}
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}
