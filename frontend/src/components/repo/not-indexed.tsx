import { DatabaseIcon } from "lucide-react";

import { AVAILABLE_REPOS } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Shown when the selected repository was added by hand but has no index behind
 * it. A refusal to guess is part of the product, so the empty state explains
 * what is missing and how to get back to grounded answers.
 */
export function RepoNotIndexed({
  repo,
  className,
}: {
  repo: string;
  className?: string;
}) {
  const samples = AVAILABLE_REPOS.map((option) => option.slug).join(", ");

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border/80 bg-card/60 p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <DatabaseIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold">
            <span className="font-mono">{repo}</span> is not indexed yet
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            It was added to this browser&rsquo;s selector, but there is no
            evidence bundle for it, so any answer would be a guess. Switch to a
            sample repository ({samples}) in the repository menu above to ask a
            grounded question.
          </p>
        </div>
      </div>
    </div>
  );
}
