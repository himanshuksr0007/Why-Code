"use client";

import { useTheme } from "next-themes";
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import { API_BASE_URL, API_MODE, TARGET_REPO } from "@/lib/api/config";
import { clearChats, useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

const THEMES = [
  {
    value: "system",
    label: "System",
    description: "Follow the operating system preference.",
    icon: MonitorIcon,
  },
  {
    value: "light",
    label: "Light",
    description: "Always use the light theme.",
    icon: SunIcon,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark theme.",
    icon: MoonIcon,
  },
] as const;

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <h2 className="font-heading text-sm font-semibold">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-sm">{value}</dd>
    </div>
  );
}

export function SettingsView() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { chats } = useChatStore();
  const mounted = useMounted();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Appearance, the answer service this UI talks to, and your local
          data. Nothing here needs an account.
        </p>
      </header>

      <div className="mt-6 space-y-4">
        <Panel
          title="Appearance"
          description="System is the default and follows your OS. The choice is saved on this device."
        >
          <div
            role="radiogroup"
            aria-label="Colour theme"
            className="grid gap-2 sm:grid-cols-3"
          >
            {THEMES.map((option) => {
              const Icon = option.icon;
              const active = mounted && theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "relative rounded-xl border p-3.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/70 bg-background hover:bg-accent/60",
                  )}
                >
                  {active ? (
                    <CheckIcon
                      className="absolute top-2.5 right-2.5 size-4 text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="mt-2 block text-sm font-medium">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
            {mounted
              ? `Currently showing the ${resolvedTheme ?? "…"} theme.`
              : " "}
          </p>
        </Panel>

        <Panel
          title="Answer service"
          description="Set at build time with NEXT_PUBLIC_* environment variables, so no credentials ever live in the browser."
        >
          <dl className="divide-y divide-border/60">
            <Row label="Mode" value={API_MODE} />
            <Row label="Base URL" value={API_BASE_URL} />
            <Row label="Default repository" value={TARGET_REPO} />
          </dl>
        </Panel>

        <Panel
          title="Local data"
          description="Chats are stored only in this browser. Clearing them cannot be undone."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {chats.length} conversation{chats.length === 1 ? "" : "s"} saved
            </p>
            <Button
              type="button"
              variant="destructive"
              disabled={chats.length === 0}
              onClick={() => {
                clearChats();
                toast.success("Chat history cleared");
              }}
            >
              <Trash2Icon aria-hidden="true" />
              Clear chat history
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
