"use client";

import { cn } from "@/lib/utils";
import { ThumbsUpIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CodeBlockProps {
  language: string;
  code: string;
  className?: string;
}

export function CodeBlock({ language, code, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden mt-3",
        "bg-[#1A1A1A]",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <span className="text-xs font-medium text-white/70">{language}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150"
            onClick={() => {}}
            aria-label="Like code"
          >
            <ThumbsUpIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150"
            onClick={handleCopy}
            aria-label={copied ? "Copied!" : "Copy code"}
          >
            <CopyIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Code content */}
      <pre className="overflow-x-auto p-4">
        <code className="text-[13px] leading-relaxed font-mono text-[#F0F0F0]">
          {code}
        </code>
      </pre>
    </div>
  );
}

interface UserMessageProps {
  message: string;
  repo?: string;
  className?: string;
}

export function UserMessage({ message, repo, className }: UserMessageProps) {
  return (
    <div className={cn("flex justify-end animate-rise", className)}>
      <div className="flex items-start gap-3 max-w-[70%]">
        <div className="rounded-2xl rounded-br-md bg-card px-5 py-3 shadow-neumorph border border-border/40">
          {repo && (
            <p className="text-[10px] font-mono tracking-wide text-muted-foreground uppercase mb-1">
              {repo}
            </p>
          )}
          <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
            {message}
          </p>
        </div>
        <div className="size-8 rounded-full overflow-hidden shrink-0 mt-1 shadow-floating">
          <img 
            src="https://images.unsplash.com/photo-1494790108755-2616b612b786?w=64&h=64&fit=crop&crop=face" 
            alt="User avatar"
            className="size-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}

interface AIMessageProps {
  message: string;
  codeBlocks?: Array<{ language: string; code: string }>;
  className?: string;
}

export function AIMessage({ message, codeBlocks, className }: AIMessageProps) {
  return (
    <div className={cn("flex justify-start animate-rise", className)}>
      <div className="w-full max-w-[90%]">
        <div className="rounded-2xl ai-message-container shadow-floating">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
            {message}
          </p>

          {codeBlocks && codeBlocks.length > 0 && (
            <div className="space-y-3 mt-3">
              {codeBlocks.map((block, idx) => (
                <CodeBlock
                  key={idx}
                  language={block.language}
                  code={block.code}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
