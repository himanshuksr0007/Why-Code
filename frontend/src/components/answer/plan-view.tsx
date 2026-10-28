"use client";

import { useId, useMemo } from "react";
import {
  CheckIcon,
  CircleDashedIcon,
  LoaderIcon,
  NetworkIcon,
} from "lucide-react";

import type { Citation, PlanGraph, PlanStep } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Timeline table                                                      */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<
  PlanStep["status"],
  { label: string; className: string; Icon: typeof CheckIcon }
> = {
  done: {
    label: "Done",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Icon: CheckIcon,
  },
  needed: {
    label: "Needed",
    className: "bg-primary/10 text-primary",
    Icon: CircleDashedIcon,
  },
  in_progress: {
    label: "In progress",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    Icon: LoaderIcon,
  },
};

function EvidenceChips({
  ids,
  citations,
}: {
  ids: string[];
  citations: Citation[];
}) {
  if (ids.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const index = citations.findIndex((c) => c.evidence_id === id);
        if (index === -1) return null;
        return (
          <span
            key={id}
            title={citations[index].title ?? id}
            className="rounded-md bg-accent/60 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground/80"
          >
            E{index + 1}
          </span>
        );
      })}
    </span>
  );
}

/**
 * The plan's code timeline as a proper table: what is already in the
 * repository (done, proven by decisions), what the goal still needs,
 * and the evidence each row stands on.
 */
