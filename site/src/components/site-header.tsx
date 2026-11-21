"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";

import { NAV, SITE } from "@/lib/site";

import { Logo } from "./logo";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" onClick={() => setOpen(false)}>
          <Logo className="size-6" />
          <span>{SITE.name}</span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active ? "bg-raised text-ink" : "text-ink-soft hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <a
            href={SITE.repoUrl}
            className="rounded-md px-3 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            GitHub
          </a>
          <a
            href={SITE.appUrl}
            className="rounded-md bg-ink px-3.5 py-1.5 text-sm font-medium text-canvas transition-opacity hover:opacity-85"
          >
            Open the app
          </a>
        </div>

        <button
          type="button"
          className="ml-auto flex size-11 items-center justify-center rounded-md text-ink md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
      </div>

      {open ? (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line px-4 py-3 md:hidden">
          {[...NAV, { href: SITE.repoUrl, label: "GitHub" }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-3 text-ink-soft hover:bg-raised hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={SITE.appUrl}
            className="mt-2 block rounded-md bg-ink px-3 py-3 text-center font-medium text-canvas"
          >
            Open the app
          </a>
        </nav>
      ) : null}
    </header>
  );
}
