"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { AnswerPanel } from "@/components/answer/answer-panel";
import { RefusalState } from "@/components/answer/refusal-state";
import { AuroraBackdrop } from "@/components/ask/aurora-backdrop";
import { AskComposer } from "@/components/ask/ask-composer";
import { ExampleQuestions } from "@/components/ask/example-questions";
import { ThinkingIndicator } from "@/components/chat/thinking-indicator";
import { RepoNotIndexed } from "@/components/repo/not-indexed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, findRepo } from "@/lib/api";
import {
  addTurn,
  createChat,
  failTurn,
  resolveTurn,
  setActiveChat,
  useChatStore,
} from "@/lib/chat/store";
import type { ChatTurn } from "@/lib/chat/store";
import { exampleQuestionsFor } from "@/lib/mock";
import { useLocalProfile } from "@/lib/local/profile";

/**
 * Even the mock transport resolves quickly. A short floor keeps the thinking
 * state perceptible instead of flashing, which is what real chat UIs do.
 */
const MIN_THINKING_MS = 900;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function UserTurn({ turn }: { turn: ChatTurn }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-3xl rounded-br-md border border-border/60 bg-card px-4 py-3 shadow-lift">
        <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
          {turn.repo}
        </p>
        <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
          {turn.question}
        </p>
      </div>
    </div>
  );
}

function AnswerError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <TriangleAlertIcon
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium text-destructive">
            Could not retrieve an answer
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            <RotateCcwIcon aria-hidden="true" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

function AssistantTurn({
  turn,
  onRetry,
}: {
  turn: ChatTurn;
  onRetry: (question: string) => void;
}) {
  if (turn.response) {
    if (turn.response.status === "refused" && turn.response.refusal) {
      return (
        <RefusalState
          question={turn.question}
          refusal={turn.response.refusal}
          suggestions={exampleQuestionsFor(turn.repo)
            .filter((question) => question !== turn.question)
            .slice(0, 3)}
          onTryExample={onRetry}
        />
      );
    }
    return <AnswerPanel response={turn.response} />;
  }

  if (turn.error) {
    return (
      <AnswerError message={turn.error} onRetry={() => onRetry(turn.question)} />
    );
  }

  return <ThinkingIndicator />;
}

function ConversationSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6" aria-busy="true">
      <Skeleton className="ml-auto h-14 w-2/3 rounded-2xl" />
      <Skeleton className="mt-3 h-40 w-full rounded-xl" />
    </div>
  );
}

/**
 * A chat session. Keyed on the URL's chat id (and on the sidebar's
 * "new chat" nonce) so opening another conversation or starting fresh resets
 * the composer without any state-setting effects.
 */
