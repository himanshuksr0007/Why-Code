"use client";

import { useId } from "react";
import { CornerDownLeftIcon, Loader2Icon, SendHorizontalIcon } from "lucide-react";

import { RepoSelect } from "@/components/ask/repo-select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { findRepo } from "@/lib/api";
import { exampleQuestionsFor } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * The question composer.
 *
 * One component is used in both layouts — centred on the entrance and docked at
 * the bottom once a conversation exists — so the keyboard behaviour, the
 * required repository selector and the disabled rules never drift apart.
 */
export function AskComposer({
  value,
  onValueChange,
  onSubmit,
  repo,
  onRepoChange,
  busy = false,
  autoFocus = false,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (question: string) => void;
  repo: string;
  onRepoChange: (slug: string) => void;
  busy?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const id = useId();
  const repoOption = findRepo(repo);
  const blocked = !repoOption?.indexed;
  const canSubmit = !busy && !blocked && value.trim().length > 0;

  return (
    <form
      className={cn("w-full", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit(value);
      }}
    >
      <div className="rounded-2xl border border-border/70 bg-card p-2 shadow-sm transition-colors focus-within:border-primary/50">
        <label htmlFor={id} className="sr-only">
          Your question
        </label>
        <Textarea
          id={id}
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              if (canSubmit) onSubmit(value);
            }
          }}
          rows={2}
          placeholder={`e.g. ${exampleQuestionsFor(repo)[0] ?? "Why does this code work this way?"}`}
          disabled={busy}
          className="min-h-14 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center gap-2 pt-1">
          <RepoSelect
            value={repo}
            onChange={onRepoChange}
            disabled={busy}
            className="min-w-0"
          />
          <span className="ml-auto hidden items-center gap-1 pr-1 text-[11px] text-muted-foreground sm:flex">
            <CornerDownLeftIcon className="size-3" aria-hidden="true" />
            Ctrl / ⌘ + Enter
          </span>
          <Button
            type="submit"
            size="icon-lg"
            aria-label="Ask"
            title="Ask"
            disabled={!canSubmit}
            className="glow-primary rounded-full"
          >
            {busy ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : (
              <SendHorizontalIcon aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
      {blocked ? (
        <p className="mt-2 text-xs text-destructive">
          Not indexed yet — choose a sample repository to ask.
        </p>
      ) : null}
    </form>
  );
}
