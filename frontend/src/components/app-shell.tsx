"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, MessagesSquareIcon } from "lucide-react";

import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useChatStore } from "@/lib/chat/store";
import {
  toggleConversations,
  useConversationsOpen,
} from "@/lib/local/panels";
import {
  toggleSidebarCollapsed,
  useSidebarCollapsed,
} from "@/lib/local/sidebar";
import { cn } from "@/lib/utils";

/**
 * The application frame with three-column warm neumorphic layout.
 * Left: Navigation sidebar (chat history + nav)
 * Center: Main content area
 * Right: File tree / context sidebar (imported per-page)
 *
 * On small screens nothing overlays the content by default: the navigation
 * lives in a left drawer and the conversations panel (home route) behind a
 * toggle, both opened from the mobile top bar and dismissed by an outside
 * press, Escape, or choosing a destination.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSidebarCollapsed();
  const pathname = usePathname();
  const conversationsOpen = useConversationsOpen();
  const { chats } = useChatStore();
  const onHome = pathname === "/";

  return (
    <div className="flex min-h-svh relative justify-center">
      {/* Left Sidebar - Made 'fixed' to float without taking up layout space */}
      <aside
        className={`
          hidden md:flex md:fixed md:top-4 md:left-4 md:bottom-4 z-40
          ${collapsed ? "md:w-20" : "md:w-80"}
          transition-all duration-300 ease-in-out
        `}
      >
        <ChatSidebar
          collapsed={collapsed}
          onToggleCollapse={toggleSidebarCollapsed}
        />
      </aside>

      {/* Mobile navigation drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-3">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <ChatSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Center Column - Constrained width and centered */}
      <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col px-4 transition-all duration-300 ease-in-out">
        {/* Mobile top bar: the only way the drawers open on small screens. */}
        <div className="sticky top-0 z-40 flex items-center justify-between py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="flex size-10 items-center justify-center rounded-full border border-border/40 bg-card/90 text-foreground shadow-sm backdrop-blur transition active:scale-95"
          >
            <MenuIcon className="size-5" />
          </button>
          <span className="rounded-full border border-border/40 bg-card/90 px-4 py-2 text-sm font-semibold tracking-tight text-foreground shadow-sm backdrop-blur">
            WhyCode
          </span>
          {onHome ? (
            <button
              type="button"
              onClick={toggleConversations}
              aria-label="Toggle conversations panel"
              aria-pressed={conversationsOpen}
              className={cn(
                "relative flex size-10 items-center justify-center rounded-full border border-border/40 bg-card/90 text-foreground shadow-sm backdrop-blur transition active:scale-95",
                conversationsOpen &&
                  "border-primary/50 bg-primary/20 text-primary",
              )}
            >
              <MessagesSquareIcon className="size-5" />
              {chats.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {chats.length}
                </span>
              )}
            </button>
          ) : (
            <span className="size-10" aria-hidden="true" />
          )}
        </div>
        {children}
      </main>

      {/* Right Sidebar */}
    </div>
  );
}
