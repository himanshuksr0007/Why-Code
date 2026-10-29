"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListTreeIcon, Loader2Icon, NetworkIcon, RouteIcon } from "lucide-react";

import {
  GraphCanvas,
  KIND_COLORS,
} from "@/components/graph/graph-canvas";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { GraphPath, PlanGraph, PlanGraphNode } from "@/lib/api/types";
import { graphPathToPlanGraph } from "@/lib/graph";
import { cn } from "@/lib/utils";

export interface DecisionOption {
  id: string;
  label: string;
}

/** Walk the edges from the root so the path reads in story order. */
function orderedNodes(graph: PlanGraph): PlanGraphNode[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const next = new Map(graph.edges.map((edge) => [edge.source, edge.target]));
  const hasIncoming = new Set(graph.edges.map((edge) => edge.target));
  const start =
    graph.nodes.find((node) => !hasIncoming.has(node.id)) ?? graph.nodes[0];
  const ordered: PlanGraphNode[] = [];
  const seen = new Set<string>();
  let current: PlanGraphNode | undefined = start;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    ordered.push(current);
    const nextId = next.get(current.id);
    current = nextId ? byId.get(nextId) : undefined;
  }
  for (const node of graph.nodes) {
    if (!seen.has(node.id)) ordered.push(node);
  }
  return ordered;
}

function humanizeRel(rel: string): string {
  return rel.replace(/_/g, " ").toLowerCase();
}

/**
 * Traces one decision through the graph.
 *
 * The selected decision is seeded from the URL by the server component
 * (`?decision=`), so there is no mount-time state sync here. The path is
 * fetched per selection; loading/error are *derived* from the fetch result
 * rather than set synchronously in the effect.
 *
 * Layout: the shared canvas on the left; on the right, this page's own
 * rail — the decision picker, the traced path as a step-by-step story,
 * and the node-kind legend.
 */
