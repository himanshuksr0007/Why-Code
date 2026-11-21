"use client";

/**
 * Email + password sign-in, driven by Clerk (custom flow, our UI).
 * Clerk verifies the credentials — including its leaked-password and
 * brute-force protections — and, when the device is new, emails a
 * one-time code as a second step. Once Clerk's session is active we
 * hand off to /auth/bridge, which turns it into a WhyCode session.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { Loader2Icon } from "lucide-react";

import { authFieldClass, authLabelClass } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { hapticError, hapticLight, hapticSuccess } from "@/lib/haptics";

function clerkMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const e = error as { longMessage?: string; message?: string };
    return e.longMessage || e.message || fallback;
  }
  return fallback;
}

export function ClerkLoginForm() {
  const router = useRouter();
  const { signIn } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "code">("password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    const { error: finalizeError } = await signIn.finalize();
    if (finalizeError) {
      setError(clerkMessage(finalizeError, "Sign-in could not be completed."));
      setBusy(false);
      return;
    }
    hapticSuccess();
    router.replace("/auth/bridge");
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !signIn) return;
    setError(null);
    setBusy(true);
    hapticLight();
    const { error: passwordError } = await signIn.password({
      identifier: email.trim(),
      password,
    });
    if (passwordError) {
      hapticError();
      setError(clerkMessage(passwordError, "Invalid email or password."));
      setBusy(false);
      return;
    }
    if (signIn.status === "complete") {
      await finish();
      return;
    }
    // New device / extra verification: Clerk emails a one-time code.
    const { error: codeError } = await signIn.emailCode.sendCode();
    setBusy(false);
    if (codeError) {
      hapticError();
      setError(
        clerkMessage(
          codeError,
          "This sign-in needs another step that isn't available here. Try Google or GitHub above.",
        ),
      );
      return;
    }
    setStep("code");
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !signIn) return;
    setError(null);
    setBusy(true);
    hapticLight();
    const { error: verifyError } = await signIn.emailCode.verifyCode({ code });
    if (verifyError) {
      hapticError();
      setError(clerkMessage(verifyError, "That code didn't work. Try again."));
      setBusy(false);
      return;
    }
    if (signIn.status === "complete") {
      await finish();
      return;
    }
    setBusy(false);
    setError("Sign-in needs another step that isn't available here. Try Google or GitHub above.");
  };

  if (step === "code") {
    return (
      <form onSubmit={submitCode} className="space-y-4" noValidate>
        <p className="text-sm text-muted-foreground">
          We emailed a one-time code to{" "}
          <span className="font-medium text-foreground">{email.trim()}</span>{" "}
          to confirm this device.
        </p>
        <div>
          <label htmlFor="login-code" className={authLabelClass}>
            Email code
          </label>
          <input
            id="login-code"
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
          Verify and log in
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} className="space-y-4" noValidate>
      <div>
        <label htmlFor="login-email" className={authLabelClass}>
          Email
        </label>
        <input
          id="login-email"
          className={authFieldClass}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="login-password" className={authLabelClass}>
          Password
        </label>
        <input
          id="login-password"
          className={authFieldClass}
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
        disabled={busy || !email.trim() || !password}
      >
        {busy ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        Log in
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Just browsing? You can keep asking questions as a guest — no
        account needed.
      </p>
    </form>
  );
}