function AskSession({
  initialChatId,
  initialQuestion,
}: {
  initialChatId?: string;
  initialQuestion?: string;
}) {
  const { chats, hydrated } = useChatStore();
  const { profile, update, hydrated: profileHydrated } = useLocalProfile();
  const [chatId, setChatId] = useState<string | null>(initialChatId ?? null);
  const [value, setValue] = useState("");
  const pendingRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastTurnRef = useRef<HTMLDivElement | null>(null);

  const chat = chats.find((item) => item.id === chatId) ?? null;
  const repo = profile.default_repo;
  const repoOption = findRepo(repo);
  const indexed = Boolean(repoOption?.indexed);
  const lastTurn = chat?.turns.at(-1);
  const pending = Boolean(lastTurn && lastTurn.response === null && !lastTurn.error);

  // Mirror the open conversation into the store so the sidebar can highlight it.
  useEffect(() => {
    setActiveChat(chatId);
  }, [chatId]);

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || pendingRef.current) return;
      if (!indexed) {
        toast.error("This repository is not indexed yet");
        return;
      }

      pendingRef.current = true;
      setValue("");

      let targetChatId = chatId;
      let turnId: string | null = null;

      if (targetChatId) {
        turnId = addTurn(targetChatId, question, repo);
      } else {
        const created = createChat(repo, question);
        targetChatId = created.chat.id;
        turnId = created.turnId;
        setChatId(targetChatId);
        setActiveChat(targetChatId);
        // Shareable and reload-safe, without a server navigation mid-answer.
        window.history.replaceState(null, "", `/?chat=${targetChatId}`);
      }

      if (!targetChatId || !turnId) {
        pendingRef.current = false;
        return;
      }

      try {
        const [response] = await Promise.all([
          api.ask({
            question,
            repo,
            include_graph_path: true,
            max_evidence_items: 8,
          }),
          new Promise((resolve) => setTimeout(resolve, MIN_THINKING_MS)),
        ]);
        resolveTurn(targetChatId, turnId, response);
      } catch (error) {
        failTurn(
          targetChatId,
          turnId,
          error instanceof Error ? error.message : "Unexpected error",
        );
        toast.error("The answer service could not be reached");
      } finally {
        pendingRef.current = false;
      }
    },
    [chatId, repo, indexed],
  );

  // Questions arriving from a deep link (?q=) are asked once on mount — after
  // the stored profile has loaded, so the question goes to the repository the
  // page was rendered for rather than the server-side default.
  const askedInitial = useRef(false);
  useEffect(() => {
    if (!profileHydrated) return;
    if (!initialQuestion || askedInitial.current) return;
    askedInitial.current = true;
    void send(initialQuestion);
  }, [initialQuestion, send, profileHydrated]);

  const turnCount = chat?.turns.length ?? 0;
  useEffect(() => {
    if (!chatId) return;
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    if (pending) {
      endRef.current?.scrollIntoView({ behavior, block: "end" });
      return;
    }
    // Once the answer lands, keep its opening in view so the staggered text
    // reveal is actually seen instead of being pushed above the viewport.
    lastTurnRef.current?.scrollIntoView({ behavior, block: "start" });
  }, [chatId, turnCount, pending]);

  if (chatId && !chat && !hydrated) {
    return <ConversationSkeleton />;
  }

  if (chatId && !chat) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <p className="font-heading text-lg font-semibold">
          Conversation not found
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been deleted, or it lives in a different browser. Start a
          new chat to ask again.
        </p>
        <Button
          render={<Link href="/" />}
          nativeButton={false}
          variant="outline"
        >
          Start a new chat
        </Button>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="relative flex w-full flex-1 flex-col">
        <AuroraBackdrop />
        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10 sm:py-14">
          <div className="text-center">
            <p className="inline-flex items-center rounded-full border border-border/60 bg-card/70 px-2.5 py-1 font-mono text-[11px] tracking-wide text-primary uppercase shadow-lift backdrop-blur-sm">
              {repo}
            </p>
            <h1 className="mt-3 font-heading text-2xl font-semibold text-balance text-foreground sm:text-3xl">
              Ask why the code works this way
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Every answer is grounded in the pull requests, reviews and commits
              that decided it — and refused when the evidence does not support a
              claim.
            </p>
          </div>

          <AskComposer
            className="mt-7"
            value={value}
            onValueChange={setValue}
            onSubmit={(question) => void send(question)}
            repo={repo}
            onRepoChange={(slug) => update({ default_repo: slug })}
            busy={pending}
            autoFocus
          />

          {indexed ? (
            <ExampleQuestions
              className="mt-7"
              label="Try an example"
              labelClassName="text-foreground/80"
              align="center"
              tone="onAurora"
              questions={exampleQuestionsFor(repo)}
              onSelect={(question) => void send(question)}
              disabled={pending}
            />
          ) : (
            <RepoNotIndexed repo={repo} className="mt-7" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {pending ? <AuroraBackdrop /> : null}
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
        <div className="flex-1 space-y-8 py-6">
          {chat.turns.map((turn, index) => (
            <div
              key={turn.id}
              ref={index === chat.turns.length - 1 ? lastTurnRef : undefined}
              className="space-y-3"
            >
              <UserTurn turn={turn} />
              <AssistantTurn turn={turn} onRetry={(question) => void send(question)} />
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="sticky bottom-3 z-20">
          <AskComposer
            value={value}
            onValueChange={setValue}
            onSubmit={(question) => void send(question)}
            repo={repo}
            onRepoChange={(slug) => update({ default_repo: slug })}
            busy={pending}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The Ask screen. A nonce from the store lets the sidebar's "New chat" remount
 * the session while the user is already on `/` (where a navigation would be a
 * no-op).
 */
export function AskWorkspace({
  initialChatId,
  initialQuestion,
}: {
  initialChatId?: string;
  initialQuestion?: string;
}) {
  const { newChatNonce } = useChatStore();

  return (
    <AskSession
      key={`${initialChatId ?? initialQuestion ?? "new"}:${newChatNonce}`}
      initialChatId={initialChatId}
      initialQuestion={initialQuestion}
    />
  );
}
