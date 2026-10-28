"use client";

import { useEffect } from "react";
import { NetworkIcon, XIcon } from "lucide-react";

import { GraphCanvas } from "@/components/graph/graph-canvas";
import { closeGraphViewer, useGraphViewer } from "@/lib/graph";
import { hapticSelection } from "@/lib/haptics";

/**
 * The fullscreen graph viewer: a liquid-glass overlay carrying the
 * interactive canvas (pan, zoom, draggable nodes, hover captions).
 * Opened from the rail graph bubble's hover action or the mobile
 * "View Graph" button; closes on Escape, backdrop click, or the X.
 */
export function GraphViewerHost() {
  const graph = useGraphViewer();

  useEffect(() => {
    if (!graph) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGraphViewer();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [graph]);

  if (!graph) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={graph.title}
      className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6"
      style={{ animation: "why-fade-in 220ms ease both" }}
    >
      <button
        type="button"
        aria-label="Close graph viewer"
        onClick={closeGraphViewer}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <div
        className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border/50 bg-card shadow-floating"
        style={{ animation: "why-scale-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
      >
        <header className="flex items-center gap-3 border-b border-border/50 px-5 py-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
            <NetworkIcon className="size-4.5 text-primary" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {graph.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {graph.variant === "tree"
                ? "Repository structure"
                : "Connection graph"}{" "}
              · {graph.graph.nodes.length} nodes · {graph.graph.edges.length}{" "}
              connections
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              closeGraphViewer();
              hapticSelection();
            }}
            className="flex size-9 items-center justify-center rounded-full border border-border/50 bg-background/60 text-foreground transition hover:bg-accent"
          >
            <XIcon className="size-4.5" />
          </button>
        </header>
        <GraphCanvas
          key={graph.turnId + graph.variant}
          graph={graph.graph}
          variant={graph.variant}
          interactive
          className="min-h-0 flex-1"
        />
      </div>
    </div>
  );
}
