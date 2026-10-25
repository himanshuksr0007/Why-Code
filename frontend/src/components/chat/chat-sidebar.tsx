"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquareIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react";

import { UserMenu } from "@/components/chat/user-menu";
import { PersonAvatar } from "@/components/people/person-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  deleteChat,
  setActiveChat,
  startNewChat,
  useChatStore,
} from "@/lib/chat/store";
import { useLocalProfile } from "@/lib/local/profile";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="5" cy="7" r="2.4" />
      <circle cx="19" cy="7" r="2.4" />
      <circle cx="12" cy="18" r="2.4" />
      <path d="M7.2 8.2 10.8 16M16.8 8.2 13.2 16M7.4 7h9.2" />
    </svg>
  );
}

/**
 * The chat sidebar: conversation history, a new-chat action, and the local
 * profile. Shared by the desktop rail and the mobile sheet so both stay
 * identical in behaviour. On desktop it can collapse to an icon rail; the
 * mobile sheet always renders the expanded version.
 */
export function ChatSidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { chats, activeId } = useChatStore();
  const { profile } = useLocalProfile();
  const onChatsRoute = pathname === "/";

  if (collapsed) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-center bg-transparent text-sidebar-foreground">
        <Link
          href="/dashboard"
          aria-label="Why-Code dashboard"
          title="Why-Code dashboard"
          onClick={onNavigate}
          className="mt-3 flex size-10 items-center justify-center rounded-full bg-foreground text-background shadow-lift transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Logo className="size-5" />
        </Link>

        <div className="mt-3 flex flex-col items-center gap-1">
          <Button
            render={<Link href="/" />}
            nativeButton={false}
            variant="ghost"
            size="icon"
            aria-label="New chat"
            title="New chat"
            onClick={() => {
              startNewChat();
              onNavigate?.();
            }}
          >
            <SquarePenIcon aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-auto flex w-full flex-col items-center gap-1 py-2">
          <ThemeToggle />
          {onToggleCollapse ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Expand sidebar"
              aria-expanded={false}
              title="Expand sidebar"
              onClick={onToggleCollapse}
            >
              <PanelLeftOpenIcon aria-hidden="true" />
            </Button>
          ) : null}
          <Link
            href="/profile"
            aria-label="Open your profile"
            title="Open your profile"
            onClick={onNavigate}
            className="mt-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <PersonAvatar login={profile.handle || profile.display_name} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 bg-transparent p-3 text-sidebar-foreground">
      <div className="rounded-3xl border border-border/50 bg-card p-3 shadow-lift">
        <div className="relative flex w-full min-w-0 items-center">
          <Link
            href="/dashboard"
            aria-label="Why-Code dashboard"
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-1.5 py-1.5 pr-10 transition-colors outline-none hover:bg-sidebar-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <Logo className="size-5" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-heading text-sm font-semibold">
                Why-Code
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Evidence explorer
              </span>
            </span>
          </Link>
          {onToggleCollapse ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Minimize sidebar"
              aria-expanded={true}
              title="Minimize sidebar"
              onClick={onToggleCollapse}
              className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
            >
              <PanelLeftCloseIcon aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        <Button
          render={<Link href="/" />}
          nativeButton={false}
          className="mt-2.5 w-full justify-center rounded-full shadow-lift"
          onClick={() => {
            startNewChat();
            onNavigate?.();
          }}
        >
          <SquarePenIcon aria-hidden="true" />
          New chat
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-border/50 bg-card py-3 shadow-lift">
        <p className="px-5 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Chats
        </p>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-1">
          {chats.length === 0 ? (
            <p className="px-2 py-1 text-xs leading-relaxed text-muted-foreground">
              No conversations yet. Ask a question and it will appear here.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {chats.map((chat) => {
                const isActive = onChatsRoute && chat.id === activeId;
                return (
                  <li key={chat.id} className="group relative">
                    <Link
                      href={`/?chat=${chat.id}`}
                      title={chat.title}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        setActiveChat(chat.id);
                        onNavigate?.();
                      }}
                      className={cn(
                        "flex items-start gap-2 rounded-lg py-2 pr-8 pl-2 text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <MessageSquareIcon
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{chat.title}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {formatRelativeTime(chat.updated_at)} ·{" "}
                          {chat.turns.length} question
                          {chat.turns.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Delete chat: ${chat.title}`}
                      title="Delete chat"
                      onClick={() => {
                        deleteChat(chat.id);
                        if (isActive) router.push("/");
                      }}
                      className="absolute top-1.5 right-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-background/80 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <Trash2Icon className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-3xl border border-border/50 bg-card p-2.5 shadow-lift">
        <div className="min-w-0 flex-1">
          <UserMenu
            displayName={profile.display_name}
            handle={profile.handle}
          />
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}
