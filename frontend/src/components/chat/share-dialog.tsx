"use client";

/**
 * Share dialog: publish the current chat behind a link.
 *
 * - Public link: anyone who has it can view the chat.
 * - Private link: only the owner and the whitelisted @handles can —
 *   the owner adds handles here; the backend enforces the list.
 *
 * Sharing needs an account (the whitelist is made of account handles,
 * and only the owner can change or revoke the link), so guests are
 * asked to log in first.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  LinkIcon,
  LockIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/store";
import { useChatStore } from "@/lib/chat/store";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import {
  ShareApiError,
  normalizeHandleInput,
  shareUrl,
  sharesApi,
  type ShareMeta,
  type ShareVisibility,
} from "@/lib/shares/api";
import { cn } from "@/lib/utils";

export function ShareDialog({
  chatId,
  open,
  onOpenChange,
}: {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { chats } = useChatStore();
  const chat = chats.find((c) => c.id === chatId);

  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [visibility, setVisibility] = useState<ShareVisibility>("public");
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load the chat's existing share (if any) each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setCopied(false);
    if (!user) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    sharesApi
      .myShare(chatId)
      .then((found) => {
        if (cancelled) return;
        setMeta(found);
        setVisibility(found.visibility);
        setWhitelist(found.whitelist ?? []);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, chatId, user]);

  const addHandle = useCallback(() => {
    const handle = normalizeHandleInput(draft);
    if (!draft.trim()) return;
    setWhitelist((current) =>
      current.includes(handle) ? current : [...current, handle],
    );
    setDraft("");
    hapticSelection();
  }, [draft]);

  const publish = useCallback(async () => {
    if (!chat) return;
    setBusy(true);
    try {
      const saved = await sharesApi.publish({
        chat,
        visibility,
        whitelist: visibility === "private" ? whitelist : [],
      });
      setMeta(saved);
      setWhitelist(saved.whitelist ?? []);
      hapticSuccess();
      toast.success(meta ? "Share link updated" : "Share link created");
    } catch (error) {
      toast.error(
        error instanceof ShareApiError
          ? error.message
          : "Could not create the share link.",
      );
    } finally {
      setBusy(false);
    }
  }, [chat, visibility, whitelist, meta]);

  const stopSharing = useCallback(async () => {
    if (!meta) return;
    setBusy(true);
    try {
      await sharesApi.unpublish(meta.id);
      setMeta(null);
      setWhitelist([]);
      toast.success("Share link removed — it no longer works");
    } catch {
      toast.error("Could not remove the share link.");
    } finally {
      setBusy(false);
    }
  }, [meta]);

  const copyLink = useCallback(async () => {
    if (!meta) return;
    try {
      await navigator.clipboard.writeText(shareUrl(meta.id));
      setCopied(true);
      hapticSelection();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — select the link and copy it manually.");
    }
  }, [meta]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this chat</DialogTitle>
          <DialogDescription>
            Anyone you give the link to sees a read-only copy of this
            conversation.
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Log in to share chats. Private links are restricted by
              account handle, so sharing needs an account.
            </p>
            <Link
              href="/login"
              onClick={() => onOpenChange(false)}
              className={cn(buttonVariants(), "w-full")}
            >
              Log in to share
            </Link>
          </div>
        ) : !loaded ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Checking this chat&rsquo;s share settings…
          </p>
        ) : (
          <div className="space-y-4">
            {/* Visibility choices */}
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Link type">
              <button
                type="button"
                role="radio"
                aria-checked={visibility === "public"}
                onClick={() => {
                  setVisibility("public");
                  hapticSelection();
                }}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-all",
                  visibility === "public"
                    ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_var(--color-primary)]"
                    : "border-border/60 bg-card hover:border-primary/30",
                )}
              >
                <GlobeIcon className="mb-1.5 size-4 text-primary" />
                <span className="block text-sm font-medium">Public link</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Anyone with the link can view
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={visibility === "private"}
                onClick={() => {
                  setVisibility("private");
                  hapticSelection();
                }}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-all",
                  visibility === "private"
                    ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_var(--color-primary)]"
                    : "border-border/60 bg-card hover:border-primary/30",
                )}
              >
                <LockIcon className="mb-1.5 size-4 text-primary" />
                <span className="block text-sm font-medium">Private link</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Only whitelisted handles can view
                </span>
              </button>
            </div>

            {/* Whitelist editor (private only) */}
            {visibility === "private" && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">
                  Who can open this link
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                      @
                    </span>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addHandle();
                        }
                      }}
                      placeholder="username or handle"
                      aria-label="Add a whitelisted handle"
                      className="w-full rounded-xl border border-border/60 bg-background py-2 pr-3 pl-7 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={addHandle}>
                    <PlusIcon className="size-4" />
                    Add
                  </Button>
                </div>
                {whitelist.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {whitelist.map((handle) => (
                      <span
                        key={handle}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        @{handle}
                        <button
                          type="button"
                          aria-label={`Remove @${handle}`}
                          onClick={() =>
                            setWhitelist((current) =>
                              current.filter((h) => h !== handle),
                            )
                          }
                          className="rounded-full p-0.5 hover:bg-primary/20"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No one yet — only you can open a private link with an
                    empty whitelist.
                  </p>
                )}
              </div>
            )}

            {/* Existing link */}
            {meta && (
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
                <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">
                  {shareUrl(meta.id)}
                </span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
                >
                  {copied ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    <CopyIcon className="size-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button onClick={publish} disabled={busy || !chat} className="flex-1">
                {busy
                  ? "Working…"
                  : meta
                    ? "Update share link"
                    : "Create share link"}
              </Button>
              {meta && (
                <Button
                  variant="outline"
                  onClick={stopSharing}
                  disabled={busy}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2Icon className="size-4" />
                  Stop sharing
                </Button>
              )}
            </div>
            {meta && (
              <p className="text-center text-[11px] text-muted-foreground">
                Updating re-publishes the chat&rsquo;s current messages
                under the same link.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
