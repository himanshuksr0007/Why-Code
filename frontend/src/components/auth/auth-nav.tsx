"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { authApi } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/store";
import { useChatStore } from "@/lib/chat/store";
import { hapticSelection } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * The guest's Log in / Sign up bubble in the site's neumorphic pill
 * style: top-right on desktop, centered under the top bar on the
 * mobile landing, and hidden on mobile everywhere else (an open
 * conversation has no room for it). It is dynamic: signed-in users
 * never see it (their identity lives in the sidebar's profile
 * bubble), and it hides on the auth pages themselves. Guests can use
 * the whole site without it — this is an invitation, not a gate.
 */
export function AuthNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { activeId } = useChatStore();

  // Validate the stored session once per app load; a dead token quietly
  // returns the UI to the guest state.
  useEffect(() => {
    void authApi.syncSession();
  }, []);

  if (user) return null;
  if (pathname === "/login" || pathname === "/signup") return null;

  // Mobile has no room for a floating pill over a conversation — hidden
  // there entirely (the drawer menu still offers Log in / Sign up). On
  // the mobile landing it sits centered in the band under the top bar
  // instead of clipped at the right edge. Desktop keeps the top-right
  // corner on every page.
  const mobileVisible = pathname === "/" && activeId === null;

  return (
    <nav
      aria-label="Account"
      className={cn(
        "why-fade-in fixed top-[4.5rem] left-1/2 z-40 -translate-x-1/2 lg:top-4 lg:right-6 lg:left-auto lg:translate-x-0",
        !mobileVisible && "max-lg:hidden",
      )}
    >
      <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/90 p-1 shadow-neumorph backdrop-blur">
        <Link
          href="/login"
          onClick={() => hapticSelection()}
          className="rounded-full px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent/70 active:scale-95"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          onClick={() => hapticSelection()}
          className="rounded-full bg-primary-gradient px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-95"
        >
          Sign up
        </Link>
      </div>
    </nav>
  );
}
