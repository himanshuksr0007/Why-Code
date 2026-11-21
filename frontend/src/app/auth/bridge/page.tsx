"use client";

/**
 * The bridge between Clerk and the app's own accounts. After a social
 * sign-in, Clerk has a session but the app does not. This page takes the
 * Clerk session token to the backend, which verifies it and returns a
 * WhyCode session for the account with the same email — so a person who
 * signed up with email and later uses Google lands on the same account.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { CLERK_ENABLED } from "@/components/clerk-shell";
import { AuthApiError, authApi } from "@/lib/auth/api";
import { getAuthSession } from "@/lib/auth/store";

function BridgeInner() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!isLoaded || started.current) return;
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }
    started.current = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("No Clerk session token was issued.");
        const session = await authApi.socialLogin(token);
        toast.success(`Welcome, ${session.user.name}`);
        router.replace("/");
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof AuthApiError
            ? caught.message
            : "Social sign-in could not be completed. Try email sign-in instead.",
        );
      }
    })();
  }, [isLoaded, isSignedIn, getToken, router]);

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
        <p role="alert" className="max-w-sm text-sm text-destructive">
          {error}
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to log in
        </Link>
      </div>
    );
  }
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3">
      <Loader2Icon className="size-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Linking your account…</p>
    </div>
  );
}

export default function AuthBridgePage() {
  const router = useRouter();

  useEffect(() => {
    // No Clerk (or already holding an app session): nothing to bridge.
    if (!CLERK_ENABLED) router.replace(getAuthSession() ? "/" : "/login");
  }, [router]);

  if (!CLERK_ENABLED) return null;
  return <BridgeInner />;
}
