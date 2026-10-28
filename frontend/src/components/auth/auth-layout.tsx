"use client";

import type { ReactNode } from "react";

import { Showcase } from "@/components/auth/showcase";

/**
 * The auth pages' standalone layout (the app shell steps aside here):
 * the animated showcase bubble on the left, the form on the right.
 * On small screens the showcase steps away and the form centers.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid min-h-svh w-full max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.12fr_1fr] lg:px-8">
      <div className="hidden lg:block">
        <Showcase />
      </div>
      <div className="mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
        {children}
      </div>
    </div>
  );
}
