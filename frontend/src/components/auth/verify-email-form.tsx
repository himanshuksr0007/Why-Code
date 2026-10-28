"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, MailCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { AuthApiError, authApi } from "@/lib/auth/api";
import { hapticError, hapticLight, hapticSuccess } from "@/lib/haptics";

const RESEND_SECONDS = 60;

/**
 * The OTP step: enter the 6-digit code mailed at signup (or after an
 * unverified login attempt). Verifying creates the session and goes
 * home. Resend is cooldown-limited here and rate-limited server-side.
 */
export function VerifyEmailForm({
  email,
  demoCode,
}: {
  email: string;
  demoCode?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [currentDemoCode, setCurrentDemoCode] = useState(demoCode);
  const submittedFor = useRef<string>("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const verify = async (candidate: string) => {
    if (candidate.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    hapticLight();
    try {
      const session = await authApi.verifyEmail(email, candidate);
      hapticSuccess();
      toast.success(`Welcome, ${session.user.name} — your email is verified`);
      router.push("/");
      router.refresh();
    } catch (caught) {
      hapticError();
      setError(
        caught instanceof AuthApiError
          ? caught.message
          : "Verification failed. Try again.",
      );
      setBusy(false);
    }
  };

  // Auto-submit the moment all six digits are in.
  useEffect(() => {
    if (code.length === 6 && submittedFor.current !== code) {
      submittedFor.current = code;
      void verify(code);
    }
    if (code.length < 6) submittedFor.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    if (resendIn > 0 || busy) return;
    setError(null);
    hapticLight();
    try {
      const result = await authApi.resendOtp(email);
      if (result.demo_code) setCurrentDemoCode(result.demo_code);
      setResendIn(RESEND_SECONDS);
      setCode("");
      toast.success("A new code is on its way to your inbox");
    } catch (caught) {
      hapticError();
      if (caught instanceof AuthApiError && caught.status === 429) {
        setResendIn(caught.retryAfter || RESEND_SECONDS);
        setError(caught.message);
      } else {
        setError(
          caught instanceof AuthApiError
            ? caught.message
            : "Could not resend the code. Try again.",
        );
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/50 p-3.5 text-sm">
        <MailCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">{email}</span>. It
          expires in 10 minutes.
        </p>
      </div>

      {currentDemoCode ? (
        <p className="rounded-2xl border border-dashed border-primary/50 bg-primary/10 p-3.5 text-center text-sm text-foreground">
          Demo mode — no email is sent. Your code is{" "}
          <span className="font-mono text-base font-semibold tracking-widest">
            {currentDemoCode}
          </span>
        </p>
      ) : null}

      <OtpInput
        value={code}
        onChange={(next) => {
          setCode(next);
          setError(null);
        }}
        disabled={busy}
        invalid={Boolean(error)}
      />

      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="h-11 w-full rounded-xl text-sm font-semibold"
        disabled={code.length !== 6 || busy}
        onClick={() => void verify(code)}
      >
        {busy ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        Verify and continue
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Didn&apos;t get it?{" "}
        <button
          type="button"
          onClick={() => void resend()}
          disabled={resendIn > 0 || busy}
          className="font-medium text-primary underline-offset-4 transition hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </button>
      </p>
    </div>
  );
}
