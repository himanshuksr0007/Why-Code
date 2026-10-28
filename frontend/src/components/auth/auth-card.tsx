"use client";

import type { ReactNode } from "react";

import { Logo } from "@/components/logo";

/** The neumorphic bubble card every auth screen is built on. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="w-full rounded-3xl border border-border/60 bg-card p-6 shadow-neumorph sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-gradient text-white shadow-neumorph">
            <Logo className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
      {footer ? (
        <p className="mt-5 text-center text-sm text-muted-foreground">{footer}</p>
      ) : null}
    </div>
  );
}

/** Shared field styling for the auth forms, in the site's inset style. */
export const authFieldClass =
  "h-11 rounded-xl border border-border/70 bg-background/60 px-3.5 text-sm text-foreground shadow-[inset_2px_2px_5px_var(--neu-dark),inset_-2px_-2px_5px_var(--neu-light)] outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-ring/40 w-full";

export const authLabelClass =
  "mb-1.5 block text-xs font-medium tracking-wide text-muted-foreground uppercase";
