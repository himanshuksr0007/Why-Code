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
      {/* Reading progress: a CSS scroll-driven animation where supported. */}
      <span className="scroll-progress absolute inset-x-0 bottom-[-1px] h-px origin-left bg-ink/70" aria-hidden="true" />
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
                className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-200 ${
                  active ? "bg-raised text-ink" : "text-ink-soft hover:bg-raised/60 hover:text-ink"
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
          <span className="relative size-5">
            <MenuIcon
              className={`absolute inset-0 size-5 transition-all duration-300 ${open ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`}
              aria-hidden="true"
            />
            <XIcon
              className={`absolute inset-0 size-5 transition-all duration-300 ${open ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`}
              aria-hidden="true"
            />
          </span>
        </button>
      </div>

      {/* Always rendered so it can animate; inert and collapsed when closed. */}
      <div
        id="mobile-nav"
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out md:hidden ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
        <nav aria-label="Main" className="border-t border-line px-4 py-3">
          {[...NAV, { href: SITE.repoUrl, label: "GitHub" }].map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{ transitionDelay: open ? `${60 + i * 40}ms` : "0ms" }}
              className={`block rounded-md px-3 py-3 text-ink-soft transition-all duration-300 hover:bg-raised hover:text-ink ${
                open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
              }`}
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
        </div>
      </div>
    </header>
  );
}
