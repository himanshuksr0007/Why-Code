import type { ReactNode } from "react";

import { Reveal } from "./reveal";

export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  className = "",
}: {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:px-6 ${className}`}>
      <Reveal>
      {eyebrow ? (
        <p className="font-mono text-xs tracking-wider text-ink-faint uppercase">{eyebrow}</p>
      ) : null}
      {title ? (
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
      ) : null}
      {intro ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">{intro}</p>
      ) : null}
      </Reveal>
      {children ? (
        <Reveal className="mt-10">
          <div>{children}</div>
        </Reveal>
      ) : null}
    </section>
  );
}

export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: ReactNode; intro: ReactNode }) {
  return (
    <div className="relative overflow-hidden border-b border-line">
      <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="hero-in relative mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6">
        <p className="font-mono text-xs tracking-wider text-ink-faint uppercase">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">{intro}</p>
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface p-6 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong ${className}`}
    >
      {children}
    </div>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed text-ink">
      <code>{children}</code>
    </pre>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" }) {
  const tones = {
    neutral: "border-line-strong text-ink-soft",
    ok: "border-ok/40 text-ok",
    warn: "border-warn/40 text-warn",
    bad: "border-bad/40 text-bad",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${tones[tone]}`}>
      {children}
    </span>
  );
}
