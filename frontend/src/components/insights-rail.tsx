"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  DatabaseIcon,
  Maximize2Icon,
  MessageSquareIcon,
  NetworkIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react";

import { GraphCanvas, trimGraph } from "@/components/graph/graph-canvas";
import { api, findRepo } from "@/lib/api";
import { openGraphViewer, useLatestGraph, type TurnGraph } from "@/lib/graph";
import { hapticLight, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { useLocalProfile } from "@/lib/local/profile";
import { exampleQuestionsFor } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * The right rail — what took the old floating panel's place once the
 * conversations moved into the sidebar. Two warm bubbles, all fed by
 * live app state (nothing hard-coded):
 *
 *  - Ask a why: three example questions for the active repository,
 *    rotated daily; clicking one asks it.
 *  - Repository: the repo being explored and whether it is indexed.
 *
 * The session usage bubble that used to sit on top of this rail now
 * lives at the top of the model picker panel, so it is reachable on
 * every screen size.
 *
 * Only shown on very wide screens (>= 1400px), where it never crowds
 * the center column.
 */
/** Module-level cache so each repo's About is fetched at most once
 * per page load (GitHub's unauthenticated API is rate limited). */
const aboutCache = new Map<string, string>();

/**
 * The repo's real description for the Repository card: the catalog
 * blurb when one exists, otherwise the repository's GitHub "About"
 * text fetched from the public API. Empty string when neither is
 * available — the card then shows no description line at all, rather
 * than an invented placeholder.
 */
function useRepoAbout(slug: string, known: string | undefined): string {
  const [fetched, setFetched] = useState<string | null>(null);

  useEffect(() => {
    if (known || !slug.includes("/")) return;
    const cached = aboutCache.get(slug);
    if (cached !== undefined) {
      setFetched(cached);
      return;
    }
    let cancelled = false;
    fetch(`https://api.github.com/repos/${slug}`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { description?: string | null } | null) => {
        const about = (data?.description ?? "").trim();
        aboutCache.set(slug, about);
        if (!cancelled) setFetched(about);
      })
      .catch(() => {
        aboutCache.set(slug, "");
        if (!cancelled) setFetched("");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, known]);

  return known || fetched || "";
}

export function InsightsRail() {
  const { profile } = useLocalProfile();
  const latestGraph = useLatestGraph();

  const repo = findRepo(profile.default_repo);
  const repoSlug = repo?.slug ?? profile.default_repo;
  const repoAbout = useRepoAbout(repoSlug, repo?.description || undefined);

  // Server-rendered with the first three questions so the prerender stays
  // deterministic; the daily rotation is applied on the client after mount.
  const [whys, setWhys] = useState<string[]>(() =>
    exampleQuestionsFor(repoSlug).slice(0, 3),
  );
  useEffect(() => {
    const all = exampleQuestionsFor(repoSlug);
    if (all.length === 0) {
      setWhys([]);
      return;
    }
    const day = Math.floor(Date.now() / 86_400_000);
    const picks: string[] = [];
    for (let i = 0; picks.length < Math.min(3, all.length); i += 1) {
      const candidate = all[(day + i) % all.length];
      if (!picks.includes(candidate)) picks.push(candidate);
    }
    setWhys(picks);
  }, [repoSlug]);

  return (
    <aside
      className="fixed right-4 top-1/2 z-40 hidden w-72 -translate-y-1/2 flex-col gap-4 min-[1400px]:flex"
      aria-label="Session insights"
    >
      {/* Ask a why */}
      {whys.length > 0 && (
        <section className="rounded-2xl border border-border/40 bg-card/95 p-4 shadow-none backdrop-blur-sm">
          <header className="mb-3 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
              <SparklesIcon className="size-4 text-primary" aria-hidden="true" />
            </span>
            <h2 className="font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Ask a why
            </h2>
          </header>
          <div className="flex flex-col gap-2">
            {whys.map((question) => (
              <Link
                key={question}
                href={`/?q=${encodeURIComponent(question)}`}
                className="rounded-xl bg-accent/40 px-3 py-2 text-left text-[13px] leading-snug text-foreground/90 transition-colors duration-200 hover:bg-primary/10 hover:text-foreground"
              >
                {question}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Graph: when the latest reply carries one, the two bubbles
          glide apart (the rail is vertically centered, so the column
          growing pushes the top bubble up and the bottom one down)
          and the graph bubble fades into the space between them. */}
      <div
        aria-hidden={!latestGraph}
        className={cn(
          "grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          latestGraph
            ? "my-0 grid-rows-[1fr] opacity-100"
            : "-my-2 grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {latestGraph && <GraphBubble key={latestGraph.turnId} graph={latestGraph} />}
        </div>
      </div>

      {/* Repository */}
      <section className="rounded-2xl border border-border/40 bg-card/95 p-4 shadow-none backdrop-blur-sm">
        <header className="mb-3 flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
            <DatabaseIcon className="size-4 text-primary" aria-hidden="true" />
          </span>
          <h2 className="font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            Repository
          </h2>
        </header>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquareIcon
              className="size-5 fill-current text-primary/70"
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {repo?.name ?? repoSlug}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {repoSlug}
            </p>
            {repo?.indexed ? (
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Indexed
              </span>
            ) : (
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                Not indexed yet
              </span>
            )}
          </div>
        </div>
        {repoAbout && (
          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {repoAbout}
          </p>
        )}
        <RefreshButton repoSlug={repoSlug} />
      </section>
    </aside>
  );
}

/**
 * Manual refresh: asks the backend to drop this repo's cached
 * decisions so the next read re-derives them from current data.
 * The no-setup counterpart to the GitHub webhook — the server
 * rate-limits it to one refresh per minute per repo.
 */
function RefreshButton({ repoSlug }: { repoSlug: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "cooldown">(
    "idle",
  );

  const refresh = async () => {
    if (state === "working") return;
    setState("working");
    hapticLight();
    try {
      await api.refreshRepo(repoSlug);
      setState("done");
      hapticSuccess();
    } catch {
      // A 429 means a refresh just happened — the data is fresh anyway.
      setState("cooldown");
      hapticSelection();
    }
  };

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={state === "working"}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary transition-opacity hover:opacity-80 disabled:opacity-60"
    >
      {state === "done" || state === "cooldown" ? (
        <CheckIcon className="size-3.5" aria-hidden="true" />
      ) : (
        <RefreshCwIcon
          className={cn("size-3.5", state === "working" && "animate-spin")}
          aria-hidden="true"
        />
      )}
      {state === "working"
        ? "Refreshing…"
        : state === "done"
          ? "Refreshed — next read is fresh"
          : state === "cooldown"
            ? "Just refreshed"
            : "Refresh data"}
    </button>
  );
}

const RAIL_TREE_LIMIT = 12;

/**
 * The graph bubble: same neumorphic card language as the rail's other
 * bubbles. Hovering reveals the fullscreen action; the fullscreen
 * viewer carries the fully interactive canvas.
 */
function GraphBubble({ graph }: { graph: TurnGraph }) {
  const preview =
    graph.variant === "tree"
      ? trimGraph(graph.graph, RAIL_TREE_LIMIT)
      : graph.graph;
  const hiddenCount = graph.graph.nodes.length - preview.nodes.length;

  return (
    <section
      className="group relative rounded-2xl border border-border/40 bg-card/95 p-4 shadow-none backdrop-blur-sm"
      style={{ animation: "why-fade-in 450ms ease 120ms both" }}
    >
      <header className="mb-2 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <NetworkIcon className="size-4 text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            Graph
          </h2>
          <p className="truncate text-xs font-medium text-foreground">
            {graph.title}
          </p>
        </div>
        <button
          type="button"
          aria-label="Open graph fullscreen"
          onClick={() => {
            openGraphViewer(graph);
            hapticSelection();
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Maximize2Icon className="size-3.5" aria-hidden="true" />
        </button>
      </header>

      <div className="relative overflow-hidden rounded-xl border border-border/40 bg-background/40">
        <GraphCanvas
          graph={preview}
          variant={graph.variant}
          focusWindow
          className="h-44 [&_svg]:h-full [&_svg]:w-full"
        />
        <button
          type="button"
          aria-label="Open graph fullscreen"
          onClick={() => {
            openGraphViewer(graph);
            hapticSelection();
          }}
          className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-background/70 via-transparent to-transparent pb-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground shadow-floating">
            <Maximize2Icon className="size-3.5" aria-hidden="true" />
            Open fullscreen
          </span>
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {graph.graph.nodes.length} nodes · {graph.graph.edges.length} connections
        {hiddenCount > 0 ? ` · ${hiddenCount} more in fullscreen` : ""}
      </p>
    </section>
  );
}
