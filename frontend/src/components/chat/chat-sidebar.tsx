"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquareIcon,
  SquarePenIcon,
  Trash2Icon,
  SearchIcon,
  SettingsIcon,
  LogOutIcon,
  UserIcon,
  LayoutGridIcon,
  WrenchIcon,
  CpuIcon,
  PanelLeftOpenIcon,
  FolderIcon,
  FileIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "lucide-react";

import { PersonAvatar } from "@/components/people/person-avatar";
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
      <circle cx="12" cy="12" r="9" />
      <line x1="8" y1="8" x2="8" y2="8.01" strokeWidth="2.5" />
      <line x1="16" y1="8" x2="16" y2="8.01" strokeWidth="2.5" />
      <path d="M9 15c1 1 2.5 1.5 3 1.5s2-0.5 3-1.5" />
    </svg>
  );
}

/**
 * The redesigned chat sidebar matching the CodeEase UI reference.
 * Warm cream cards, amber accent "New Chat" button, nav items with icons,
 * and Log Out link directly below Profile.
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
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-center bg-transparent text-sidebar-foreground p-3">
        <Link
          href="/dashboard"
          aria-label="CodeEase dashboard"
          title="CodeEase dashboard"
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
          <Link
            href="/profile"
            aria-label="Open your profile"
            title="Open your profile"
            onClick={onNavigate}
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <PersonAvatar login={profile.handle || profile.display_name} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-25 bg-transparent p-4 text-sidebar-foreground">
      {/* Header — Logo + Brand + New Chat Button */}
      <div className="rounded-2xl bg-card shadow-neumorph p-4 animate-scale">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#242424] text-white">
            <Logo className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <Link
              href="/dashboard"
              onClick={onNavigate}
              className="block outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
            >
              <h1 className="font-heading text-base font-bold text-foreground tracking-tight">
                CodeEase
              </h1>
            </Link>
          </div>
          <button
            onClick={onToggleCollapse}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
            aria-label="Collapse sidebar"
          >
            ×
          </button>
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

      {/* Grouping Navigation Menu and Log Out together to control their specific gap */}
      <div className="flex flex-col gap-5">
        {/* Navigation Menu */}
        <div className="rounded-2xl bg-card shadow-neumorph p-3 animate-scale" style={{ animationDelay: "50ms" }}>
          <nav className="space-y-0.5">
            <Link
              href="/"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-150",
                pathname === "/"
                  ? "bg-primary/10 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <SearchIcon className="size-4" />
              <span>Discover</span>
            </Link>
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-150",
                pathname === "/dashboard"
                  ? "bg-primary/10 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <LayoutGridIcon className="size-4" />
              <span>Workspace</span>
            </Link>
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-150",
                pathname === "/settings"
                  ? "bg-primary/10 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <UserIcon className="size-4" />
              <span>Profile</span>
            </Link>
          </nav>
        </div>

        {/* Log Out - Separate card */}
        <div className="rounded-2xl bg-card shadow-neumorph p-3 animate-scale" style={{ animationDelay: "100ms" }}>
          <button
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-all duration-150"
            onClick={() => {
              // Log out action placeholder
            }}
          >
            <LogOutIcon className="size-4" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}