"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";

import { RepoSelect } from "@/components/ask/repo-select";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { setActiveRepo, useLocalProfile } from "@/lib/local/profile";
import {
  resetSidebarWidth,
  setSidebarWidth,
  SIDEBAR_COLLAPSED,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  toggleSidebarCollapsed,
  useSidebarCollapsed,
  useSidebarWidth,
} from "@/lib/local/sidebar";

function startBodyDrag(): void {
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
}

function endBodyDrag(): void {
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
}

/**
 * A 1px rule with a wide, invisible hit area. Pointer drags resize the rail;
 * the keyboard can nudge it with the arrow keys; double-click resets it.
 */
function SidebarResizeHandle() {
  const width = useSidebarWidth();
  const start = useRef<{ x: number; width: number } | null>(null);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      className="group absolute inset-y-0 -right-1 z-20 hidden w-2 cursor-col-resize touch-none outline-none md:block"
      onDoubleClick={resetSidebarWidth}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = { x: event.clientX, width };
        startBodyDrag();
      }}
      onPointerMove={(event) => {
        if (!start.current) return;
        setSidebarWidth(
          start.current.width + (event.clientX - start.current.x),
        );
      }}
      onPointerUp={(event) => {
        if (!start.current) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        start.current = null;
        endBodyDrag();
      }}
      onPointerCancel={() => {
        start.current = null;
        endBodyDrag();
      }}
      onLostPointerCapture={() => {
        start.current = null;
        endBodyDrag();
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 48 : 16;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setSidebarWidth(width - step);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          setSidebarWidth(width + step);
        } else if (event.key === "Home") {
          event.preventDefault();
          setSidebarWidth(SIDEBAR_MIN);
        } else if (event.key === "End") {
          event.preventDefault();
          setSidebarWidth(SIDEBAR_MAX);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          resetSidebarWidth();
        }
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-primary/60 group-focus-visible:bg-primary group-active:bg-primary"
      />
    </div>
  );
}

/**
 * The application frame: a resizable chat-style sidebar on desktop (history +
 * profile), a sheet on mobile, and a top bar that shows the repository in
 * context and lets the visitor switch it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const width = useSidebarWidth();
  const collapsed = useSidebarCollapsed();
  const { profile } = useLocalProfile();

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside
        style={{ width: collapsed ? SIDEBAR_COLLAPSED : width }}
        className="relative hidden shrink-0 border-r border-sidebar-border md:sticky md:top-0 md:flex md:h-svh"
      >
        <ChatSidebar
          collapsed={collapsed}
          onToggleCollapse={toggleSidebarCollapsed}
        />
        {collapsed ? null : <SidebarResizeHandle />}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur supports-backdrop-filter:bg-background/70 md:px-4">
          <Sheet
            open={mobileOpen}
            onOpenChange={setMobileOpen}
          >
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label="Open chat history"
                />
              }
            >
              <MenuIcon aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-0 p-0">
              <SheetTitle className="sr-only">
                Chat history and profile
              </SheetTitle>
              <SheetDescription className="sr-only">
                Browse past conversations, start a new chat, or open your
                profile.
              </SheetDescription>
              <ChatSidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden text-muted-foreground md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            onClick={toggleSidebarCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpenIcon aria-hidden="true" />
            ) : (
              <PanelLeftCloseIcon aria-hidden="true" />
            )}
          </Button>

          <RepoSelect
            value={profile.default_repo}
            onChange={setActiveRepo}
            showHint={false}
          />

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/profile"
              aria-label="Open your profile"
              className="rounded-full md:hidden"
            >
              <PersonAvatar login={profile.handle || profile.display_name} />
            </Link>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
