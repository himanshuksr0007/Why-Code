"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

/** A code block with a copy button that confirms with a short animation. */
export function CopyCode({ code, label = "Copy code" }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable (insecure context, permissions); the
      // text is still selectable, so fail quietly.
    }
  };

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-xl border border-line bg-surface p-4 pr-14 font-mono text-[13px] leading-relaxed text-ink transition-colors duration-300 group-hover:border-line-strong">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : label}
        className="absolute top-2.5 right-2.5 flex size-8 cursor-pointer items-center justify-center rounded-md border border-line bg-raised text-ink-soft opacity-70 transition-all duration-200 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100"
      >
        <span className="relative size-4">
          <CopyIcon
            className={`absolute inset-0 size-4 transition-all duration-300 ${copied ? "scale-50 opacity-0" : "scale-100 opacity-100"}`}
            aria-hidden="true"
          />
          <CheckIcon
            className={`absolute inset-0 size-4 text-ok transition-all duration-300 ${copied ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
            aria-hidden="true"
          />
        </span>
      </button>
      <span
        role="status"
        className={`pointer-events-none absolute top-3 right-12 rounded-md bg-ink px-2 py-0.5 font-mono text-[11px] text-canvas transition-all duration-300 ${
          copied ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0"
        }`}
      >
        {copied ? "copied" : ""}
      </span>
    </div>
  );
}
