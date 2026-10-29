"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GitCommitHorizontalIcon,
  NetworkIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  ScaleIcon,
  SearchIcon,
  SquarePenIcon,
  XIcon,
} from "lucide-react";

import { ConversationsPanel } from "@/components/chat/conversations-panel";
import { ProfileBubble } from "@/components/chat/profile-bubble";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  closeChatSearch,
  setChatSearchOpen,
  setChatSearchQuery,
  useChatSearch,
} from "@/lib/chat/search";
import { startNewChat } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

/** The explorer pages, linked from the rail under the brand bubble. */
const NAV_ITEMS = [
  { href: "/decisions", label: "Decisions", icon: ScaleIcon },
  { href: "/graph", label: "Graph explorer", icon: NetworkIcon },
  { href: "/changes", label: "Code changes", icon: GitCommitHorizontalIcon },
] as const;

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
  const { open: searchOpen, query: searchQuery } = useChatSearch();
  const pathname = usePathname();

  if (collapsed) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-center bg-transparent text-sidebar-foreground p-3">
        <Link
          href="/"
          aria-label="WhyCode home"
          title="WhyCode home"
          onClick={onNavigate}
          className="flex size-12 items-center justify-center transition-transform outline-none hover:scale-105 hover-lift"
        >
          <Logo className="size-12" />
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
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const ItemIcon = item.icon;
            return (
              <Button
                key={item.href}
                render={<Link href={item.href} />}
                nativeButton={false}
                variant="ghost"
                size="icon"
                aria-label={item.label}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-muted-foreground hover:text-primary",
                  active && "bg-primary/15 text-primary",
                )}
                onClick={onNavigate}
              >
                <ItemIcon aria-hidden="true" />
              </Button>
            );
          })}
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
      {/* Header — collapse toggle, brand, and the New / Search rows */}
      <div className="rounded-2xl bg-card shadow-neumorph p-4 animate-scale">
        <div className="flex items-center gap-2 mb-2">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftCloseIcon className="size-5" aria-hidden="true" />
            </button>
          )}
          <Logo className="size-8" />
          <div className="min-w-0 flex-1">
            <Link
              href="/"
              onClick={onNavigate}
              className="block outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
            >
              <h1 className="font-brand text-[1.35rem] leading-none font-semibold text-foreground">
                WhyCode
              </h1>
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <Link
            href="/"
            onClick={() => {
              startNewChat();
              onNavigate?.();
            }}
            className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-foreground/85 transition-colors hover:bg-accent/70 hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <PlusIcon className="size-4.5 shrink-0" aria-hidden="true" />
            New chat
          </Link>
          <button
            type="button"
            onClick={() => setChatSearchOpen(!searchOpen)}
            aria-expanded={searchOpen}
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-accent/70 hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              searchOpen ? "text-foreground" : "text-foreground/85",
            )}
          >
            <SearchIcon className="size-4.5 shrink-0" aria-hidden="true" />
            Search
          </button>
        </div>

        {searchOpen && (
          <div className="mt-2 flex h-9 items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-2.5">
            <SearchIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeChatSearch();
              }}
              placeholder="Search chats"
              aria-label="Search chats"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {searchQuery !== "" && (
              <button
                type="button"
                onClick={() => setChatSearchQuery("")}
                aria-label="Clear search"
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Explore — decision center, graph explorer, code changes */}
      <nav
        aria-label="Explore"
        className="rounded-2xl bg-card shadow-neumorph p-2 animate-scale"
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const ItemIcon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                active
                  ? "bg-primary/15 font-medium text-foreground"
                  : "text-foreground/85 hover:bg-accent/70 hover:text-foreground",
              )}
            >
              <ItemIcon
                className={cn("size-4.5 shrink-0", active && "text-primary")}
                aria-hidden="true"
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Conversations — moved in from the old floating right panel. */}
      <ConversationsPanel />

      {/* Profile — settings and log out live in its upward menu. */}
      <ProfileBubble onNavigate={onNavigate} />
    </div>
  );
}