export function PlanTable({
  steps,
  citations,
}: {
  steps: PlanStep[];
  citations: Citation[];
}) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        The plan has no steps — the retrieval returned nothing to build on.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="bg-accent/40 text-left">
            <th className="px-3 py-2.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              #
            </th>
            <th className="px-3 py-2.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Step
            </th>
            <th className="px-3 py-2.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Status
            </th>
            <th className="px-3 py-2.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Evidence
            </th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, index) => {
            const status = STATUS_STYLE[step.status];
            return (
              <tr
                key={`${step.title}-${index}`}
                className="border-t border-border/50 align-top"
              >
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full font-mono text-[11px] font-semibold",
                      step.status === "done"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {index + 1}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-foreground">{step.title}</p>
                  {step.detail ? (
                    <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      status.className,
                    )}
                  >
                    <status.Icon className="size-3" aria-hidden="true" />
                    {status.label}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <EvidenceChips ids={step.evidence_ids} citations={citations} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Connection graph                                                    */
/* ------------------------------------------------------------------ */

const KIND_COLORS: Record<string, string> = {
  feature: "var(--primary)",
  decision: "var(--primary)",
  config: "var(--chart-1)",
  symbol: "var(--chart-1)",
  code: "var(--chart-1)",
  file: "var(--chart-1)",
  pr: "var(--chart-3)",
  commit: "var(--chart-3)",
  evidence: "var(--chart-2)",
  person: "var(--chart-5)",
  issue: "var(--chart-4)",
  doc: "var(--chart-4)",
  module: "var(--muted-foreground)",
};

const NODE_W = 184;
const NODE_H = 54;
const COL_GAP = 104;
const ROW_GAP = 34;
const PAD = 22;

interface PlacedNode {
  id: string;
  label: string;
  kind: string;
  caption: string;
  depth: number;
  x: number;
  y: number;
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

/**
 * A layered SVG rendering of the plan graph: the goal on the left, then
 * each layer of the real connection chain (targets -> pull request ->
 * decision -> evidence). Depths are longest-path distances from the
 * goal, so edges always flow left to right and every connection shown
 * is one the backend actually returned.
 */
export function PlanGraphView({ graph }: { graph: PlanGraph }) {
  const markerId = useId().replace(/[^a-zA-Z0-9]/g, "");

  const layout = useMemo(() => {
    const nodes = graph.nodes;
    if (nodes.length === 0) return null;
    const byId = new Map(nodes.map((node) => [node.id, node]));

    // Longest-path depth from the roots, relaxed a bounded number of
    // times so a stray cycle can never loop forever.
    const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    for (let pass = 0; pass < nodes.length; pass += 1) {
      let changed = false;
      for (const edge of graph.edges) {
        if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
        const next = (depth.get(edge.source) ?? 0) + 1;
        if (next > (depth.get(edge.target) ?? 0) && next <= nodes.length) {
          depth.set(edge.target, next);
          changed = true;
        }
      }
      if (!changed) break;
    }

    const columns = new Map<number, typeof nodes>();
    for (const node of nodes) {
      const d = depth.get(node.id) ?? 0;
      const column = columns.get(d) ?? [];
      column.push(node);
      columns.set(d, column);
    }
    const depths = [...columns.keys()].sort((a, b) => a - b);
    const maxRows = Math.max(...depths.map((d) => columns.get(d)!.length));
    // Long-span edges arc above the chain; reserve headroom for them.
    const hasArc = graph.edges.some(
      (edge) =>
        (depth.get(edge.target) ?? 0) - (depth.get(edge.source) ?? 0) > 1,
    );
    const arcHeadroom = hasArc ? 48 : 0;
    const height =
      PAD * 2 + arcHeadroom + maxRows * NODE_H + (maxRows - 1) * ROW_GAP;
    const width =
      PAD * 2 + depths.length * NODE_W + (depths.length - 1) * COL_GAP;

    const placed = new Map<string, PlacedNode>();
    for (const d of depths) {
      const column = columns.get(d)!;
      const columnHeight =
        column.length * NODE_H + (column.length - 1) * ROW_GAP;
      const startY = (height - columnHeight) / 2;
      column.forEach((node, row) => {
        placed.set(node.id, {
          id: node.id,
          label: node.label,
          kind: node.kind,
          caption: node.caption ?? node.label,
          depth: d,
          x: PAD + d * (NODE_W + COL_GAP),
          y: startY + row * (NODE_H + ROW_GAP),
        });
      });
    }
    return { placed, width, height };
  }, [graph]);

  if (!layout) {
    return (
      <p className="text-sm text-muted-foreground">
        No connection graph was returned for this plan.
      </p>
    );
  }

  const { placed, width, height } = layout;
  const legendKinds = [...new Set(graph.nodes.map((node) => node.kind))];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          <NetworkIcon className="size-3.5 text-primary" aria-hidden="true" />
          How it connects
        </span>
        {legendKinds.map((kind) => (
          <span
            key={kind}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground capitalize"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: KIND_COLORS[kind] ?? KIND_COLORS.module }}
            />
            {kind === "pr" ? "Pull request" : kind}
          </span>
        ))}
      </div>

      <div
        className="overflow-x-auto rounded-2xl border border-border/60 bg-background/40"
        style={{
          backgroundImage:
            "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="block"
          role="img"
          aria-label="Plan connection graph"
        >
          <defs>
            <marker
              id={`arrow-${markerId}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
            </marker>
          </defs>

          {graph.edges.map((edge, index) => {
            const source = placed.get(edge.source);
            const target = placed.get(edge.target);
            if (!source || !target) return null;
            const x1 = source.x + NODE_W;
            const y1 = source.y + NODE_H / 2;
            const x2 = target.x;
            const y2 = target.y + NODE_H / 2;
            const midX = (x1 + x2) / 2;
            // Edges skipping one or more columns arc above the chain so
            // they read as their own connection instead of overlapping
            // the edges they pass over.
            const span = target.depth - source.depth;
            const lift = span > 1 ? 30 + span * 7 : 0;
            const path =
              lift > 0
                ? `M ${x1} ${y1} C ${x1 + 52} ${y1 - lift}, ${x2 - 52} ${y2 - lift}, ${x2} ${y2}`
                : `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
            const labelY =
              lift > 0 ? (y1 + y2) / 2 - lift * 0.78 : (y1 + y2) / 2 - 4;
            return (
              <g key={`${edge.source}-${edge.target}-${index}`}>
                <path
                  d={path}
                  fill="none"
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.55}
                  strokeWidth={1.4}
                  markerEnd={`url(#arrow-${markerId})`}
                />
                <text
                  x={midX}
                  y={labelY}
                  textAnchor="middle"
                  fontSize={9.5}
                  fill="var(--muted-foreground)"
                  style={{
                    paintOrder: "stroke",
                    stroke: "var(--background)",
                    strokeWidth: 3,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {edge.rel_type}
                </text>
              </g>
            );
          })}

          {[...placed.values()].map((node) => {
            const isGoal = node.kind === "feature";
            const color = KIND_COLORS[node.kind] ?? KIND_COLORS.module;
            return (
              <g key={node.id}>
                <title>{`${node.label}: ${node.caption}`}</title>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={14}
                  style={{
                    fill: isGoal ? "var(--primary)" : "var(--card)",
                    stroke: isGoal ? "var(--primary)" : "var(--border)",
                    strokeWidth: 1,
                    filter: "drop-shadow(0 4px 10px rgb(0 0 0 / 0.18))",
                  }}
                />
                <circle
                  cx={node.x + 16}
                  cy={node.y + NODE_H / 2}
                  r={4.5}
                  style={{ fill: isGoal ? "#fff" : color }}
                />
                <text
                  x={node.x + 28}
                  y={node.y + 20}
                  fontSize={8.5}
                  letterSpacing={1.2}
                  style={{
                    fill: isGoal
                      ? "rgb(255 255 255 / 0.75)"
                      : "var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                  }}
                >
                  {node.label.toUpperCase()}
                </text>
                <text
                  x={node.x + 28}
                  y={node.y + 38}
                  fontSize={12}
                  fontWeight={600}
                  style={{
                    fill: isGoal ? "#fff" : "var(--foreground)",
                  }}
                >
                  {truncate(node.caption, 24)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
