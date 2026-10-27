"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RotateCcwIcon, TriangleAlertIcon, ShareIcon, MoreVerticalIcon, PencilIcon, DownloadIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AnswerPanel } from "@/components/answer/answer-panel";
import { RefusalState } from "@/components/answer/refusal-state";
import { AuroraBackdrop } from "@/components/ask/aurora-backdrop";
import { AskComposer } from "@/components/ask/ask-composer";
import { ExampleQuestions } from "@/components/ask/example-questions";
import { InputToolbar } from "@/components/chat/input-toolbar";
import { ThinkingIndicator } from "@/components/chat/thinking-indicator";
import { RepoNotIndexed } from "@/components/repo/not-indexed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonAvatar } from "@/components/people/person-avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, findRepo } from "@/lib/api";
import {
  addTurn,
  createChat,
  deleteChat,
  failTurn,
  resolveTurn,
  setActiveChat,
  updateChatTitle,
  useChatStore,
} from "@/lib/chat/store";
import type { ChatTurn } from "@/lib/chat/store";
import { exampleQuestionsFor } from "@/lib/mock";
import { useLocalProfile } from "@/lib/local/profile";
import { ModelPicker } from "@/components/chat/model-picker";
import { TokenUsageChip } from "@/components/chat/token-usage-chip";
import { getClientId } from "@/lib/models/api";
import { refreshUsage, useModelSelection } from "@/lib/models/store";

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
  const { profile } = useLocalProfile();
  return (
    <div className="flex justify-end">
      <div className="flex items-start gap-3 max-w-[70%]">
        <div className="rounded-2xl rounded-br-md bg-card px-5 py-3 shadow-neumorph border border-border/40">
          <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            {turn.repo}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {turn.question}
          </p>
        </div>
        <PersonAvatar
          login={profile.handle || profile.display_name}
          className="mt-1 size-8 shadow-floating"
        />
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
 * Conversation header bar matching the WhyCode reference.
 * Shows the title with Share button and three-dot menu.
 */
function ConversationHeader({ title }: { title: string }) {
  const [shareClicked, setShareClicked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [prevTitle, setPrevTitle] = useState(title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeId, chats } = useChatStore();
  const router = useRouter();

  if (prevTitle !== title) {
    setPrevTitle(title);
    setEditedTitle(title);
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveTitle = useCallback(() => {
    if (activeId && editedTitle.trim() && editedTitle !== title) {
      updateChatTitle(activeId, editedTitle.trim());
    }
    setIsEditing(false);
  }, [activeId, editedTitle, title]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setShareClicked(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setShareClicked(false), 2000);
  }, []);

  const handleExport = useCallback(() => {
    const chat = chats.find((c) => c.id === activeId);
    if (!chat) return;
    const lines: string[] = [`# ${chat.title}`, ""];
    for (const turn of chat.turns) {
      lines.push("## You", "", turn.question, "", "## WhyAgent", "");
      if (turn.response) lines.push(turn.response.answer);
      else if (turn.error) lines.push(`_Error: ${turn.error}_`);
      else lines.push("_No answer yet._");
      lines.push("", "---", "");
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${
      chat.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "whycode-chat"
    }.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Chat exported as Markdown");
  }, [activeId, chats]);

  const handleDelete = useCallback(() => {
    if (!activeId) return;
    deleteChat(activeId);
    setShowDeleteDialog(false);
    toast.success("Chat deleted");
    router.push("/");
  }, [activeId, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setEditedTitle(title);
      setIsEditing(false);
    }
  };

  return (
    <>
    <div className="sticky top-0 z-30 flex items-center justify-center px-4 py-4">
      <div className="flex items-center gap-4 rounded-2xl bg-card/60 backdrop-blur-2xl shadow-floating border border-white/20 dark:border-white/10 px-6 py-3 animate-scale hover:shadow-floating-lg transition-all duration-300 relative overflow-hidden">
        {/* Liquid glass shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
        
        {/* Chat Title - Editable */}
        <div className="flex-1 min-w-0 max-w-md relative z-10">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-sm font-medium text-foreground outline-none border-b border-primary/40 px-1 py-0.5"
              maxLength={100}
            />
          ) : (
            <h2 
              className="text-sm font-medium text-foreground truncate cursor-text hover:text-primary transition-colors duration-200"
              onDoubleClick={() => setIsEditing(true)}
              title="Double-click to edit"
            >
              {title}
            </h2>
          )}
        </div>

        {/* Share Button with enhanced hover */}
        <button
          onClick={handleShare}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all duration-300 hover:scale-105 active:scale-95 relative z-10",
            shareClicked 
              ? "bg-primary/30 text-primary shadow-[0_0_20px_rgba(232,160,48,0.3)]" 
              : "bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-primary backdrop-blur-sm"
          )}
          title="Share chat"
        >
          <ShareIcon className="size-3.5" />
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* More options: portaled menu, so the pill's overflow clipping and
            neighbouring stacking contexts can never hide it. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative z-10 flex size-9 items-center justify-center rounded-xl bg-white/5 text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white/10 hover:text-primary active:scale-95"
            aria-label="More options"
            title="More options"
          >
            <MoreVerticalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <PencilIcon className="size-4" />
              Rename chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShare}>
              <ShareIcon className="size-4" />
              Share chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExport}>
              <DownloadIcon className="size-4" />
              Export as Markdown
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2Icon className="size-4" />
              Delete chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this chat?</DialogTitle>
          <DialogDescription>
            “{title}” will be permanently deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function cn(...args: (string | boolean | undefined)[]) {
  return args.filter(Boolean).join(" ");
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
  const { selectedId: selectedModelId, usage } = useModelSelection();
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
            client_id: getClientId(),
            model_id: selectedModelId,
          }),
          new Promise((resolve) => setTimeout(resolve, MIN_THINKING_MS)),
        ]);
        resolveTurn(targetChatId, turnId, response);
        void refreshUsage();
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
    [chatId, repo, indexed, selectedModelId],
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

          {/* Same model picker and real usage meter as the conversation
              composer, so the active model is visible before the first
              question too. */}
          <div className="mt-3 flex items-center justify-between px-1">
            <ModelPicker disabled={pending} />
            {usage ? (
              <TokenUsageChip
                used={usage.used_tokens}
                total={usage.context_tokens}
              />
            ) : null}
          </div>

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
      
      {/* Conversation header */}
      <ConversationHeader title={chat.title} />
      
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
        <div className="flex-1 space-y-6 py-6">
          {chat.turns.map((turn, index) => (
            <div
              key={turn.id ? `${turn.id}-${index}` : `turn-${index}`}
              ref={index === chat.turns.length - 1 ? lastTurnRef : undefined}
              className="space-y-4"
            >
              <UserTurn turn={turn} />
              <AssistantTurn turn={turn} onRetry={(question) => void send(question)} />
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="sticky bottom-3 z-20">
          <InputToolbar
            value={value}
            onChange={setValue}
            onSubmit={() => {
              if (value.trim()) void send(value);
            }}
            disabled={pending}
            contextTokens={
              usage
                ? { used: usage.used_tokens, total: usage.context_tokens }
                : null
            }
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
