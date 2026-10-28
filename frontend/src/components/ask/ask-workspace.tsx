"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RotateCcwIcon, TriangleAlertIcon, ShareIcon, MoreVerticalIcon, PencilIcon, DownloadIcon, Trash2Icon, NetworkIcon, FileTextIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AnswerPanel } from "@/components/answer/answer-panel";
import { RefusalState } from "@/components/answer/refusal-state";
import { AuroraBackdrop } from "@/components/ask/aurora-backdrop";
import { AskComposer } from "@/components/ask/ask-composer";
import { ExampleQuestions } from "@/components/ask/example-questions";
import { InputToolbar } from "@/components/chat/input-toolbar";
import { ShareDialog } from "@/components/chat/share-dialog";
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
import { graphForResponse, openGraphViewer } from "@/lib/graph";
import { hapticError, hapticLight, hapticSelection, hapticSuccess } from "@/lib/haptics";
import {
  addIncognitoTurn,
  addTurn,
  createChat,
  createIncognitoChat,
  deleteChat,
  failIncognitoTurn,
  failTurn,
  resolveIncognitoTurn,
  resolveTurn,
  setActiveChat,
  updateChatTitle,
  useChatStore,
} from "@/lib/chat/store";
import { useIncognitoMode } from "@/lib/chat/incognito";
import type { ChatTurn, TurnAttachment } from "@/lib/chat/store";
import {
  composeQuestionWithAttachments,
  type ComposerAttachment,
} from "@/lib/attachments";
import { exampleQuestionsFor } from "@/lib/mock";
import { useIdentity } from "@/lib/identity";
import { useLocalProfile } from "@/lib/local/profile";
import { ModeSwitch } from "@/components/chat/mode-switch";
import { ModelPicker } from "@/components/chat/model-picker";
import { TokenUsageChip } from "@/components/chat/token-usage-chip";
import { getMode } from "@/lib/modes/store";
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
  const identity = useIdentity();
  const attachments = turn.attachments ?? [];
  return (
    <div className="flex justify-end">
      <div className="flex items-start gap-3 max-w-[70%]">
        <div className="flex min-w-0 flex-col items-end gap-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {attachments.map((item) =>
                item.kind === "image" && item.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={item.name}
                    src={item.dataUrl}
                    alt={item.name}
                    title={item.name}
                    className="max-h-44 max-w-full rounded-2xl border border-border/40 object-cover shadow-neumorph"
                  />
                ) : (
                  <span
                    key={item.name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs text-foreground shadow-neumorph"
                  >
                    <FileTextIcon className="size-3.5 text-primary" />
                    <span className="max-w-44 truncate">{item.name}</span>
                  </span>
                ),
              )}
            </div>
          )}
          <div className="rounded-2xl rounded-br-md bg-card px-5 py-3 shadow-neumorph border border-border/40">
            <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              {turn.repo}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {turn.question}
            </p>
          </div>
        </div>
        <PersonAvatar
          login={identity.handle || identity.name}
          className="mt-1 size-8 shrink-0 shadow-floating"
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

  return <ThinkingIndicator mode={turn.mode} />;
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [prevTitle, setPrevTitle] = useState(title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [editWidth, setEditWidth] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { activeId, chats, incognitoChat } = useChatStore();
  const isIncognitoChat = Boolean(
    activeId && incognitoChat?.id === activeId,
  );
  const activeChat =
    chats.find((chat) => chat.id === activeId) ??
    (isIncognitoChat ? incognitoChat : null);
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

  // Renaming must not change the header box's size: the pill is
  // shrink-to-fit, and a bare input is narrower than the title it
  // replaces — so the title's rendered width is measured on entering
  // edit mode and the input is held to exactly it.
  const beginEdit = useCallback(() => {
    setEditWidth(titleRef.current?.offsetWidth ?? null);
    setIsEditing(true);
  }, []);

  const handleSaveTitle = useCallback(() => {
    if (activeId && editedTitle.trim() && editedTitle !== title) {
      updateChatTitle(activeId, editedTitle.trim());
    }
    setIsEditing(false);
    setEditWidth(null);
  }, [activeId, editedTitle, title]);

  const handleShare = useCallback(() => {
    if (isIncognitoChat) {
      toast.error("Incognito chats can't be shared");
      return;
    }
    setShowShareDialog(true);
  }, [isIncognitoChat]);

  const handleExport = useCallback(() => {
    const chat = activeChat;
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
  }, [activeChat]);

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
      setEditWidth(null);
    }
  };

  return (
    <>
    <div className="sticky top-0 z-30 flex items-center justify-center px-4 py-4">
      <div className="flex items-center gap-4 rounded-2xl bg-card/60 backdrop-blur-2xl shadow-floating border border-white/20 dark:border-white/10 px-6 py-3 animate-scale hover:shadow-floating-lg transition-all duration-300 relative overflow-hidden">
        {/* Liquid glass shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
        
        {/* Chat Title - Editable */}
        <div
          className="flex-1 min-w-0 max-w-md relative z-10"
          style={isEditing && editWidth ? { width: editWidth, flex: "none" } : undefined}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-sm font-medium text-foreground outline-none border-b border-primary/40 px-0 py-0"
              maxLength={100}
            />
          ) : (
            <h2
              ref={titleRef}
              className="text-sm font-medium text-foreground truncate cursor-text hover:text-primary transition-colors duration-200"
              onDoubleClick={beginEdit}
              title="Double-click to edit"
            >
              {title}
            </h2>
          )}
        </div>

        {/* Share Button with enhanced hover */}
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all duration-300 hover:scale-105 active:scale-95 relative z-10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-primary backdrop-blur-sm"
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
            <DropdownMenuItem onClick={beginEdit}>
              <PencilIcon className="size-4" />
              Rename chat
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

    {activeId && !isIncognitoChat && (
      <ShareDialog
        chatId={activeId}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
      />
    )}

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
  const { chats, incognitoChat, hydrated } = useChatStore();
  const { enabled: incognitoEnabled } = useIncognitoMode();
  const { profile, update, hydrated: profileHydrated } = useLocalProfile();
  const { selectedId: selectedModelId, usage } = useModelSelection();
  const [chatId, setChatId] = useState<string | null>(initialChatId ?? null);
  const [value, setValue] = useState("");
  const pendingRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastTurnRef = useRef<HTMLDivElement | null>(null);

  // Saved history is inaccessible while incognito is on; the only chat
  // this session may show then is the ephemeral incognito conversation.
  const chat = incognitoEnabled
    ? incognitoChat?.id === chatId
      ? incognitoChat
      : null
    : (chats.find((item) => item.id === chatId) ?? null);
  const repo = profile.default_repo;
  const repoOption = findRepo(repo);
  const indexed = Boolean(repoOption?.indexed);
  const lastTurn = chat?.turns.at(-1);
  const pending = Boolean(lastTurn && lastTurn.response === null && !lastTurn.error);
  const sessionGraph = lastTurn
    ? graphForResponse(lastTurn.response, lastTurn.id)
    : null;

  // Mirror the open conversation into the store so the sidebar can highlight it.
  useEffect(() => {
    setActiveChat(chatId);
  }, [chatId]);

  // Entering incognito closes the saved conversation; leaving it drops
  // the private one (the panel toggle discards it). Either transition
  // returns this session to the entrance with a clean URL.
  const wasIncognito = useRef(incognitoEnabled);
  useEffect(() => {
    if (wasIncognito.current === incognitoEnabled) return;
    wasIncognito.current = incognitoEnabled;
    setChatId(null);
    if (window.location.search.includes("chat=")) {
      window.history.replaceState(null, "", "/");
    }
  }, [incognitoEnabled]);

  const send = useCallback(
    async (raw: string, composerAttachments: ComposerAttachment[] = []) => {
      const typed = raw.trim();
      if ((!typed && composerAttachments.length === 0) || pendingRef.current)
        return;
      if (!indexed) {
        toast.error("This repository is not indexed yet");
        return;
      }

      pendingRef.current = true;
      setValue("");
      const privateMode = incognitoEnabled;
      const mode = getMode();
      // The turn shows the question as typed; the backend receives it
      // with the text attachments inlined as context.
      const question = typed || "Explain the attached file(s).";
      const sentQuestion = composeQuestionWithAttachments(
        question,
        composerAttachments,
      );
      const turnAttachments: TurnAttachment[] = composerAttachments.map(
        (item) => ({
          name: item.name,
          kind: item.kind,
          size: item.size,
          ...(item.kind === "image" ? { dataUrl: item.content } : {}),
        }),
      );

      // Reuse only the conversation this session is actually showing:
      // the ephemeral one in incognito mode, a saved one otherwise.
      let targetChatId = chat?.id ?? null;
      let turnId: string | null = null;

      if (targetChatId) {
        turnId = privateMode
          ? addIncognitoTurn(targetChatId, question, repo, mode, turnAttachments)
          : addTurn(targetChatId, question, repo, mode, turnAttachments);
      } else {
        const created = privateMode
          ? createIncognitoChat(repo, question, mode, turnAttachments)
          : createChat(repo, question, mode, turnAttachments);
        targetChatId = created.chat.id;
        turnId = created.turnId;
        setChatId(targetChatId);
        setActiveChat(targetChatId);
        // Saved chats get a shareable, reload-safe URL. Incognito chats
        // deliberately do not — the URL stays clean and a reload finds
        // nothing, because nothing was stored.
        window.history.replaceState(
          null,
          "",
          privateMode ? "/" : `/?chat=${targetChatId}`,
        );
      }

      if (!targetChatId || !turnId) {
        pendingRef.current = false;
        return;
      }

      hapticLight();
      try {
        const [response] = await Promise.all([
          api.ask({
            question: sentQuestion,
            repo,
            include_graph_path: true,
            max_evidence_items: 8,
            client_id: getClientId(),
            model_id: selectedModelId,
            mode,
          }),
          new Promise((resolve) => setTimeout(resolve, MIN_THINKING_MS)),
        ]);
        if (privateMode) resolveIncognitoTurn(targetChatId, turnId, response);
        else resolveTurn(targetChatId, turnId, response);
        hapticSuccess();
        void refreshUsage();
      } catch (error) {
        hapticError();
        const message =
          error instanceof Error ? error.message : "Unexpected error";
        if (privateMode) failIncognitoTurn(targetChatId, turnId, message);
        else failTurn(targetChatId, turnId, message);
        toast.error("The answer service could not be reached");
      } finally {
        pendingRef.current = false;
      }
    },
    [chat, repo, indexed, selectedModelId, incognitoEnabled],
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

  // While incognito is on (or just after a private chat was dropped) a
  // stale chat id means "no open conversation", not a missing one —
  // fall through to the entrance instead of the not-found screen.
  if (chatId && !chat && !incognitoEnabled && !chatId.startsWith("incognito_")) {
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

          {/* Same mode switch, model picker and real usage meter as the
              conversation composer, so the mode and model are visible
              before the first question too. */}
          <div className="mt-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <ModeSwitch disabled={pending} />
              <ModelPicker disabled={pending} />
            </div>
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
          {/* Mobile / narrow screens have no right rail, so the graph
              gets a button right above the chatbox — only when the
              latest reply actually carries a graph. */}
          {sessionGraph && (
            <div
              className="mb-2 flex justify-center min-[1400px]:hidden"
              style={{ animation: "why-fade-in 300ms ease both" }}
            >
              <button
                type="button"
                onClick={() => {
                  openGraphViewer(sessionGraph);
                  hapticSelection();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/95 px-4 py-2 text-xs font-medium text-foreground shadow-neumorph backdrop-blur transition active:scale-95"
              >
                <NetworkIcon className="size-4 text-primary" aria-hidden="true" />
                View Graph
                <span className="text-muted-foreground">
                  {sessionGraph.graph.nodes.length} nodes
                </span>
              </button>
            </div>
          )}
          <InputToolbar
            value={value}
            onChange={setValue}
            onSubmit={(composerAttachments) => {
              void send(value, composerAttachments);
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
