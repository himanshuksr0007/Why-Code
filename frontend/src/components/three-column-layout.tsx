"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

interface ThreeColumnLayoutProps {
  children: ReactNode;
  className?: string;
}

export function ThreeColumnLayout({
  children,
  className,
}: ThreeColumnLayoutProps) {
  return (
    <div className={cn("flex min-h-screen bg-waves", className)}>
      {/* Left Sidebar - Chat Navigation */}
      <aside className="hidden md:flex md:w-72 lg:w-80 shrink-0 sticky top-0 h-screen overflow-y-auto">
        <ChatSidebar />
      </aside>

      {/* Center Column - Main Content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {children}
      </main>
    </div>
  );
}
