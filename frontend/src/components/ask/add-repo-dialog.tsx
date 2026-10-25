"use client";

import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addRepo, removeRepo, useRepoCatalog } from "@/lib/local/repos";

/**
 * "Add repository" flow for the selector.
 *
 * There is no write endpoint yet, so the repository is remembered locally and
 * clearly marked as unindexed. Removing one is available in the same dialog,
 * which keeps the menu itself focused on switching.
 */
export function AddRepoDialog({
  open,
  onOpenChange,
  onAdded,
  onRemoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (slug: string) => void;
  onRemoved: (slug: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { customRepos } = useRepoCatalog();

  const reset = () => {
    setValue("");
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add repository</DialogTitle>
          <DialogDescription>
            Paste a GitHub repository as{" "}
            <span className="font-mono text-foreground">owner/name</span>. It is
            remembered in this browser. New repositories are not indexed in
            this demo, so asking stays disabled for them until they are
            ingested.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const result = addRepo(value);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            reset();
            onOpenChange(false);
            onAdded(result.slug);
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="add-repo" className="text-xs font-medium">
              Repository
            </label>
            <Input
              id="add-repo"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              placeholder="owner/repository"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "add-repo-error" : undefined}
            />
            {error ? (
              <p id="add-repo-error" role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          {customRepos.length > 0 ? (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-2">
              <p className="px-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Added in this browser
              </p>
              <ul className="space-y-0.5">
                {customRepos.map((repo) => (
                  <li
                    key={repo.slug}
                    className="flex items-center gap-2 rounded-md px-1.5 py-0.5"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {repo.slug}
                    </span>
                    <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
                      not indexed
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${repo.slug}`}
                      title={`Remove ${repo.slug}`}
                      onClick={() => {
                        removeRepo(repo.slug);
                        onRemoved(repo.slug);
                      }}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              <PlusIcon aria-hidden="true" />
              Add repository
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
