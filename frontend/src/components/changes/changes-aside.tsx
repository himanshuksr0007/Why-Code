import {
  ChartColumnIcon,
  FileCode2Icon,
  UsersIcon,
} from "lucide-react";

import { CountUp } from "@/components/explorer/count-up";
import { PersonChip } from "@/components/people/person-chip";
import type { CodeChange, PersonRef } from "@/lib/api/types";

/**
 * The code-changes page's right rail, computed from the very changes
 * the feed shows: volume (commits, lines added/removed with their
 * balance bar), the people carrying the work, and the files touched
 * most. Nothing here is fetched separately, so it cannot disagree
 * with the cards beside it.
 */
export function ChangesAside({ changes }: { changes: CodeChange[] }) {
  const totalAdditions = changes.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = changes.reduce((sum, c) => sum + c.deletions, 0);
  const lineTotal = totalAdditions + totalDeletions;
  const additionsPct =
    lineTotal > 0 ? Math.round((totalAdditions / lineTotal) * 100) : 0;

  const byAuthor = new Map<
    string,
    { person: PersonRef; count: number; additions: number; deletions: number }
  >();
  for (const change of changes) {
    if (!change.author) continue;
    const entry = byAuthor.get(change.author.login) ?? {
      person: change.author,
      count: 0,
      additions: 0,
      deletions: 0,
    };
    entry.count += 1;
    entry.additions += change.additions;
    entry.deletions += change.deletions;
    byAuthor.set(change.author.login, entry);
  }
  const topAuthors = [...byAuthor.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Only real file paths count — synthesized labels ("repo / commit
  // abc1234") are not files and stay out of this list.
  const byFile = new Map<string, number>();
  for (const change of changes) {
    if (!change.path.includes("/")) continue;
    if (change.path.includes(" / commit ")) continue;
    byFile.set(change.path, (byFile.get(change.path) ?? 0) + 1);
  }
  const topFiles = [...byFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxFileCount = topFiles[0]?.[1] ?? 1;

  const byKind = new Map<string, number>();
  for (const change of changes) {
    byKind.set(change.change_kind, (byKind.get(change.change_kind) ?? 0) + 1);
  }

  return (
    <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Change activity">
      <section
        className="animate-rise-in rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-neumorph"
        style={{ animationDelay: "100ms" }}
        aria-label="Change volume"
      >
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          <ChartColumnIcon className="size-3.5 text-primary" aria-hidden="true" />
          Change activity
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-foreground">
            <CountUp value={changes.length} />
          </span>
          <span className="text-[13px] text-muted-foreground">
            recent changes
          </span>
        </div>
        {lineTotal > 0 ? (
          <>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-accent/60">
              <div
                className="animate-bar-grow h-full bg-primary-gradient"
                style={{ width: `${additionsPct}%` }}
              />
              <div
                className="animate-bar-grow h-full bg-destructive/70"
                style={{
                  width: `${100 - additionsPct}%`,
                  animationDelay: "120ms",
                }}
              />
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              <span className="text-primary">
                +{totalAdditions.toLocaleString()}
              </span>{" "}
              lines added ·{" "}
              <span className="text-destructive">
                −{totalDeletions.toLocaleString()}
              </span>{" "}
              removed
            </p>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Line counts are not available for these commits.
          </p>
        )}
        {byKind.size > 0 ? (
          <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
            {[...byKind.entries()].map(([kind, count]) => (
              <span
                key={kind}
                className="rounded-full bg-accent/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize"
              >
                {kind} · {count}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {topAuthors.length > 0 ? (
        <section
          className="animate-rise-in rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-neumorph"
          style={{ animationDelay: "200ms" }}
          aria-label="Top contributors"
        >
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            <UsersIcon className="size-3.5 text-primary" aria-hidden="true" />
            Carrying the changes
          </p>
          <ul className="mt-3 space-y-2.5">
            {topAuthors.map((entry) => (
              <li key={entry.person.login} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <PersonChip person={entry.person} />
                </div>
                <span className="shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                  {entry.count} change{entry.count === 1 ? "" : "s"}
                  {entry.additions + entry.deletions > 0 ? (
                    <>
                      <br />
                      <span className="text-primary">+{entry.additions}</span>{" "}
                      <span className="text-destructive">
                        −{entry.deletions}
                      </span>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topFiles.length > 0 ? (
        <section
          className="animate-rise-in rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-neumorph"
          style={{ animationDelay: "300ms" }}
          aria-label="Most touched files"
        >
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            <FileCode2Icon className="size-3.5 text-primary" aria-hidden="true" />
            Most touched files
          </p>
          <ul className="mt-3 space-y-2.5">
            {topFiles.map(([path, count], index) => (
              <li key={path}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-mono text-[11px] text-foreground/85">
                    {path}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    ×{count}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-accent/60">
                  <div
                    className="animate-bar-grow h-full rounded-full bg-primary/70"
                    style={{
                      width: `${Math.round((count / maxFileCount) * 100)}%`,
                      animationDelay: `${index * 80}ms`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
