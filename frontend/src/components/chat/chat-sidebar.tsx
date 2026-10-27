"use client";

import Link from "next/link";
import { PanelLeftOpenIcon, SquarePenIcon } from "lucide-react";

import { ConversationsPanel } from "@/components/chat/conversations-panel";
import { ProfileBubble } from "@/components/chat/profile-bubble";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { startNewChat } from "@/lib/chat/store";

function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" />
    </svg>
  );
}

/**
 * The left column, top to bottom: the brand card with New chat, the
 * conversations bubbles (they live here now, not floating over the content),
 * and the profile bubble whose upward menu holds Settings and Log out.
 * New chat goes home, so there is no separate Discover/Workspace nav.
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
  if (collapsed) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-center bg-transparent text-sidebar-foreground p-3">
        <Link
          href="/"
          aria-label="WhyCode home"
          title="WhyCode home"
          onClick={onNavigate}
          className="flex size-12 items-center justify-center rounded-full bg-primary-gradient text-white shadow-neumorph transition-transform outline-none hover:scale-105 hover-lift"
        >
          <Logo className="size-5" />
        </Link>

        <div className="mt-4 flex flex-col items-center gap-2">
          <Button
            render={<Link href="/" />}
            nativeButton={false}
            variant="ghost"
            size="icon"
            aria-label="New chat"
            title="New chat"
            className="text-muted-foreground hover:text-primary"
            onClick={() => {
              startNewChat();
              onNavigate?.();
            }}
          >
            <SquarePenIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="text-muted-foreground hover:text-primary"
            onClick={onToggleCollapse}
          >
            <PanelLeftOpenIcon aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-auto flex w-full flex-col items-center gap-2 py-2">
          <ThemeToggle />
          <ProfileBubble compact onNavigate={onNavigate} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 bg-transparent p-4 text-sidebar-foreground">
      {/* Header — Logo + Brand + New Chat Button */}
      <div className="rounded-2xl bg-card shadow-neumorph p-4 animate-scale">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#242424] text-white">
            <Logo className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <Link
              href="/"
              onClick={onNavigate}
              className="block outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
            >
              <h1 className="font-heading text-base font-bold text-foreground tracking-tight">
                WhyCode
              </h1>
            </Link>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
              aria-label="Collapse sidebar"
            >
              ×
            </button>
          )}
        </div>

        <Button
          render={<Link href="/" />}
          nativeButton={false}
          className="w-full justify-center rounded-full bg-primary-gradient text-white font-medium shadow-floating hover-lift transition-all duration-200 hover:shadow-floating-lg active:scale-[0.97]"
          onClick={() => {
            startNewChat();
            onNavigate?.();
          }}
        >
          <SquarePenIcon className="size-4" aria-hidden="true" />
          New chat
        </Button>
      </div>

      {/* Conversations — moved in from the old floating right panel. */}
      <ConversationsPanel />

      {/* Profile — settings and log out live in its upward menu. */}
      <ProfileBubble onNavigate={onNavigate} />
    </div>
  );
}
