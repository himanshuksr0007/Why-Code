"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  DatabaseIcon,
  PlusIcon,
} from "lucide-react";

import { AddRepoDialog } from "@/components/ask/add-repo-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_REPO, findRepo } from "@/lib/api";
import { useRepoCatalog } from "@/lib/local/repos";
import { cn } from "@/lib/utils";

/**
 * The repository selector.
 *
 * A themed menu rather than a native `<select>`: the popup follows the app's
 * dark/light theme, shows each repository's description, and marks the active
 * one. Repositories added by hand appear after the bundled ones, marked as not
 * indexed. Used in the top bar, the Ask composer and the profile preferences.
 */
export function RepoSelect({
  value,
  onChange,
  disabled = false,
  showHint = true,
  className,
}: {
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
  showHint?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { repos } = useRepoCatalog();
  const [addOpen, setAddOpen] = useState(false);
  const selected = findRepo(value);

  const select = (slug: string) => {
    if (slug === value) return;
    onChange(slug);
    // Re-render server components (changes, people, dashboard…)
    // against the newly selected repository.
    router.refresh();
  };

  return (
    <div className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          aria-label={`Repository: ${selected?.name ?? value}. Change repository`}
          className="inline-flex max-w-56 min-w-0 items-center gap-1.5 rounded-lg border border-border/70 bg-background/60 py-1 pr-1.5 pl-2 text-xs transition-colors outline-none hover:bg-accent/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-60"
        >
          <DatabaseIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="truncate font-mono text-xs">{value}</span>
          <ChevronDownIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          <div className="px-1.5 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Repository
          </div>
          <DropdownMenuSeparator />
          {repos.map((repo) => {
            const active = repo.slug === value;
            return (
              <DropdownMenuItem
                key={repo.slug}
                onClick={() => select(repo.slug)}
                className="items-start gap-2"
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  {active ? (
                    <CheckIcon
                      className="size-3.5 text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-1.5">
                    <span className="font-mono text-xs">{repo.slug}</span>
                    {active ? (
                      <span className="text-[10px] tracking-wide text-primary uppercase">
                        active
                      </span>
                    ) : !repo.indexed ? (
                      <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                        not indexed
                      </span>
                    ) : null}
                  </span>
                  {repo.description ? (
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {repo.description}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              // Let the menu finish closing before the modal takes focus.
              window.setTimeout(() => setAddOpen(true), 0);
            }}
          >
            <PlusIcon aria-hidden="true" />
            Add repository
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showHint ? (
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          {selected?.indexed ? "required" : "not indexed"}
        </span>
      ) : null}

      <AddRepoDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={select}
        onRemoved={(slug) => {
          if (slug === value) onChange(DEFAULT_REPO);
          router.refresh();
        }}
      />
    </div>
  );
}
