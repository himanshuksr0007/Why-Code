"use client";

import { useRef } from "react";

import { hapticSelection } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Six-box one-time-code input: auto-advances as digits land, Backspace
 * walks back, and a pasted code fills every box at once.
 */
export function OtpInput({
  value,
  onChange,
  disabled = false,
  invalid = false,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const focusBox = (index: number) => {
    refs.current[Math.max(0, Math.min(5, index))]?.focus();
  };

  const setDigit = (index: number, digit: string) => {
    const next = value.padEnd(6, " ").split("");
    next[index] = digit;
    onChange(next.join("").replace(/ /g, ""));
  };

  return (
    <div
      className="flex items-center justify-center gap-2"
      role="group"
      aria-label="Verification code"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1} of 6`}
          disabled={disabled}
          value={value[index] ?? ""}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            if (!digits) {
              setDigit(index, "");
              return;
            }
            if (digits.length > 1) {
              // A paste (or autofill) into any box fills from that box.
              const merged = (value.slice(0, index) + digits).slice(0, 6);
              onChange(merged);
              focusBox(Math.min(5, index + digits.length));
              if (merged.length === 6) hapticSelection();
              return;
            }
            setDigit(index, digits);
            hapticSelection();
            if (index < 5) focusBox(index + 1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !value[index] && index > 0) {
              event.preventDefault();
              setDigit(index - 1, "");
              focusBox(index - 1);
            }
            if (event.key === "ArrowLeft") focusBox(index - 1);
            if (event.key === "ArrowRight") focusBox(index + 1);
          }}
          onFocus={(event) => event.target.select()}
          className={cn(
            "size-12 rounded-xl border bg-background/60 text-center font-mono text-lg font-semibold text-foreground shadow-[inset_2px_2px_5px_var(--neu-dark),inset_-2px_-2px_5px_var(--neu-light)] outline-none transition",
            "focus:border-primary/60 focus:ring-2 focus:ring-ring/40",
            invalid
              ? "border-destructive/70"
              : "border-border/70",
            disabled && "opacity-50",
          )}
        />
      ))}
    </div>
  );
}
