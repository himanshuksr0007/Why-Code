import Link from "next/link";

import { NAV, SITE } from "@/lib/site";

import { Logo } from "./logo";
import { Reveal } from "./reveal";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <Reveal>
      <div className="stagger mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Logo className="size-6" />
            {SITE.name}
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
            The record of why your code is the way it is — with evidence you can check,
            and a refusal when there isn&rsquo;t any.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wider text-ink-faint uppercase">Site</p>
          <ul className="mt-3 space-y-2 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-ink-soft transition-colors hover:text-ink">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wider text-ink-faint uppercase">Project</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href={SITE.repoUrl} className="text-ink-soft hover:text-ink">
                Source on GitHub
              </a>
            </li>
            <li>
              <a href={SITE.appUrl} className="text-ink-soft hover:text-ink">
                Live app
              </a>
            </li>
            <li>
              <a href={SITE.docsLedger} className="text-ink-soft hover:text-ink">
                Decision ledger guide
              </a>
            </li>
          </ul>
        </div>
      </div>
      </Reveal>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-ink-faint sm:px-6">
          Decision-layer ideas credited to{" "}
          <a href="https://github.com/repowise-dev/repowise" className="underline hover:text-ink">
            repowise
          </a>{" "}
          (AGPL-3.0); Why-Code&rsquo;s implementation is its own.
        </p>
      </div>
    </footer>
  );
}
