"use client";

/**
 * "Sign in with Google / GitHub" — Clerk OAuth on the outside, the app's
 * own account on the inside. Clerk handles the provider round-trip and
 * lands on /auth/bridge, which exchanges the Clerk session for a WhyCode
 * session on the account with the same email (see lib/auth/api
 * socialLogin). The buttons render only when Clerk is configured.
 *
 * Uses the @clerk/nextjs v7 (Core 3) custom-flow API: signIn.sso() /
 * signUp.sso() with an explicit SSO callback route.
 */
import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { Loader2Icon } from "lucide-react";

import { CLERK_ENABLED } from "@/components/clerk-shell";
import { hapticLight } from "@/lib/haptics";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.58v2.97h3.88c2.27-2.09 3.57-5.16 3.57-8.74z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-2.97c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.07A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.32A7.2 7.2 0 0 1 4.91 12c0-.81.14-1.59.38-2.32V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.07z"
      />
      <path
        fill="#EA4335"
        d="M12 4.73c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.07C6.23 6.84 8.88 4.73 12 4.73z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 fill-current"
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

type Strategy = "oauth_google" | "oauth_github";

function SocialButtonsInner({ mode }: { mode: "signin" | "signup" }) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [busy, setBusy] = useState<Strategy | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (strategy: Strategy) => {
    if (busy) return;
    setBusy(strategy);
    setError(null);
    hapticLight();
    try {
      const flow = mode === "signin" ? signIn : signUp;
      if (!flow) throw new Error("Clerk is still loading.");
      const { error: ssoError } = await flow.sso({
        strategy,
        redirectUrl: "/auth/bridge",
        redirectCallbackUrl: "/sso-callback",
      });
      if (ssoError) throw ssoError;
      // On success the browser is navigating to the provider; if we are
      // still here a moment later, the redirect did not happen.
    } catch {
      setBusy(null);
      setError("Could not start social sign-in. Try again, or use email below.");
    }
  };

  const buttonClass =
    "flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-background/60 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60";

  return (
    <div className="space-y-3 pb-5">
      <button
        type="button"
        className={buttonClass}
        onClick={() => void go("oauth_google")}
        disabled={busy !== null}
      >
        {busy === "oauth_google" ? (
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <GoogleIcon />
        )}
        Sign in with Google
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => void go("oauth_github")}
        disabled={busy !== null}
      >
        {busy === "oauth_github" ? (
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <GitHubIcon />
        )}
        Sign in with GitHub
      </button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3 pt-1" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or use email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

export function SocialButtons({ mode }: { mode: "signin" | "signup" }) {
  if (!CLERK_ENABLED) return null;
  return <SocialButtonsInner mode={mode} />;
}
