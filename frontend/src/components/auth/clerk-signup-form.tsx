"use client";

/**
 * Email + password sign-up, driven by Clerk (custom flow, our UI).
 * Clerk creates the account, emails the verification code, screens the
 * password against leaked-password databases, and runs bot protection
 * (the #clerk-captcha element). Once Clerk's session is active we hand
 * off to /auth/bridge, which turns it into a WhyCode session on the
 * account with the same email.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { Loader2Icon } from "lucide-react";

import { authFieldClass, authLabelClass } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import {
  EMAIL_DOMAIN_MESSAGE,
  emailDomainAllowed,
} from "@/lib/auth/email-domains";
import { hapticError, hapticLight, hapticSuccess } from "@/lib/haptics";

function clerkMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const e = error as { longMessage?: string; message?: string };
    return e.longMessage || e.message || fallback;
  }
  return fallback;
}

export function ClerkSignupForm() {
  const router = useRouter();
  const { signUp } = useSignUp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"details" | "code">("details");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    const { error: finalizeError } = await signUp.finalize();
    if (finalizeError) {
      setError(clerkMessage(finalizeError, "Sign-up could not be completed."));
      setBusy(false);
      return;
    }
    hapticSuccess();
    router.replace("/auth/bridge");
  };

  const submitDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !signUp) return;
    setError(null);
    if (password !== confirm) {
      hapticError();
      setError("The two passwords do not match.");
      return;
    }
    if (!emailDomainAllowed(email)) {
      hapticError();
      setError(EMAIL_DOMAIN_MESSAGE);
      return;
    }
    setBusy(true);
    hapticLight();
    const parts = name.trim().split(/\s+/);
    const { error: createError } = await signUp.create({
      emailAddress: email.trim(),
      password,
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
    });
    if (createError) {
      hapticError();
      setError(clerkMessage(createError, "Sign up failed. Try again."));
      setBusy(false);
      return;
    }
    if (signUp.status === "complete") {
      await finish();
      return;
    }
    const { error: codeError } = await signUp.verifications.sendEmailCode();
    setBusy(false);
    if (codeError) {
      hapticError();
      setError(clerkMessage(codeError, "Could not send the verification code."));
      return;
    }
    setStep("code");
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !signUp) return;
    setError(null);
    setBusy(true);
    hapticLight();
    const { error: verifyError } = await signUp.verifications.verifyEmailCode({
      code,
    });
    if (verifyError) {
      hapticError();
      setError(clerkMessage(verifyError, "That code didn't work. Try again."));
      setBusy(false);
      return;
    }
    if (signUp.status === "complete") {
      await finish();
      return;
    }
    setBusy(false);
    setError("Sign-up needs another step that isn't available here. Try Google or GitHub above.");
  };

  if (step === "code") {
    return (
      <form onSubmit={submitCode} className="space-y-4" noValidate>
        <p className="text-sm text-muted-foreground">
          We emailed a verification code to{" "}
          <span className="font-medium text-foreground">{email.trim()}</span>.
          Enter it to activate your account.
        </p>
        <div>
          <label htmlFor="signup-code" className={authLabelClass}>
            Email code
          </label>
          <input
            id="signup-code"
            className={authFieldClass}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          className="h-11 w-full rounded-xl text-sm font-semibold"
          disabled={busy || !code.trim()}
        >
          {busy ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Verify and create account
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitDetails} className="space-y-4" noValidate>
      <div>
        <label htmlFor="signup-name" className={authLabelClass}>
          Name
        </label>
        <input
          id="signup-name"
          className={authFieldClass}
          type="text"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="signup-email" className={authLabelClass}>
          Email
        </label>
        <input
          id="signup-email"
          className={authFieldClass}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Use a common provider (Gmail, Outlook, Yahoo, iCloud…) —
          disposable addresses can&apos;t sign up directly.
        </p>
      </div>
      <div>
        <label htmlFor="signup-password" className={authLabelClass}>
          Password
        </label>
        <input
          id="signup-password"
          className={authFieldClass}
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="signup-confirm" className={authLabelClass}>
          Confirm password
        </label>
        <input
          id="signup-confirm"
          className={authFieldClass}
          type="password"
          autoComplete="new-password"
          placeholder="Repeat the password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
        />
      </div>

      {/* Clerk bot-protection mount point for the sign-up flow. */}
      <div id="clerk-captcha" />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-11 w-full rounded-xl text-sm font-semibold"
        disabled={busy || !name.trim() || !email.trim() || !password || !confirm}
      >
        {busy ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        Sign up
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        We&apos;ll email you a 6-digit code to verify the address.
      </p>
    </form>
  );
}
