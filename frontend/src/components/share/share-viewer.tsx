"use client";

/**
 * Read-only viewer for a shared chat link (/share/<id>).
 *
 * The backend enforces the access rule: public links render for
 * anyone; private links render only for the owner and whitelisted
 * handles — everyone else gets the matching explanation state
 * (log in / not whitelisted / link gone).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GlobeIcon,
  LockIcon,
  LogInIcon,
  MessageSquareIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { AnswerMarkdown } from "@/components/answer/answer-markdown";
import { Logo } from "@/components/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth, handleFor } from "@/lib/auth/store";
import {
  ShareApiError,
  sharesApi,
  type SharedChatView,
} from "@/lib/shares/api";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; share: SharedChatView }
  | { kind: "error"; code: string; detail: string };

export function ShareViewer({ id }: { id: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    sharesApi
      .view(id)
      .then((share) => {
        if (!cancelled) setState({ kind: "ready", share });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ShareApiError) {
          setState({ kind: "error", code: error.code, detail: error.message });
        } else {
          setState({
            kind: "error",
            code: "error",
            detail: "Could not load this chat.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-run when the signed-in user changes (e.g. after logging in in
    // another tab) or when the retry button bumps the attempt.
  }, [id, user, attempt]);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between">
        <Logo />
        <Link
          href="/"
          className="text-sm font-medium text-primary hover:underline"
        >
          Open WhyCode
        </Link>
      </header>

      {state.kind === "loading" && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Loading the shared chat…
        </p>
      )}

      {state.kind === "error" && (
        <div className="mx-auto w-full max-w-md rounded-3xl border border-border/50 bg-card/80 p-6 text-center shadow-floating backdrop-blur-sm">
          {state.code === "login_required" ? (
            <>
              <LockIcon className="mx-auto mb-3 size-8 text-primary" />
              <h1 className="font-heading text-lg font-semibold">
                This chat is private
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Log in with a whitelisted account to view it.
              </p>
              <Link
                href="/login"
                className={cn(buttonVariants(), "mt-5 w-full")}
              >
                <LogInIcon className="size-4" />
                Log in
              </Link>
              <p className="mt-3 text-xs text-muted-foreground">
                After logging in, open this link again.
              </p>
            </>
          ) : state.code === "not_whitelisted" ? (
            <>
              <ShieldAlertIcon className="mx-auto mb-3 size-8 text-primary" />
              <h1 className="font-heading text-lg font-semibold">
                You&rsquo;re not on the whitelist
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {state.detail}
              </p>
              {user && (
                <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 font-mono text-xs text-primary">
                  Your handle: @{handleFor(user)}
                </p>
              )}
              <Button
                variant="outline"
                className="mt-5 w-full"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Check again
              </Button>
            </>
          ) : (
            <>
              <TriangleAlertIcon className="mx-auto mb-3 size-8 text-primary" />
              <h1 className="font-heading text-lg font-semibold">
                This link doesn&rsquo;t work
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {state.code === "not_found"
                  ? "The owner may have stopped sharing it, or the link is wrong."
                  : state.detail}
              </p>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "outline" }), "mt-5 w-full")}
              >
                Go to WhyCode
              </Link>
            </>
          )}
        </div>
      )}

      {state.kind === "ready" && (
        <>
          <div className="mb-6 rounded-3xl border border-border/50 bg-card/80 p-5 shadow-floating backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 font-mono text-[11px] font-medium text-primary">
                <MessageSquareIcon className="size-3" />
                {state.share.repo || "repository"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {state.share.visibility === "private" ? (
                  <LockIcon className="size-3" />
                ) : (
                  <GlobeIcon className="size-3" />
                )}
                {state.share.visibility === "private"
                  ? "Private link"
                  : "Public link"}
              </span>
            </div>
            <h1 className="mt-3 font-heading text-xl font-semibold break-words">
              {state.share.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Shared by {state.share.owner_name} (@
              {state.share.owner_handle}) · read-only
            </p>
          </div>

          <div className="flex flex-col gap-8">
            {state.share.turns.map((turn, index) => (
              <article key={index} className="flex flex-col gap-3">
                <div className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary/15 px-4 py-3">
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {turn.question}
                  </p>
                  {turn.attachments
                    .filter((a) => a.kind === "image" && a.dataUrl)
                    .map((a) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={a.name}
                        src={a.dataUrl}
                        alt={a.name}
                        className="mt-2 max-h-56 rounded-lg border border-border/40 object-contain"
                      />
                    ))}
                </div>
                <div className="rounded-3xl border border-border/40 bg-card/70 p-5 backdrop-blur-sm">
                  {turn.error ? (
                    <p className="text-sm text-destructive">{turn.error}</p>
                  ) : turn.answer ? (
                    <AnswerMarkdown>{turn.answer}</AnswerMarkdown>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No answer was recorded for this question.
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <footer className="mt-10 pb-4 text-center text-xs text-muted-foreground">
            Shared with WhyCode · Answers are grounded in the repository&rsquo;s
            recorded decisions.
          </footer>
        </>
      )}
    </div>
  );
}
