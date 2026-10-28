"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

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
import { hapticError, hapticLight, hapticSelection, hapticSuccess } from "@/lib/haptics";

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    hapticLight();
    try {
      const session = await authApi.login(email.trim(), password);
      hapticSuccess();
      toast.success(`Welcome back, ${session.user.name}`);
      router.push("/");
      router.refresh();
    } catch (caught) {
      if (
        caught instanceof AuthApiError &&
        caught.code === "email_not_verified"
      ) {
        // Route them into the OTP step; a fresh code is requested so the
        // one from signup (long expired, usually) is not the only option.
        hapticSelection();
        const target = email.trim().toLowerCase();
        setVerifyEmail(target);
        void authApi
          .resendOtp(target)
          .then((result) => {
            if (result.demo_code) setDemoCode(result.demo_code);
          })
          .catch(() => undefined);
      } else {
        hapticError();
        setError(
          caught instanceof AuthApiError
            ? caught.message
            : "Login failed. Try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  if (verifyEmail) {
    return (
      <AuthLayout>
        <AuthCard
          title="Verify your email"
          subtitle="This account's email is not verified yet — enter the code to finish."
        >
          <VerifyEmailForm email={verifyEmail} demoCode={demoCode} />
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
    <AuthCard
      title="Welcome back"
      subtitle="Log in to your WhyCode account."
      footer={
        <>
          New to WhyCode?{" "}
          <Link
            href="/signup"
            onClick={() => hapticSelection()}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
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
    </AuthCard>
    </AuthLayout>
  );
}
