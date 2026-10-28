"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquareIcon, Trash2Icon, MoreVerticalIcon, Trash2Icon as TrashAllIcon, EyeOffIcon, XIcon } from "lucide-react";
import {
  useChatStore,
  deleteChat,
  setActiveChat,
  clearChats,
  discardIncognitoChat,
} from "@/lib/chat/store";
import { useIncognitoMode, setIncognitoMode } from "@/lib/chat/incognito";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ConversationsPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const { chats, activeId } = useChatStore();
  const { enabled: isIncognito } = useIncognitoMode();
  const onChatsRoute = pathname === "/";
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleToggleIncognito = () => {
    if (isIncognito) discardIncognitoChat();
    setIncognitoMode(!isIncognito);
  };

  const handleClearAll = () => {
    if (confirmText.toLowerCase() === "confirm") {
      clearChats();
      setShowClearDialog(false);
      setConfirmText("");
      router.push("/");
    }
  };

  return (
    <>
      <div
        className="flex min-h-0 w-full flex-1 flex-col gap-4"
        aria-label="Conversations"
      >
        {/* Header Bubble */}
        <div className="rounded-2xl bg-card/95 backdrop-blur-sm border border-border/40 px-4 py-3 flex items-center justify-between shadow-none">
          <h2 className="text-sm font-medium text-foreground">
            Conversations
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Conversation options"
            >
              <MoreVerticalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleToggleIncognito}>
                <EyeOffIcon className="size-4" />
                {isIncognito ? "Exit incognito" : "Incognito mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setShowClearDialog(true)}
              >
                <TrashAllIcon className="size-4" />
                Clear all chats
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Incognito Badge */}
        {isIncognito && (
          <div className="rounded-xl bg-primary/20 backdrop-blur-sm border border-primary/40 px-3 py-2 flex items-center gap-2">
            <EyeOffIcon className="size-4 text-primary" />
            <span className="text-xs font-medium text-primary">Incognito Mode Active</span>
          </div>
        )}

        {/* Conversations List Bubble */}
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/95 backdrop-blur-sm">
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-3">
            {isIncognito ? (
              <div className="py-8 px-4 text-center">
                <div className="flex items-center justify-center size-12 rounded-xl bg-primary/10 mx-auto mb-3">
                  <EyeOffIcon className="size-6 text-primary" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Saved conversations are hidden
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Chats started in incognito mode are not saved. Exit
                  incognito to see your conversation history again.
                </p>
              </div>
            ) : chats.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="flex items-center justify-center size-12 rounded-xl bg-primary/10 mx-auto mb-3">
                  <MessageSquareIcon className="size-6 text-primary fill-current" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground">
                  No conversations yet. Start chatting!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {chats.map((chat) => {
                  const isActive = onChatsRoute && chat.id === activeId;
                  return (
                    <div key={chat.id} className="group relative">
                      <Link
                        href={`/?chat=${chat.id}`}
                        title={chat.title}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => {
                          setActiveChat(chat.id);
                        }}
                        className={cn(
                          "flex items-start gap-3 rounded-xl p-3 transition-all duration-200",
                          isActive
                            ? "bg-primary/15 shadow-sm"
                            : "hover:bg-accent/60"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center size-10 rounded-lg shrink-0",
                          isActive ? "bg-primary/20" : "bg-primary/10"
                        )}>
                          <MessageSquareIcon 
                            className={cn(
                              "size-5 fill-current",
                              isActive ? "text-primary" : "text-primary/70"
                            )} 
                            aria-hidden="true" 
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            isActive ? "text-foreground" : "text-foreground/90"
                          )}>
                            {chat.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatRelativeTime(chat.updated_at)} · {chat.turns.length} message{chat.turns.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Delete chat: ${chat.title}`}
                          title="Delete chat"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm(`Delete "${chat.title}"?`)) {
                              deleteChat(chat.id);
                              if (isActive) router.push("/");
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2Icon className="size-4" aria-hidden="true" />
                        </button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear All Confirmation Dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card rounded-2xl shadow-floating-lg border border-border/40 p-6 max-w-md w-full animate-scale">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center size-12 rounded-xl bg-destructive/10 shrink-0">
                <TrashAllIcon className="size-6 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Clear All Conversations?
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This will permanently delete all {chats.length} conversation{chats.length === 1 ? "" : "s"}. This action cannot be undone.
                </p>
                <p className="text-sm text-foreground mb-3">
                  Type <span className="font-mono font-bold text-destructive">confirm</span> to proceed:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type 'confirm'"
                  className="w-full px-4 py-2 rounded-xl border border-border/60 bg-background/50 text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleClearAll();
                    if (e.key === 'Escape') {
                      setShowClearDialog(false);
                      setConfirmText("");
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowClearDialog(false);
                  setConfirmText("");
                }}
                className="flex-1 px-4 py-2 rounded-xl border border-border/60 text-foreground hover:bg-accent/60 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={confirmText.toLowerCase() !== "confirm"}
                className="flex-1 px-4 py-2 rounded-xl bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
