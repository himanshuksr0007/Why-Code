"use client";

import { ListTreeIcon, MessageCircleQuestionIcon } from "lucide-react";

import type { AskMode } from "@/lib/api/types";
import { setMode, useMode } from "@/lib/modes/store";
import { cn } from "@/lib/utils";

const MODES: {
  id: AskMode;
  label: string;
  title: string;
  Icon: typeof MessageCircleQuestionIcon;
}[] = [
  {
    id: "why",
    label: "Why?",
    title: "Why mode: answers grounded in the decisions and evidence",
    Icon: MessageCircleQuestionIcon,
  },
  {
    id: "plan",
    label: "Plan",
    title: "Plan mode: a code timeline and connection graph for building it",
    Icon: ListTreeIcon,
  },
];

/**
 * The ask-mode switch: two bubble options in one pill, in the site's
 * neumorphic language. It replaced the old "Code" toggle, whose state
 * never left the toolbar and changed nothing.
 */
export function ModeSwitch({ disabled = false }: { disabled?: boolean }) {
  const mode = useMode();

  return (
    <div
      role="group"
      aria-label="Ask mode"
      className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-card p-0.5 shadow-neumorph"
    >
      {MODES.map(({ id, label, title, Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            title={title}
            onClick={() => setMode(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
              "text-xs font-medium transition-all duration-200",
              "outline-none disabled:pointer-events-none disabled:opacity-60",
              active
                ? "bg-primary/10 text-foreground shadow-neumorph-inset"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon
              className={cn("size-3.5", active && "text-primary")}
              aria-hidden="true"
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
