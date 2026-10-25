"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Clickable example questions — the fastest path to a first answer. */
export function ExampleQuestions({
  questions,
  onSelect,
  disabled = false,
  className,
  label = "Try an example",
  labelClassName,
  align = "start",
  tone = "default",
}: {
  questions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  labelClassName?: string;
  /** `center` centres the label and lays the examples out as a grid. */
  align?: "start" | "center";
  /** `onLight` keeps the buttons legible over the aurora hero. */
  tone?: "default" | "onLight" | "onAurora";
}) {
  const centered = align === "center";
  const onLight = tone === "onLight";
  const onAurora = tone === "onAurora";

  return (
    <div className={cn("space-y-2", centered && "text-center", className)}>
      <p className={cn("text-xs font-medium text-muted-foreground", labelClassName)}>
        {label}
      </p>
      <ul
        className={cn(
          "gap-2",
          centered
            ? "grid text-left sm:grid-cols-2"
            : "flex flex-wrap",
        )}
      >
        {questions.map((question) => (
          <li key={question} className={cn(centered && "min-w-0")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onSelect(question)}
              className={cn(
                "h-auto py-1.5 text-left font-normal whitespace-normal",
                onLight &&
                  "border-zinc-900/20 bg-white/35 text-zinc-900 shadow-sm hover:border-zinc-900/30 hover:bg-white/55 hover:text-zinc-950",
                onAurora &&
                  "border-white/20 bg-background/60 text-foreground shadow-sm backdrop-blur-sm hover:border-white/30 hover:bg-background/80 hover:text-foreground",
                centered
                  ? "w-full items-start justify-start px-3 py-2.5 leading-relaxed"
                  : "max-w-full",
              )}
            >
              {question}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
