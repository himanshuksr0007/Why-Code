"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModelPicker } from "@/components/chat/model-picker";
import { TokenUsageChip } from "@/components/chat/token-usage-chip";
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
  /**
   * Real token usage for the active model, fetched from the backend.
   * The meter renders only when this is provided — there is no
   * placeholder value.
   */
  contextTokens?: { used: number; total: number } | null;
}

export function InputToolbar({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask me something.....",
  disabled = false,
  className,
  contextTokens = null,
}: InputToolbarProps) {
  const [mode, setMode] = useState<"chat" | "code">("code");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  };



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
        <ModelPicker disabled={disabled} />
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

      {/* Token counter — bottom right. Real usage from the backend for
          the active model; hidden until the first successful read. */}
      {contextTokens && contextTokens.total > 0 ? (
        <div className="flex items-center justify-end px-2">
          <TokenUsageChip used={contextTokens.used} total={contextTokens.total} />
        </div>
      ) : null}
    </div>
  );
}
