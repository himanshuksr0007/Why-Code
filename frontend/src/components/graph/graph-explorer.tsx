"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { GraphPathView } from "@/components/graph/graph-path-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { GraphPath } from "@/lib/api/types";
import { NODE_LABEL, nodeColor } from "@/lib/labels";

export interface DecisionOption {
  id: string;
  label: string;
}

/**
 * Traces one decision through the graph.
 *
 * The selected decision is seeded from the URL by the server component
 * (`?decision=`), so there is no mount-time state sync here. The path is
 * fetched per selection; loading/error are *derived* from the fetch result
 * rather than set synchronously in the effect.
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

  const legend = path
    ? Array.from(new Set(path.nodes.map((node) => node.label))).map(
        (label) => ({
          label: NODE_LABEL[label] ?? label,
          color: nodeColor(label),
        }),
      )
    : [];

  if (options.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
        No decisions have been extracted yet, so there are no graph paths to
        trace.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Choose a decision
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((option) => {
            const active = option.id === selected;
            return (
              <Button
                key={option.id}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                aria-pressed={active}
                onClick={() => choose(option.id)}
                className="h-auto py-1.5 text-left font-normal whitespace-normal"
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      {state === "loading" ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-[360px] w-full rounded-xl" />
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
            Tracing path…
          </p>
        </div>
      ) : null}

      {state === "error" ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
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

      {state === "ready" && path ? (
        <div className="space-y-3">
          <GraphPathView path={path} />
          {legend.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {legend.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
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
      ) : null}
    </div>
  );
}
