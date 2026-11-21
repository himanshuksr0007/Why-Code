"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleAlertIcon,
  FlameIcon,
  LoaderCircleIcon,
  PinIcon,
  ScaleIcon,
  SearchIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";

import { CountUp } from "@/components/explorer/count-up";
import { Input } from "@/components/ui/input";
import { searchDecisions } from "@/lib/ledger/client";
import type { Currency, LedgerDecision, LedgerHealth } from "@/lib/ledger/types";
import { cn } from "@/lib/utils";

import { CURRENCY_META } from "./decision-badges";
import { DecisionCard } from "./decision-card";
import { DecisionDetailSheet } from "./decision-detail-sheet";

type Filter = "in_force" | "all" | Currency;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "in_force", label: "In force" },
  { id: "needs_review", label: "Needs review" },
  { id: "background", label: "Background" },
  { id: "stale", label: "Stale" },
  { id: "superseded", label: "Superseded" },
  { id: "all", label: "All" },
];

function matches(decision: LedgerDecision, filter: Filter): boolean {
  if (filter === "all") return decision.currency !== "dismissed";
  if (filter === "in_force") return decision.in_force;
  return decision.currency === filter;
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  suffix = "",
}: {
  icon: typeof ScaleIcon;
  label: string;
  value: number;
  hint: string;
  suffix?: string;
}) {
  return (
    <div
      title={hint}
      className="rounded-2xl border border-border/70 bg-card p-4 shadow-neumorph"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {label}
      </div>
      <CountUp
        value={value}
        suffix={suffix}
        className="mt-2 block font-heading text-2xl font-semibold tabular-nums text-foreground"
      />
    </div>
  );
}

export function DecisionsExplorer({
  repo,
  health,
  decisions,
}: {
  repo: string;
  health: LedgerHealth;
  decisions: LedgerDecision[];
}) {
  const [filter, setFilter] = useState<Filter>(
    decisions.some((d) => d.in_force) ? "in_force" : "all",
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LedgerDecision[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Ranked server-side search (BM25 over the ledger), debounced.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchDecisions(repo, q)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, repo]);

  const searchActive = query.trim().length >= 3;
  const counts = useMemo(() => {
    const out = new Map<Filter, number>();
    for (const f of FILTERS) out.set(f.id, decisions.filter((d) => matches(d, f.id)).length);
    return out;
  }, [decisions]);

  const visible = searchActive
    ? (results ?? []).filter((d) => matches(d, filter === "in_force" ? "all" : filter))
    : decisions.filter((d) => matches(d, filter));

  const byId = useMemo(() => {
    const map = new Map<string, LedgerDecision>();
    for (const d of [...decisions, ...(results ?? [])]) map.set(d.decision_id, d);
    return map;
  }, [decisions, results]);

  const verifiedRows = decisions.reduce((n, d) => n + d.verification.verified, 0);
  const totalRows = decisions.reduce((n, d) => n + d.verification.total, 0);
  const needsReview = health.needs_review ?? [];
  const hotspots = health.ungoverned_hotspots ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={ScaleIcon}
          label="In force"
          value={health.in_force ?? decisions.filter((d) => d.in_force).length}
          hint="Decisions someone stands behind that still describe the code"
        />
        <StatTile
          icon={PinIcon}
          label="Pinned"
          value={health.pinned ?? decisions.filter((d) => d.pinned).length}
          hint="Held as law: changing their files needs an explicit Decision-Ack"
        />
        <StatTile
          icon={CircleAlertIcon}
          label="Needs review"
          value={needsReview.length}
          hint="In force, but most of their files changed since they were settled"
        />
        <StatTile
          icon={ShieldCheckIcon}
          label="Evidence verified"
          suffix="%"
          value={totalRows ? Math.round((verifiedRows / totalRows) * 100) : 0}
          hint={`${verifiedRows} of ${totalRows} evidence quotes found verbatim in the repository`}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <label htmlFor="decision-search" className="sr-only">
                Search decisions
              </label>
              <Input
                id="decision-search"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (event.target.value.trim().length < 3) setResults(null);
                }}
                placeholder="Search decisions — e.g. why are retries off by default"
                className="h-11 rounded-xl pr-10 pl-10 text-sm"
              />
              {searching ? (
                <LoaderCircleIcon
                  className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                  aria-label="Searching"
                />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults(null);
                  }}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <XIcon className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div
              role="tablist"
              aria-label="Filter decisions by state"
              className="flex gap-1.5 overflow-x-auto pb-1"
            >
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {f.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10.5px] tabular-nums",
                        active ? "bg-primary-foreground/20" : "bg-muted",
                      )}
                    >
                      {counts.get(f.id) ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
            {searchActive ? (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {searching
                  ? "Searching…"
                  : `${visible.length} ranked match${visible.length === 1 ? "" : "es"} for “${query.trim()}”`}
              </p>
            ) : null}
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {searchActive ? "No decision matches that search" : "Nothing in this state"}
              </p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {searchActive
                  ? "The ledger only returns recorded decisions — it does not guess. Try other words, or ask the question in chat."
                  : "Try another filter."}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map((decision, index) => (
                <li
                  key={decision.decision_id}
                  className="animate-rise-in"
                  style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
                >
                  <DecisionCard decision={decision} onOpen={setOpenId} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-neumorph">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CircleAlertIcon className="size-4 text-primary" aria-hidden="true" />
              Needs review
            </h2>
            {needsReview.length ? (
              <ul className="mt-3 space-y-2">
                {needsReview.slice(0, 6).map((d) => (
                  <li key={d.decision_id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(d.decision_id)}
                      className="w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-muted/60"
                    >
                      <span className="line-clamp-1 text-foreground">{d.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round((d.changed_fraction ?? 0) * 100)}% of its files changed
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Every decision in force still matches its files.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-neumorph">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FlameIcon className="size-4 text-primary" aria-hidden="true" />
              Busy files no decision governs
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Most-changed files with no decision in force — where a recorded
              “why” would help most.
            </p>
            {hotspots.length ? (
              <ul className="mt-3 space-y-1.5">
                {hotspots.slice(0, 8).map((h) => (
                  <li key={h.path} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                      {h.path}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {h.commits} commits
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Needs a local checkout on the server to compute.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-neumorph">
            <p className="font-semibold text-foreground">Reading the states</p>
            <dl className="mt-2 space-y-1.5">
              {(["active", "needs_review", "background", "stale"] as const).map((c) => (
                <div key={c}>
                  <dt className="inline font-medium text-foreground">
                    {CURRENCY_META[c].label}:
                  </dt>{" "}
                  <dd className="inline">{CURRENCY_META[c].hint}.</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>

      <DecisionDetailSheet
        repo={repo}
        decisionId={openId}
        fallback={openId ? byId.get(openId) : undefined}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      />
    </div>
  );
}