export function GraphExplorer({
  options,
  initialDecision,
}: {
  options: DecisionOption[];
  initialDecision?: string;
}) {
  const resolveInitial = (id?: string): string => {
    if (!id) return options[0]?.id ?? "";
    if (options.some((o) => o.id === id)) return id;
    if (id.includes("trust_env_origin")) return "dec_httpx_trust_env_origin";
    if (id.includes("trust_env")) return "dec_httpx_trust_env_scoped";
    if (id.includes("five_seconds")) return "dec_httpx_timeout_five_seconds";
    if (id.includes("timeout")) return "dec_httpx_timeout_explicit";
    if (id.includes("retry")) return "dec_httpx_retry_default";
    return options[0]?.id ?? id;
  };

  const [selected, setSelected] = useState(resolveInitial(initialDecision));
  const [result, setResult] = useState<{ id: string; path: GraphPath } | null>(
    null,
  );
  const [failedId, setFailedId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    api
      .getGraphPath(selected)
      .then((path) => {
        if (cancelled) return;
        setResult({ id: selected, path });
        setFailedId(null);
      })
      .catch(() => {
        if (cancelled) return;
        setFailedId(selected);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, nonce]);

  const path = result && result.id === selected ? result.path : null;
  const state: "loading" | "ready" | "error" = failedId === selected
    ? "error"
    : path
      ? "ready"
      : "loading";

  const choose = useCallback((id: string) => {
    setSelected(id);
    window.history.replaceState(
      null,
      "",
      `/graph?decision=${encodeURIComponent(id)}`,
    );
  }, []);

  const retry = useCallback(() => {
    setFailedId(null);
    setNonce((value) => value + 1);
  }, []);

  const planGraph = useMemo(
    () => (path ? graphPathToPlanGraph(path) : null),
    [path],
  );
  const steps = useMemo(
    () => (planGraph ? orderedNodes(planGraph) : []),
    [planGraph],
  );
  const legend = planGraph
    ? Array.from(new Set(planGraph.nodes.map((node) => node.kind))).map(
        (kind) => ({
          label: kind,
          color: KIND_COLORS[kind] ?? KIND_COLORS.module,
        }),
      )
    : [];
  const selectedLabel =
    options.find((option) => option.id === selected)?.label ?? selected;

  if (options.length === 0) {
    return (
      <div className="animate-rise-in mx-auto max-w-xl rounded-[1.5rem] border border-dashed border-border/70 bg-card/60 p-8 text-center shadow-neumorph">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <NetworkIcon className="size-6 text-primary" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-foreground">
          No decisions have been extracted yet
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Graph paths are traced from extracted decisions, so there is
          nothing to walk for this repository yet. Switch the repository
          above to one with decisions on record.
        </p>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* Canvas (second on mobile, first on xl) */}
      <div className="animate-rise-in order-2 min-w-0 xl:order-1" style={{ animationDelay: "80ms" }}>
        <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-neumorph">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
            <RouteIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {selectedLabel}
            </p>
            {planGraph ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                {planGraph.nodes.length} nodes · {planGraph.edges.length} edges
              </span>
            ) : null}
          </div>

          {state === "loading" ? (
            <div className="space-y-3 p-4" aria-busy="true">
              <Skeleton className="h-[420px] w-full rounded-xl" />
              <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
                Tracing path…
              </p>
            </div>
          ) : null}

          {state === "error" ? (
            <p className="m-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              Could not load the graph path for this decision.{" "}
              <button
                type="button"
                className="cursor-pointer font-medium text-primary underline underline-offset-4"
                onClick={retry}
              >
                Retry
              </button>
            </p>
          ) : null}

          {state === "ready" && planGraph ? (
            <div className="bg-card/40 shadow-[inset_2px_2px_5px_var(--neu-dark),inset_-2px_-2px_5px_var(--neu-light)]">
              <GraphCanvas
                graph={planGraph}
                variant="connections"
                interactive
                className="h-[520px] [&_svg]:h-full [&_svg]:w-full"
              />
            </div>
          ) : null}
        </div>

        {legend.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
            {legend.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground capitalize"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* This page's rail: picker + the path as a story (first on mobile) */}
      <aside
        className="animate-rise-in order-1 space-y-4 xl:order-2 xl:sticky xl:top-6"
        style={{ animationDelay: "160ms" }}
        aria-label="Decision tracer"
      >
        <section
          className="rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-neumorph"
          aria-label="Choose a decision"
        >
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            <ListTreeIcon className="size-3.5 text-primary" aria-hidden="true" />
            Trace a decision
          </p>
          <div className="mt-3 max-h-[280px] space-y-1 overflow-y-auto pr-1 scrollbar-thin">
            {options.map((option) => {
              const active = option.id === selected;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose(option.id)}
                  className={cn(
                    "w-full rounded-lg px-2.5 py-2 text-left text-[13px] leading-snug transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active
                      ? "bg-primary/15 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        {state === "ready" && planGraph ? (
          <section
            className="rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-neumorph"
            aria-label="Path, step by step"
          >
            <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              <RouteIcon className="size-3.5 text-primary" aria-hidden="true" />
              Path, step by step
            </p>
            <ol className="mt-3">
              {steps.map((node, index) => {
                const edge = planGraph.edges.find(
                  (e) => e.source === node.id && steps[index + 1] && e.target === steps[index + 1].id,
                );
                const isLast = index === steps.length - 1;
                return (
                  <li key={node.id} className="relative pl-6">
                    {!isLast ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-4 bottom-0 left-[5px] w-px bg-border"
                      />
                    ) : null}
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 left-0 size-[11px] rounded-full ring-2 ring-card"
                      style={{
                        backgroundColor:
                          KIND_COLORS[node.kind] ?? KIND_COLORS.module,
                      }}
                    />
                    <p className="text-[13px] leading-snug font-medium text-foreground">
                      {node.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {node.kind}
                      {node.caption ? ` · ${node.caption}` : ""}
                    </p>
                    {edge && !isLast ? (
                      <p className="pt-1 pb-2 font-mono text-[10px] tracking-wide text-primary/80 uppercase">
                        ↓ {humanizeRel(edge.rel_type)}
                      </p>
                    ) : (
                      <span className="block pb-2" />
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
