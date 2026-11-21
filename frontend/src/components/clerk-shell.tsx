"use client";

/**
 * Clerk is an additive sign-in layer (Google / GitHub) on top of the
 * app's own accounts. It is only mounted when a publishable key is
 * configured — without one (local dev, offline demo) the app must render
 * exactly as before, and the social buttons hide themselves.
 */
import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

export const CLERK_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export function ClerkShell({ children }: { children: ReactNode }) {
  if (!CLERK_ENABLED) return <>{children}</>;
  return (
    <ClerkProvider signInUrl="/login" signUpUrl="/signup">
      {children}
    </ClerkProvider>
  );
}
