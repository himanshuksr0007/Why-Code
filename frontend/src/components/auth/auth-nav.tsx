"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { authApi } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/store";
import { hapticSelection } from "@/lib/haptics";

/**
 * The guest's Log in / Sign up bubble, floating at the top-right of the
 * page in the site's neumorphic pill style. It is dynamic: signed-in
 * users never see it (their identity lives in the sidebar's profile
 * bubble), and it hides on the auth pages themselves. Guests can use
 * the whole site without it — this is an invitation, not a gate.
 */
export function AuthNav() {
  const { user } = useAuth();
  const pathname = usePathname();

  // Validate the stored session once per app load; a dead token quietly
  // returns the UI to the guest state.
  useEffect(() => {
    void authApi.syncSession();
  }, []);

  if (user) return null;
  if (pathname === "/login" || pathname === "/signup") return null;

  return (
    <nav
      aria-label="Account"
      className="why-fade-in fixed top-[4.5rem] right-4 z-40 lg:top-4"
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
