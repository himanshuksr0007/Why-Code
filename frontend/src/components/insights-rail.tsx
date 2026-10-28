"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DatabaseIcon, MessageSquareIcon, SparklesIcon } from "lucide-react";

import { findRepo } from "@/lib/api";
import { useLocalProfile } from "@/lib/local/profile";
import { exampleQuestionsFor } from "@/lib/mock";

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
export function InsightsRail() {
  const { profile } = useLocalProfile();

  const repo = findRepo(profile.default_repo);
  const repoSlug = repo?.slug ?? profile.default_repo;

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
        {repo?.description && (
          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {repo.description}
          </p>
        )}
      </section>
    </aside>
  );
}
