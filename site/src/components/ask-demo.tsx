"use client";

import { useEffect, useState } from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * A scripted replay of one answered question and one refused question,
 * in the exact shape the API returns. Labelled as a replay on the page.
 */
const SCRIPTS = [
  {
    q: "Why are retries disabled by default?",
    a: [
      { t: "Retries are off by default because retrying POSTs duplicated orders [E1].", tone: "ink" },
      { t: "Callers opt in per request when the call is idempotent [E1].", tone: "ink" },
      { t: "" },
      { t: "[E1] shop/client.py:2-3 · verified", tone: "ok" },
      { t: "decision dec_1a2b… · active · pinned", tone: "soft" },
      { t: "confidence medium · citation_valid true", tone: "soft" },
    ],
  },
  {
    q: "Why does the app use a purple logo?",
    a: [
      { t: "insufficient_evidence", tone: "warn" },
      { t: "Why-Code could not find evidence in this repository", tone: "ink" },
      { t: "that answers the question, so it will not guess.", tone: "ink" },
      { t: "" },
      { t: "evidence []  ·  confidence none", tone: "soft" },
    ],
  },
] as const;

export function AskDemo() {
  const [script, setScript] = useState(0);
  const [typed, setTyped] = useState(0);
  const [shown, setShown] = useState(0);
  const reduced = useReducedMotion();

  const current = SCRIPTS[script];

  useEffect(() => {
    if (reduced) return;
    if (typed < current.q.length) {
      const t = window.setTimeout(() => setTyped((n) => n + 1), 32);
      return () => window.clearTimeout(t);
    }
    if (shown < current.a.length) {
      const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 650 : 220);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setScript((s) => (s + 1) % SCRIPTS.length);
      setTyped(0);
      setShown(0);
    }, 3800);
    return () => window.clearTimeout(t);
  }, [typed, shown, current, reduced]);

  // With reduced motion, show the first script complete and static.
  const typedView = reduced ? current.q.length : typed;
  const shownView = reduced ? current.a.length : shown;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(255,255,255,0.12)]">
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="ml-2 font-mono text-[11px] text-ink-faint">POST /api/v1/ask · replay</span>
      </div>
      <p className="sr-only">
        Replay of two questions. “Why are retries disabled by default?” is answered with a citation to
        shop/client.py lines 2 to 3, verified. “Why does the app use a purple logo?” is refused with
        insufficient evidence.
      </p>
      <div className="min-h-[240px] p-5 font-mono text-[13px] leading-relaxed" aria-hidden="true">
        <p className="text-ink">
          <span className="text-ink-faint">› </span>
          {current.q.slice(0, typedView)}
          {typedView < current.q.length ? <span className="caret ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-ink" /> : null}
        </p>
        <div className="mt-4 space-y-0.5">
          {current.a.slice(0, shownView).map((line, i) => (
            <p
              key={`${script}-${i}`}
              className={`rise min-h-[1.2em] ${
                "tone" in line && line.tone === "ok"
                  ? "text-ok"
                  : "tone" in line && line.tone === "warn"
                    ? "text-warn"
                    : "tone" in line && line.tone === "soft"
                      ? "text-ink-faint"
                      : "text-ink"
              }`}
            >
              {line.t}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
