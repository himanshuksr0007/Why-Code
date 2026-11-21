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
      <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 1.33 1.08.78 2.28v3.39c0 .32.22.7.83.58A12 12 0 0 0 12 .3z" />
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
