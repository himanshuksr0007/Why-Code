"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { Sheet } from "@/components/ui/sheet";
import {
  toggleSidebarCollapsed,
  useSidebarCollapsed,
} from "@/lib/local/sidebar";

/**
 * The application frame with three-column warm neumorphic layout.
 * Left: Navigation sidebar (chat history + nav)
 * Center: Main content area
 * Right: File tree / context sidebar (imported per-page)
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSidebarCollapsed();

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

      {/* Mobile Sheet remains exactly the same */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        {/* ... existing Sheet code ... */}
      </Sheet>

      {/* Center Column - Constrained width and centered */}
      <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col px-4 transition-all duration-300 ease-in-out">
        {children}
      </main>

      {/* Right Sidebar */}
    </div>
  );
}