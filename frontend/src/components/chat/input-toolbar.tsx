"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeSwitch } from "@/components/chat/mode-switch";
import { ModelPicker } from "@/components/chat/model-picker";
import { TokenUsageChip } from "@/components/chat/token-usage-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CameraIcon,
  FileTextIcon,
  MicIcon,
  PaperclipIcon,
  SendIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  captureScreenshot,
  readFileAttachment,
  type ComposerAttachment,
} from "@/lib/attachments";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import { useSpeechInput } from "@/lib/speech";

interface InputToolbarProps {
  value: string;
  onChange: (value: string) => void;
  /** Called with the composer's attachments; the workspace inlines
   * text files into the question it sends and stores the rest on the
   * turn. */
  onSubmit: (attachments: ComposerAttachment[]) => void;
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);

  const valueRef = useRef(value);
  valueRef.current = value;
  const speech = useSpeechInput({ valueRef, onChange });

  // Autosize: the box grows with the draft (up to 200px) and — because
  // this runs on every value change, including the clear after a
  // send — shrinks straight back to its resting height afterwards.
  useEffect(() => {
    const target = textareaRef.current;
    if (!target) return;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
  }, [value]);

  const canSubmit =
    (value.trim().length > 0 || attachments.length > 0) && !disabled;

  const submit = () => {
    if (!canSubmit) return;
    speech.stop();
    onSubmit(attachments);
    setAttachments([]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") {
      e.preventDefault();
      fileInputRef.current?.click();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const result = await readFileAttachment(file);
      if (result.ok) {
        setAttachments((current) => [...current, result.attachment]);
      } else {
        toast.error(result.reason);
      }
    }
  };

  const addScreenshot = async () => {
    try {
      const shot = await captureScreenshot();
      if (shot) {
        setAttachments((current) => [...current, shot]);
        hapticLight();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not take a screenshot",
      );
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Ask mode (Why? / Plan) and model selector pills — above input.
          The old "Code" toggle that sat here only restyled itself; the
          mode switch is wired into every ask. */}
      <div className="flex items-center gap-2 px-1">
        <ModeSwitch disabled={disabled} />

        {/* Model selector */}
        <ModelPicker disabled={disabled} />
      </div>

      {/* Main input container */}
      <div className="relative rounded-[24px] bg-card shadow-neumorph p-3 glass-effect">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-2" aria-label="Attachments">
            {attachments.map((item) => (
              <span
                key={item.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-background/60 py-1 pr-1 pl-2 text-xs text-foreground"
              >
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.content}
                    alt=""
                    className="size-5 rounded-full object-cover"
                  />
                ) : (
                  <FileTextIcon className="size-3.5 shrink-0 text-primary" />
                )}
                <span className="max-w-40 truncate">{item.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatSize(item.size)}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((entry) => entry.id !== item.id),
                    )
                  }
                  className="grid size-4.5 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-start gap-2">
          {/* Left action icons */}
          <div className="flex items-center gap-0.5 pt-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Attach"
                disabled={disabled}
                className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 outline-none hover:bg-accent/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              >
                <PaperclipIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={8}>
                <DropdownMenuItem
                  onClick={() => {
                    hapticSelection();
                    fileInputRef.current?.click();
                  }}
                >
                  <UploadIcon className="size-4" />
                  <span className="flex-1">Upload or add files</span>
                  <kbd className="text-[10px] text-muted-foreground">Ctrl+U</kbd>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    hapticSelection();
                    void addScreenshot();
                  }}
                >
                  <CameraIcon className="size-4" />
                  <span className="flex-1">Take a screenshot</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(
                "text-muted-foreground transition-colors duration-150 hover:text-foreground",
                speech.listening &&
                  "bg-primary/15 text-primary hover:text-primary",
              )}
              aria-label={speech.listening ? "Stop voice input" : "Voice input"}
              aria-pressed={speech.listening}
              disabled={disabled}
              onClick={() => {
                hapticLight();
                speech.toggle();
              }}
            >
              <MicIcon
                className={cn("size-4", speech.listening && "animate-pulse")}
              />
            </Button>
          </div>

          {/* Input field */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={speech.listening ? "Listening… speak now" : placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-[15px] leading-relaxed",
              "placeholder:text-muted-foreground/60",
              "focus:outline-none",
              "min-h-[40px] max-h-[200px] overflow-y-auto py-2"
            )}
          />

          {/* Send button */}
          <Button
            onClick={submit}
            disabled={!canSubmit}
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
