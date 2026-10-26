"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  PaperclipIcon,
  MicIcon,
  SendIcon,
  CodeIcon,
} from "lucide-react";

interface InputToolbarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contextTokens?: { used: number; total: number };
}

export function InputToolbar({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask me something.....",
  disabled = false,
  className,
  contextTokens = { used: 57500, total: 200000 },
}: InputToolbarProps) {
  const [mode, setMode] = useState<"chat" | "code">("code");
  const [model] = useState("Claude 3.5 Sonnet");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  };

  const percentage = ((contextTokens.used / contextTokens.total) * 100).toFixed(2);
  const formattedUsed = (contextTokens.used / 1000).toFixed(1);
  const formattedTotal = (contextTokens.total / 1000).toFixed(0);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Mode and model selector pills — above input */}
      <div className="flex items-center gap-2 px-1">
        {/* Code mode toggle */}
        <button
          onClick={() => setMode(mode === "chat" ? "code" : "chat")}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
            "text-xs font-medium transition-all duration-200",
            mode === "code"
              ? "bg-card border-border/80 text-foreground shadow-neumorph-inset"
              : "bg-card border-border/60 text-muted-foreground hover:border-primary/30 shadow-neumorph"
          )}
        >
          <CodeIcon className="size-3" />
          Code
        </button>

        {/* Model selector */}
        <button
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
            "text-xs font-medium transition-all duration-200",
            "bg-card border-border/60 text-muted-foreground hover:border-primary/30 shadow-neumorph"
          )}
        >
          <span className="text-[#E8651A]">✸</span>
          {model}
        </button>
      </div>

      {/* Main input container */}
      <div className="relative rounded-[24px] bg-card shadow-neumorph p-3 glass-effect">
        <div className="flex items-start gap-2">
          {/* Left action icons */}
          <div className="flex items-center gap-0.5 pt-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground transition-colors duration-150"
              aria-label="Attach file"
              disabled={disabled}
            >
              <PaperclipIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground transition-colors duration-150"
              aria-label="Voice input"
              disabled={disabled}
            >
              <MicIcon className="size-4" />
            </Button>
          </div>

          {/* Input field */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-[15px] leading-relaxed",
              "placeholder:text-muted-foreground/60",
              "focus:outline-none",
              "min-h-[40px] max-h-[200px] overflow-y-auto py-2"
            )}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
          />

          {/* Send button */}
          <Button
            onClick={onSubmit}
            disabled={!value.trim() || disabled}
            size="icon"
            className={cn(
              "shrink-0 rounded-full bg-primary-gradient",
              "hover:scale-105 active:scale-95 transition-transform duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
              "shadow-floating glow-primary"
            )}
            aria-label="Send message"
          >
            <SendIcon className="size-4 text-white" />
          </Button>
        </div>
      </div>

      {/* Token counter — bottom right */}
      <div className="flex items-center justify-end px-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-card shadow-neumorph border border-border/40 px-3 py-1.5 text-xs text-muted-foreground tabular-nums">
          <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="8" opacity="0.3" />
            <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="font-medium">{formattedUsed}k</span>
          <span>/</span>
          <span>{formattedTotal}k</span>
          <span className="ml-1">{percentage}%</span>
        </div>
      </div>
    </div>
  );
}
