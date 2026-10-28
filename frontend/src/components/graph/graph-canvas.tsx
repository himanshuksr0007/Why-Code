"use client";

import { useId, useMemo, useRef, useState } from "react";
import { MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";

import type { PlanGraph } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * One canvas for both graph shapes the site produces:
 *  - "connections": the plan graph, layered left → right by longest
 *    path (goal → targets → PR → decision → evidence), edges arc when
 *    they skip a layer.
 *  - "tree": the repository structure — a folder/file diagram drawn
 *    like the classic tree listing, root on the left, children
 *    branching right with elbow connectors.
 *
 * Non-interactive renders are static SVGs that fit their box. The
 * interactive render (fullscreen) supports pan (drag the backdrop),
 * zoom (wheel or buttons), node dragging, and hover highlighting
 * with the node's full caption.
 */

export const KIND_COLORS: Record<string, string> = {
  feature: "var(--primary)",
  decision: "var(--primary)",
  repo: "var(--primary)",
  config: "var(--chart-1)",
  symbol: "var(--chart-1)",
  code: "var(--chart-1)",
  file: "var(--chart-1)",
  folder: "var(--chart-1)",
  pr: "var(--chart-3)",
  commit: "var(--chart-3)",
  evidence: "var(--chart-2)",
  person: "var(--chart-5)",
  issue: "var(--chart-4)",
  doc: "var(--chart-4)",
  module: "var(--muted-foreground)",
};

const NODE_W = 176;
const NODE_H = 52;
const COL_GAP = 92;
const ROW_GAP = 26;
const PAD = 20;

export interface PlacedNode {
  id: string;
  label: string;
  kind: string;
  caption: string;
  depth: number;
  x: number;
  y: number;
}

export interface GraphLayout {
  placed: Map<string, PlacedNode>;
  width: number;
  height: number;
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

export function layoutGraph(
  graph: PlanGraph,
  variant: "connections" | "tree",
): GraphLayout | null {
  if (graph.nodes.length === 0) return null;
  return variant === "tree" ? layoutTree(graph) : layoutLayered(graph);
}

function layoutLayered(graph: PlanGraph): GraphLayout {
  const nodes = graph.nodes;
  const byId = new Map(nodes.map((node) => [node.id, node]));
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
  const hasArc = graph.edges.some(
    (edge) => (depth.get(edge.target) ?? 0) - (depth.get(edge.source) ?? 0) > 1,
  );
  const arcHeadroom = hasArc ? 44 : 0;
  const height = PAD * 2 + arcHeadroom + maxRows * NODE_H + (maxRows - 1) * ROW_GAP;
  const width = PAD * 2 + depths.length * NODE_W + (depths.length - 1) * COL_GAP;
  const placed = new Map<string, PlacedNode>();
  for (const d of depths) {
    const column = columns.get(d)!;
    const columnHeight = column.length * NODE_H + (column.length - 1) * ROW_GAP;
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
}

function layoutTree(graph: PlanGraph): GraphLayout {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const edge of graph.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
    hasParent.add(edge.target);
  }
  const kindRank = (id: string) => {
    const kind = byId.get(id)?.kind;
    return kind === "folder" || kind === "repo" ? 0 : 1;
  };
  for (const list of children.values()) {
    list.sort(
      (a, b) =>
        kindRank(a) - kindRank(b) ||
        (byId.get(a)?.label ?? "").localeCompare(byId.get(b)?.label ?? ""),
    );
  }
  const roots = graph.nodes.filter((node) => !hasParent.has(node.id));
  const placed = new Map<string, PlacedNode>();
  let row = 0;
  let maxDepth = 0;
  const visit = (id: string, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = children.get(id) ?? [];
    let y: number;
    if (kids.length === 0) {
      y = PAD + row * (NODE_H + ROW_GAP);
      row += 1;
    } else {
      const childYs = kids.map((kid) => visit(kid, depth + 1));
      y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    }
    const node = byId.get(id)!;
    placed.set(id, {
      id,
      label: node.label,
      kind: node.kind,
      caption: node.caption ?? node.label,
      depth,
      x: PAD + depth * (NODE_W + COL_GAP),
      y,
    });
    return y;
  };
  for (const root of roots) visit(root.id, 0);
  const height = PAD * 2 + Math.max(row, 1) * NODE_H + Math.max(row - 1, 0) * ROW_GAP;
  const width = PAD * 2 + (maxDepth + 1) * NODE_W + maxDepth * COL_GAP;
  return { placed, width, height };
}

/** BFS-trim a graph to at most `limit` nodes (rail preview). */
export function trimGraph(graph: PlanGraph, limit: number): PlanGraph {
  if (graph.nodes.length <= limit) return graph;
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const edge of graph.edges) {
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
    hasParent.add(edge.target);
  }
  const queue = graph.nodes
    .filter((node) => !hasParent.has(node.id))
    .map((node) => node.id);
  const keep = new Set<string>();
  while (queue.length > 0 && keep.size < limit) {
    const id = queue.shift()!;
    if (keep.has(id)) continue;
    keep.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return {
    nodes: graph.nodes.filter((node) => keep.has(node.id)),
    edges: graph.edges.filter(
      (edge) => keep.has(edge.source) && keep.has(edge.target),
    ),
  };
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function GraphCanvas({
  graph,
  variant,
  interactive = false,
  focusWindow = false,
  sizing = "fit",
  className,
}: {
  graph: PlanGraph;
  variant: "connections" | "tree";
  interactive?: boolean;
  /** Start zoomed into the top-left of the graph (rail thumbnails:
   * a long chain fitted whole would be an unreadable sliver). */
  focusWindow?: boolean;
  /** "fit" scales the graph into its box; "natural" renders at full
   * size inside a horizontally scrolling frame (answer-panel tabs). */
  sizing?: "fit" | "natural";
  className?: string;
}) {
  const markerId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const layout = useMemo(() => layoutGraph(graph, variant), [graph, variant]);
  const [overrides, setOverrides] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(),
  );
  const [view, setView] = useState<ViewBox | null>(() =>
    focusWindow && layout
      ? {
          x: 0,
          y: 0,
          w: Math.min(layout.width, 620),
          h: Math.min(layout.height, 360),
        }
      : null,
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const dragRef = useRef<
    | { kind: "pan"; startX: number; startY: number; view: ViewBox }
    | { kind: "node"; id: string; dx: number; dy: number }
    | null
  >(null);

  if (!layout) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No graph was returned for this answer.
      </p>
    );
  }
  const { placed, width, height } = layout;
  const currentView: ViewBox = view ?? { x: 0, y: 0, w: width, h: height };

  const positionOf = (id: string): PlacedNode | undefined => {
    const base = placed.get(id);
    if (!base) return undefined;
    const override = overrides.get(id);
    return override ? { ...base, x: override.x, y: override.y } : base;
  };

  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  };

  const zoomBy = (factor: number, center?: { x: number; y: number }) => {
    setView((current) => {
      const base = current ?? { x: 0, y: 0, w: width, h: height };
      const cx = center?.x ?? base.x + base.w / 2;
      const cy = center?.y ?? base.y + base.h / 2;
      const w = Math.min(Math.max(base.w * factor, width / 8), width * 1.6);
      const h = (w / base.w) * base.h;
      return { x: cx - (cx - base.x) * (w / base.w), y: cy - (cy - base.y) * (h / base.h), w, h };
    });
  };

  const onWheel = (event: React.WheelEvent) => {
    if (!interactive) return;
    event.preventDefault();
    const point = toSvgPoint(event.clientX, event.clientY);
    zoomBy(event.deltaY > 0 ? 1.12 : 0.89, point);
  };

  const onBackgroundDown = (event: React.PointerEvent) => {
    if (!interactive || event.target !== event.currentTarget) return;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: "pan",
      startX: event.clientX,
      startY: event.clientY,
      view: currentView,
    };
  };

  const onNodeDown = (event: React.PointerEvent, id: string) => {
    if (!interactive) return;
    event.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(event.pointerId);
    const point = toSvgPoint(event.clientX, event.clientY);
    const node = positionOf(id);
    if (!node) return;
    dragRef.current = { kind: "node", id, dx: point.x - node.x, dy: point.y - node.y };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = ((event.clientX - drag.startX) / rect.width) * drag.view.w;
      const dy = ((event.clientY - drag.startY) / rect.height) * drag.view.h;
      setView({ ...drag.view, x: drag.view.x - dx, y: drag.view.y - dy });
    } else {
      const point = toSvgPoint(event.clientX, event.clientY);
      setOverrides((current) => {
        const next = new Map(current);
        next.set(drag.id, { x: point.x - drag.dx, y: point.y - drag.dy });
        return next;
      });
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const incidentTo = (id: string | null) =>
    id === null
      ? null
      : new Set(
          graph.edges
            .filter((edge) => edge.source === id || edge.target === id)
            .map((edge) => `${edge.source}->${edge.target}`),
        );
  const activeEdges = incidentTo(hovered);
  const hoveredNode = hovered ? positionOf(hovered) : undefined;

  return (
    <div className={cn("relative", sizing === "natural" && "overflow-x-auto", className)}>
      <svg
        ref={svgRef}
        viewBox={`${currentView.x} ${currentView.y} ${currentView.w} ${currentView.h}`}
        width={sizing === "natural" ? width : undefined}
        height={sizing === "natural" ? height : undefined}
        className={cn(
          "block",
          sizing === "fit" && "h-full w-full",
          interactive && "touch-none select-none",
        )}
        role="img"
        aria-label={variant === "tree" ? "Repository structure graph" : "Connection graph"}
        onWheel={onWheel}
        onPointerDown={onBackgroundDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{
          backgroundImage:
            "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
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
          const source = positionOf(edge.source);
          const target = positionOf(edge.target);
          if (!source || !target) return null;
          const x1 = source.x + NODE_W;
          const y1 = source.y + NODE_H / 2;
          const x2 = target.x;
          const y2 = target.y + NODE_H / 2;
          const isActive = activeEdges?.has(`${edge.source}->${edge.target}`);
          let path: string;
          if (variant === "tree") {
            const midX = (x1 + x2) / 2;
            path = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
          } else {
            const span = target.depth - source.depth;
            const lift = span > 1 ? 30 + span * 7 : 0;
            const midX = (x1 + x2) / 2;
            path =
              lift > 0
                ? `M ${x1} ${y1} C ${x1 + 52} ${y1 - lift}, ${x2 - 52} ${y2 - lift}, ${x2} ${y2}`
                : `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
          }
          return (
            <g key={`${edge.source}-${edge.target}-${index}`}>
              <path
                d={path}
                fill="none"
                stroke={isActive ? "var(--primary)" : "var(--muted-foreground)"}
                strokeOpacity={isActive ? 0.95 : 0.5}
                strokeWidth={isActive ? 2 : 1.4}
                markerEnd={variant === "connections" ? `url(#arrow-${markerId})` : undefined}
              />
              {variant === "connections" && (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 5}
                  textAnchor="middle"
                  fontSize={10.5}
                  fill="var(--muted-foreground)"
                >
                  {edge.rel_type}
                </text>
              )}
            </g>
          );
        })}

        {[...placed.values()].map((base) => {
          const node = positionOf(base.id)!;
          const color = KIND_COLORS[node.kind] ?? KIND_COLORS.module;
          const isHovered = hovered === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onPointerDown={(event) => onNodeDown(event, node.id)}
              onMouseEnter={() => interactive && setHovered(node.id)}
              onMouseLeave={() => interactive && setHovered(null)}
              className={interactive ? "cursor-grab active:cursor-grabbing" : undefined}
            >
              <title>{node.caption}</title>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={13}
                fill="var(--card)"
                stroke={isHovered ? "var(--primary)" : "var(--border)"}
                strokeWidth={isHovered ? 1.8 : 1.1}
                style={{ filter: "drop-shadow(0 3px 8px rgb(0 0 0 / 0.16))" }}
              />
              <circle cx={17} cy={NODE_H / 2} r={5.5} fill={color} />
              <text
                x={30}
                y={NODE_H / 2 - 3}
                fontSize={12.5}
                fontWeight={600}
                fill="var(--foreground)"
              >
                {truncate(node.label, 21)}
              </text>
              <text
                x={30}
                y={NODE_H / 2 + 14}
                fontSize={10}
                fill="var(--muted-foreground)"
                className="capitalize"
              >
                {node.kind === "pr" ? "Pull request" : node.kind}
              </text>
            </g>
          );
        })}
      </svg>

      {interactive && (
        <>
          <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomBy(1.25)}
              className="flex size-8 items-center justify-center rounded-full border border-border/50 bg-card/95 text-foreground shadow-neumorph backdrop-blur transition hover:bg-accent"
            >
              <MinusIcon className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Reset view"
              onClick={() => {
                setView(null);
                setOverrides(new Map());
              }}
              className="flex size-8 items-center justify-center rounded-full border border-border/50 bg-card/95 text-foreground shadow-neumorph backdrop-blur transition hover:bg-accent"
            >
              <RotateCcwIcon className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomBy(0.8)}
              className="flex size-8 items-center justify-center rounded-full border border-border/50 bg-card/95 text-foreground shadow-neumorph backdrop-blur transition hover:bg-accent"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
          {hoveredNode && (
            <div className="pointer-events-none absolute top-3 left-3 max-w-xs rounded-xl border border-border/50 bg-card/95 px-3 py-2 shadow-neumorph backdrop-blur">
              <p className="text-xs font-semibold text-foreground">
                {hoveredNode.label}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {hoveredNode.caption}
              </p>
            </div>
          )}
          <p className="pointer-events-none absolute bottom-3 left-3 hidden text-[11px] text-muted-foreground sm:block">
            Drag to pan · Scroll to zoom · Drag a node to move it
          </p>
        </>
      )}
    </div>
  );
}
