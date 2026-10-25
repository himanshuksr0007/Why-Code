/**
 * Normalises the graph path returned by the answer service.
 *
 * The plan's response schema allows `graph_path` to be a bare list of node
 * labels (`["ConfigKey", "Symbol", ...]`). The UI renders richer nodes with
 * captions, so both shapes are accepted here and the bare list is expanded
 * into a chain.
 */

import type { GraphNodeLabel, GraphPath } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function coerceGraphPath(value: unknown): GraphPath | null {
  if (!value) return null;

  // Already structured: { nodes: [...], edges: [...] }
  if (isRecord(value) && Array.isArray(value.nodes)) {
    const nodes = value.nodes
      .filter(isRecord)
      .map((node, index) => ({
        id: String(node.id ?? `node-${index}`),
        label: (node.label ?? "Evidence") as GraphNodeLabel,
        caption: typeof node.caption === "string" ? node.caption : undefined,
      }));
    const edges = Array.isArray(value.edges)
      ? value.edges.filter(isRecord).map((edge, index) => ({
          id: String(edge.id ?? `edge-${index}`),
          source: String(edge.source ?? ""),
          target: String(edge.target ?? ""),
          rel_type: String(edge.rel_type ?? edge.type ?? "NEXT"),
        }))
      : [];
    return { nodes, edges };
  }

  // Bare list of labels: expand into a linear chain.
  if (Array.isArray(value)) {
    const labels = value.filter(
      (item): item is string => typeof item === "string",
    );
    if (labels.length === 0) return null;
    const nodes = labels.map((label, index) => ({
      id: `node-${index}`,
      label: label as GraphNodeLabel,
    }));
    const edges = labels.slice(0, -1).map((_, index) => ({
      id: `node-${index}->node-${index + 1}`,
      source: `node-${index}`,
      target: `node-${index + 1}`,
      rel_type: "NEXT",
    }));
    return { nodes, edges };
  }

  return null;
}
