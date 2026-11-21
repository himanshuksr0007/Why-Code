"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HandleSSOCallback } from "@clerk/nextjs";
import { Loader2Icon } from "lucide-react";

import { CLERK_ENABLED } from "@/components/clerk-shell";

/**
 * Landing point for the Google/GitHub OAuth round-trip when the flow
 * needs finishing (transfers, extra steps). HandleSSOCallback completes
 * the sign-in/sign-up and activates the session; every outcome then
 * routes into the app's own pages — success goes to /auth/bridge, which
 * exchanges the Clerk session for a WhyCode session.
 */
export default function SSOCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (!CLERK_ENABLED) router.replace("/login");
  }, [router]);

  if (!CLERK_ENABLED) return null;
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3">
      <Loader2Icon className="size-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
      <HandleSSOCallback
        navigateToApp={({ decorateUrl }) => {
          const destination = decorateUrl("/auth/bridge");
          if (destination.startsWith("http")) {
            window.location.href = destination;
            return;
          }
          router.replace(destination);
        }}
        navigateToSignIn={() => router.replace("/login")}
        navigateToSignUp={() => router.replace("/signup")}
      />
    </div>
  );
}
