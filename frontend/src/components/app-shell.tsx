"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";

import { AuthNav } from "@/components/auth/auth-nav";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { GraphViewerHost } from "@/components/graph/graph-viewer";
import { TutorialHost } from "@/components/onboarding/tutorial-dialog";
import { InsightsRail } from "@/components/insights-rail";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  toggleSidebarCollapsed,
  useSidebarCollapsed,
} from "@/lib/local/sidebar";

/**
 * The application frame.
 * Left: the floating sidebar column — brand + New chat, the conversations
 * bubbles, and the profile bubble (Settings / Log out in its upward menu).
 * Center: the page. Right (very wide screens only): the insights rail.
 *
 * On small screens the sidebar lives in a left drawer opened from the
 * mobile top bar; it closes on an outside press, Escape, or navigation.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSidebarCollapsed();
  const pathname = usePathname();

  // The explorer pages run wide two-column layouts (content + their
  // own right rail). They keep the sidebar's space reserved at every
  // desktop width and get a wider center column; the chat-style
  // pages keep the approved narrow, viewport-centered composition.
  const isExplorerPage =
    pathname === "/decisions" ||
    pathname === "/graph" ||
    pathname === "/changes";

  // The auth pages and shared-chat links are standalone: no sidebar,
  // no insights rail, no mobile top bar.
  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/share/")
  ) {
    return <div className="relative min-h-svh">{children}</div>;
  }

  return (
    <div
      className={`flex min-h-svh relative justify-center ${
        isExplorerPage
          ? collapsed
            ? "lg:pl-24"
            : "lg:pl-[21rem]"
          : collapsed
            ? "lg:pl-24 min-[1440px]:pl-0!"
            : "lg:pl-[21rem] min-[1440px]:pl-0!"
      }`}
    >
      {/* Left Sidebar - Made 'fixed' to float without taking up layout space */}
      <aside
        className={`
          hidden lg:flex lg:fixed lg:top-4 lg:left-4 lg:bottom-4 z-40
          ${collapsed ? "lg:w-20" : "lg:w-80"}
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
      <main
        className={`flex-1 w-full mx-auto flex flex-col px-4 transition-all duration-300 ease-in-out ${
          isExplorerPage ? "max-w-[84rem]" : "max-w-4xl"
        }`}
      >
        {/* Mobile top bar: opens the drawer; theme stays one tap away. */}
        <div className="sticky top-0 z-40 flex items-center justify-between py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="flex size-10 items-center justify-center rounded-full border border-border/40 bg-card/90 text-foreground shadow-sm backdrop-blur transition active:scale-95"
          >
            <MenuIcon className="size-5" />
          </button>
          <span className="rounded-full border border-border/40 bg-card/90 px-4 py-2 font-brand text-base font-semibold text-foreground shadow-sm backdrop-blur">
            WhyCode
          </span>
          <span className="flex size-10 items-center justify-center rounded-full border border-border/40 bg-card/90 shadow-sm backdrop-blur">
            <ThemeToggle />
          </span>
        </div>
        {children}
      </main>

      {/* Right rail — chat-page insights, on very wide screens. Its
          bubbles (ask suggestions, the session graph, the repository
          being explored) belong to the chat page only; on Settings
          and the other pages they are just noise. */}
      {pathname === "/" && <InsightsRail />}

      {/* Fullscreen graph viewer (rail bubble / mobile View Graph). */}
      <GraphViewerHost />

      {/* First-visit product tour (auto-opens once on the home page;
          replayable from the profile bubble's menu). */}
      <TutorialHost />

      {/* Guest Log in / Sign up bubble (top-right; hides when signed in). */}
      <AuthNav />
    </div>
  );
}
