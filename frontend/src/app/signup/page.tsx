"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { AuthLayout } from "@/components/auth/auth-layout";
import {
  AuthCard,
  authFieldClass,
  authLabelClass,
} from "@/components/auth/auth-card";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { Button } from "@/components/ui/button";
import { AuthApiError, authApi } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/store";
import { hapticError, hapticLight, hapticSelection } from "@/lib/haptics";

export default function SignupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ email: string; demoCode?: string } | null>(
    null,
  );

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (password !== confirm) {
      hapticError();
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    hapticLight();
    try {
      const result = await authApi.signup(name.trim(), email.trim(), password);
      setPending({ email: result.email, demoCode: result.demo_code });
    } catch (caught) {
      hapticError();
      if (caught instanceof AuthApiError && caught.code === "account_exists") {
        setError("An account with this email already exists — log in instead.");
      } else {
        setError(
          caught instanceof AuthApiError
            ? caught.message
            : "Sign up failed. Try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <AuthLayout>
        <AuthCard
          title="Verify your email"
          subtitle="One quick step to activate your account."
        >
          <VerifyEmailForm email={pending.email} demoCode={pending.demoCode} />
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
    <AuthCard
      title="Create your account"
      subtitle="Save your models, sync your history, and pick up where you left off."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            onClick={() => hapticSelection()}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
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
            placeholder="At least 8 characters, with a digit"
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
          We&apos;ll email you a 6-digit code to verify the address. Your
          password is stored only as a one-way hash — never in plain text.
        </p>
      </form>
    </AuthCard>
    </AuthLayout>
  );
}
