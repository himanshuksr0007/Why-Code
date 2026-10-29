"use client";

import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, FolderGit2Icon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AVAILABLE_REPOS, findRepo, type RepoOption } from "@/lib/api";
import { setActiveRepo, useLocalProfile } from "@/lib/local/profile";
import { cn } from "@/lib/utils";

/**
 * In-page repository switcher for the explorer pages. Writes the
 * shared profile choice (which also mirrors the `whycode_repo`
 * cookie the server pages read) and refreshes the route so the
 * server-rendered content refetches for the new repository.
 */
export function RepoSwitcher() {
  const router = useRouter();
  const { profile } = useLocalProfile();
  const current = profile.default_repo;

  const options: RepoOption[] = findRepo(current)
    ? AVAILABLE_REPOS
    : [
        {
          slug: current,
          name: current.split("/")[1] ?? current,
          description: "Current repository",
          indexed: true,
        },
        ...AVAILABLE_REPOS,
      ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card py-2 pr-3.5 pl-4 text-sm shadow-neumorph transition-transform outline-none hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={`Repository in context: ${current}. Change repository`}
      >
        <FolderGit2Icon className="size-4 text-primary" aria-hidden="true" />
        <span className="font-mono text-[13px] text-foreground">
          {current}
        </span>
        <ChevronDownIcon
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-80">
        <div className="px-2.5 py-2 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          Repository in context
        </div>
        {options.map((repo) => {
          const active = repo.slug === current;
          return (
            <DropdownMenuItem
              key={repo.slug}
              onClick={() => {
                if (active) return;
                setActiveRepo(repo.slug);
                router.refresh();
              }}
              className={cn(active && "bg-primary/10")}
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[13px] text-foreground">
                  {repo.slug}
                </p>
                {repo.description ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {repo.description}
                  </p>
                ) : null}
              </div>
              {active ? (
                <CheckIcon
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
              ) : null}
            </DropdownMenuItem>
          );
        })}
        <p className="px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Switching re-fetches this page for the chosen repository.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
