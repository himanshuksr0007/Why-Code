"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { GraphPath } from "@/lib/api/types";
import { NODE_LABEL, nodeColor } from "@/lib/labels";
import { cn } from "@/lib/utils";

type WhyNodeData = {
  label: string;
  caption?: string;
  color: string;
};

type WhyNodeType = Node<WhyNodeData, "why">;

function WhyNode({ data }: NodeProps<WhyNodeType>) {
  return (
    <div
      className="relative w-[180px] rounded-lg border bg-card px-3 py-2 text-left shadow-sm"
      style={{ borderColor: `color-mix(in oklab, ${data.color} 55%, transparent)` }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="left-t"
        className="!size-1.5 !border-0 !bg-border"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-s"
        className="!size-1.5 !border-0 !bg-border"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-t"
        className="!size-1.5 !border-0 !bg-border"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-s"
        className="!size-1.5 !border-0 !bg-border"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-t"
        className="!size-1.5 !border-0 !bg-border"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-s"
        className="!size-1.5 !border-0 !bg-border"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-t"
        className="!size-1.5 !border-0 !bg-border"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-s"
        className="!size-1.5 !border-0 !bg-border"
      />

      <p
        className="font-mono text-[10px] font-medium tracking-wide uppercase"
        style={{ color: data.color }}
      >
        {data.label}
      </p>
      {data.caption ? (
        <p
          className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground"
          title={data.caption}
        >
          {data.caption}
        </p>
      ) : null}
    </div>
  );
}

const nodeTypes = { why: WhyNode };

const COLUMNS = 3;
const X_GAP = 285;
const Y_GAP = 145;

/**
 * Snake layout: row 0 runs left→right, row 1 right→left, and so on, so each
 * step connects to the next with a short edge instead of a long diagonal.
 */
function layout(index: number): { x: number; y: number } {
  const row = Math.floor(index / COLUMNS);
  const column = index % COLUMNS;
  const xIndex = row % 2 === 0 ? column : COLUMNS - 1 - column;
  return { x: xIndex * X_GAP, y: row * Y_GAP };
}

export function GraphPathView({
  path,
  className,
}: {
  path: GraphPath;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const nodes = useMemo<WhyNodeType[]>(
    () =>
      path.nodes.map((node, index) => ({
        id: node.id,
        type: "why",
        position: layout(index),
        data: {
          label: NODE_LABEL[node.label] ?? node.label,
          caption: node.caption,
          color: nodeColor(node.label),
        },
        draggable: false,
      })),
    [path.nodes],
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, WhyNodeType>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  const edges = useMemo<Edge[]>(
    () =>
      path.edges.map((edge) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);

        let sourceHandle = "right-s";
        let targetHandle = "left-t";

        if (sourceNode && targetNode) {
          const dx = targetNode.position.x - sourceNode.position.x;
          const dy = targetNode.position.y - sourceNode.position.y;

          if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx >= 0) {
              sourceHandle = "right-s";
              targetHandle = "left-t";
            } else {
              sourceHandle = "left-s";
              targetHandle = "right-t";
            }
          } else {
            if (dy >= 0) {
              sourceHandle = "bottom-s";
              targetHandle = "top-t";
            } else {
              sourceHandle = "top-s";
              targetHandle = "bottom-t";
            }
          }
        }

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle,
          targetHandle,
          type: "smoothstep",
          animated: false,
          label: edge.rel_type,
          labelStyle: {
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 10,
            fontWeight: 600,
            fill: "var(--foreground)",
          },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
          labelBgStyle: {
            fill: "var(--card)",
            stroke: "var(--border)",
            strokeWidth: 1,
            fillOpacity: 0.96,
          },
          style: { stroke: "var(--border)", strokeWidth: 1.5 },
        };
      }),
    [path.edges, nodeMap],
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className="h-[380px] w-full overflow-hidden rounded-xl border border-border/70 bg-card/60"
        role="img"
        aria-label={`Graph path with ${path.nodes.length} nodes`}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={resolvedTheme === "dark" ? "dark" : "light"}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          panOnScroll={false}
          proOptions={{ hideAttribution: false }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Visible data alternative for screen readers / keyboard users. */}
      <ol className="space-y-1.5" aria-label="Graph path as a list">
        {path.nodes.map((node, index) => {
          const nextEdge = path.edges.find((edge) => edge.source === node.id);
          return (
            <li key={`${node.id}-${index}`} className="flex items-start gap-2 text-sm">
              <span
                aria-hidden="true"
                className="mt-1.5 size-2 shrink-0 rounded-full"
                style={{ backgroundColor: nodeColor(node.label) }}
              />
              <span className="min-w-0">
                <span className="font-medium">
                  {NODE_LABEL[node.label] ?? node.label}
                </span>
                {node.caption ? (
                  <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                    {node.caption}
                  </span>
                ) : null}
                {nextEdge ? (
                  <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                    –{nextEdge.rel_type}→
                  </span>
                ) : null}
              </span>
              <span className="sr-only">step {index + 1}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
