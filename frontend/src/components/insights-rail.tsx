"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRightIcon,
  CircleDotIcon,
  DatabaseIcon,
  FileCodeIcon,
  GitCommitHorizontalIcon,
  GitPullRequestIcon,
  Maximize2Icon,
  MessageSquareIcon,
  NetworkIcon,
  UserIcon,
} from "lucide-react";

import { GraphCanvas, trimGraph } from "@/components/graph/graph-canvas";
import { API_MODE, findRepo, isRepoSlug } from "@/lib/api";
import {
  useLatestContributor,
  type TurnContributor,
} from "@/lib/contributor";
import { formatRelativeTime } from "@/lib/format";
import { openGraphViewer, useLatestGraph, type TurnGraph } from "@/lib/graph";
import { hapticSelection } from "@/lib/haptics";
import { useLocalProfile } from "@/lib/local/profile";
import { cn } from "@/lib/utils";

/** Cache successful GitHub descriptions for the current page load. */
const aboutCache = new Map<string, string>();

function useRepoAbout(slug: string, demo: boolean): string {
  const [result, setResult] = useState<{ slug: string; about: string } | null>(null);

  useEffect(() => {
    if (demo || !isRepoSlug(slug) || aboutCache.has(slug)) return;
    const controller = new AbortController();

    fetch(`https://api.github.com/repos/${slug}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { description?: string | null } | null) => {
        if (controller.signal.aborted || !data) return;
        const about = (data.description ?? "").trim();
        aboutCache.set(slug, about);
        setResult({ slug, about });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [slug, demo]);

  return result?.slug === slug ? result.about : (aboutCache.get(slug) ?? "");
}

export function InsightsRail() {
  const { profile } = useLocalProfile();
  const latestGraph = useLatestGraph();
  const contributor = useLatestContributor();

  const repo = findRepo(profile.default_repo);
  const repoSlug = repo?.slug ?? profile.default_repo;
  const demo = API_MODE === "mock";
  const liveAbout = useRepoAbout(repoSlug, demo);
  const repoAbout = demo ? repo?.description : liveAbout;

  return (
    <aside
      className="fixed right-4 top-1/2 z-40 hidden w-72 -translate-y-1/2 flex-col gap-4 min-[1400px]:flex"
      aria-label="Session insights"
    >
      {contributor ? (
        <ContributorCard
          key={contributor.turnId}
          contributor={contributor}
        />
      ) : (
        <ContributorEmptyCard />
      )}

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
            {demo && (repo?.indexed ? (
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Indexed
              </span>
            ) : (
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                Not indexed yet
              </span>
            ))}
          </div>
        </div>
        {repoAbout && (
          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {repoAbout}
          </p>
        )}
      </section>
    </aside>
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

const CONTRIBUTOR_KIND = {
  pull_request: { label: "Latest PR", Icon: GitPullRequestIcon },
  commit: { label: "Latest commit", Icon: GitCommitHorizontalIcon },
  issue: { label: "Latest issue", Icon: CircleDotIcon },
  file: { label: "Latest change", Icon: FileCodeIcon },
} as const;

/**
 * The person behind the newest artifact in the latest answer's
 * evidence. Avatar and name link straight to their GitHub profile;
 * the artifact line below links to the PR / commit / issue itself.
 * Rendered only when the evidence carried a real author — see
 * lib/contributor.
 */
/**
 * The contributor slot is always present: when the latest answer's
 * evidence names no author, this placeholder says what will appear
 * here instead of leaving an unexplained gap in the rail.
 */
function ContributorEmptyCard() {
  return (
    <section className="rounded-2xl border border-border/40 bg-card/95 p-4 shadow-none backdrop-blur-sm">
      <header className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <UserIcon className="size-4 text-primary" aria-hidden="true" />
        </span>
        <h2 className="font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          Contributor
        </h2>
      </header>
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border/60 text-muted-foreground">
          <UserIcon className="size-5" aria-hidden="true" />
        </span>
        <p className="text-xs leading-relaxed text-muted-foreground">
          The author of the newest pull request, commit or file behind an
          answer will appear here.
        </p>
      </div>
    </section>
  );
}

function ContributorCard({ contributor }: { contributor: TurnContributor }) {
  const { label, Icon } = CONTRIBUTOR_KIND[contributor.kind];
  return (
    <section
      className="rounded-2xl border border-border/40 bg-card/95 p-4 shadow-none backdrop-blur-sm"
      style={{ animation: "why-fade-in 450ms ease 120ms both" }}
    >
      <header className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" aria-hidden="true" />
        </span>
        <h2 className="font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {label}
        </h2>
        {contributor.createdAt ? (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {formatRelativeTime(contributor.createdAt)}
          </span>
        ) : null}
      </header>

      <a
        href={contributor.profileUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() => hapticSelection()}
        className="group flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src={contributor.avatarUrl}
          alt=""
          className="size-11 shrink-0 rounded-full border border-border/60 object-cover"
          loading="lazy"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground group-hover:underline">
            {contributor.login}
          </span>
          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            GitHub profile
            <ArrowUpRightIcon className="size-3" aria-hidden="true" />
          </span>
        </span>
      </a>

      {contributor.url && contributor.title ? (
        <a
          href={contributor.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => hapticSelection()}
          className="group mt-3 block rounded-xl border border-border/40 bg-background/40 px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {contributor.refLabel ? (
            <span className="mb-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium text-primary">
              {contributor.refLabel}
            </span>
          ) : null}
          <span className="line-clamp-2 text-xs leading-relaxed font-medium text-foreground group-hover:underline">
            {contributor.title}
          </span>
        </a>
      ) : null}
    </section>
  );
}
