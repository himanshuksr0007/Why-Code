"use client";

import { useSyncExternalStore } from "react";

import type {
  AskResponse,
  GraphNodeLabel,
  GraphPath,
  PlanGraph,
} from "@/lib/api/types";
import { useChatStore } from "@/lib/chat/store";
import { NODE_LABEL } from "@/lib/labels";

/** The retrieval path's node kinds, in the plan graph's vocabulary —
 * the same mapping the backend's plan builder uses. */
const KIND_BY_PATH_LABEL: Record<GraphNodeLabel, string> = {
  Repo: "repo",
  PullRequest: "pr",
  Commit: "commit",
  ChangedFile: "file",
  CodeRegion: "code",
  Review: "doc",
  ReviewComment: "doc",
  Issue: "issue",
  IssueComment: "doc",
  Person: "person",
  Evidence: "evidence",
  Symbol: "symbol",
  ConfigKey: "config",
  Doc: "doc",
  ExternalRef: "module",
  Decision: "decision",
};

/**
 * The raw retrieval graph path, reshaped as a PlanGraph so the ONE
 * graph canvas renders it — the answer panel's "Graph path" tab and
 * the rail/fullscreen "View Graph" then show the same drawing of the
 * same data instead of two engines' versions of it.
 */
export function graphPathToPlanGraph(path: GraphPath): PlanGraph {
  return {
    nodes: path.nodes.map((node) => ({
      id: node.id,
      label: node.caption ?? NODE_LABEL[node.label],
      kind: KIND_BY_PATH_LABEL[node.label] ?? "module",
      caption: node.caption
        ? `${NODE_LABEL[node.label]}: ${node.caption}`
        : NODE_LABEL[node.label],
    })),
    edges: path.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      rel_type:
        edge.rel_type === "CONNECTED_TO"
          ? "leads to"
          : edge.rel_type === "NEXT"
            ? "next"
            : edge.rel_type,
    })),
  };
}

/**
 * The graph attached to an answer, in the two shapes the site renders:
 *  - "connections": a plan answer's decision/evidence connection graph.
 *  - "tree": a structure answer's repository folder/file tree.
 *
 * The right rail and the mobile "View Graph" button both key off the
 * LATEST turn of the active chat: when that reply carries a graph, the
 * rail bubbles make room for it and the button appears.
 */

export interface TurnGraph {
  variant: "connections" | "tree";
  title: string;
  graph: PlanGraph;
  /** The turn the graph belongs to — keys the rail's fade-in. */
  turnId: string;
}

export function graphForResponse(
  response: AskResponse | null,
  turnId: string,
): TurnGraph | null {
  if (!response) return null;
  if (response.structure && response.structure.nodes.length > 0) {
    return {
      variant: "tree",
      title: "Repository structure",
      graph: response.structure,
      turnId,
    };
  }
  const planGraph = response.plan?.graph;
  if (planGraph && planGraph.nodes.length > 0) {
    return {
      variant: "connections",
      title: response.plan?.goal ?? "How it connects",
      graph: planGraph,
      turnId,
    };
  }
  if (response.graph_path && response.graph_path.nodes.length > 0) {
    return {
      variant: "connections",
      title: "Retrieval graph path",
      graph: graphPathToPlanGraph(response.graph_path),
      turnId,
    };
  }
  return null;
}

export function useLatestGraph(): TurnGraph | null {
  const { chats, activeId } = useChatStore();
  const chat = chats.find((candidate) => candidate.id === activeId);
  const lastTurn = chat?.turns[chat.turns.length - 1];
  if (!lastTurn) return null;
  return graphForResponse(lastTurn.response, lastTurn.id);
}

/* ------------------------------------------------------------------ */
/* Fullscreen viewer state                                             */
/* ------------------------------------------------------------------ */

let openState: TurnGraph | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function openGraphViewer(graph: TurnGraph): void {
  openState = graph;
  emit();
}

export function closeGraphViewer(): void {
  if (openState === null) return;
  openState = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useGraphViewer(): TurnGraph | null {
  return useSyncExternalStore(
    subscribe,
    () => openState,
    () => null,
  );
}
