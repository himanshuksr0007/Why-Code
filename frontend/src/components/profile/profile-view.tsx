"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { RepoSelect } from "@/components/ask/repo-select";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { clearChats, useChatStore } from "@/lib/chat/store";
import { useMounted } from "@/hooks/use-mounted";
import { useLocalProfile } from "@/lib/local/profile";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
] as const;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
      <dd className="font-heading text-2xl font-semibold tabular-nums">
        {value}
      </dd>
      <dt className="mt-0.5 text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

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
    <section className="rounded-xl border border-border/70 bg-card p-5">
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

export function ProfileView() {
  const { profile, update } = useLocalProfile();
  const { chats } = useChatStore();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const [confirming, setConfirming] = useState(false);

  const questions = chats.reduce((total, chat) => total + chat.turns.length, 0);
  const repositories = new Set(chats.map((chat) => chat.repo)).size;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border/70 bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <PersonAvatar
            login={profile.handle || profile.display_name}
            size="lg"
            className="size-14 text-lg"
          />
          <div className="min-w-0 flex-1">
            <label
              htmlFor="profile-display-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Display name
            </label>
            <Input
              id="profile-display-name"
              value={profile.display_name}
              maxLength={48}
              autoComplete="off"
              onChange={(event) => update({ display_name: event.target.value })}
              className="mt-1 max-w-sm"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-mono">@{profile.handle}</span> · Local
              profile, not connected to GitHub.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="activity-heading">
        <h2
          id="activity-heading"
          className="mb-2 font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Activity
        </h2>
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Conversations" value={chats.length} />
          <Stat label="Questions" value={questions} />
          <Stat label="Repositories" value={repositories} />
        </dl>
      </section>

      <Panel
        title="Preferences"
        description="Applied to every new question in this browser."
      >
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium">
              Repository{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Required. Every screen — answers, changes, people, dashboard —
              follows this choice.
            </p>
            <RepoSelect
              className="mt-2"
              value={profile.default_repo}
              onChange={(slug) => update({ default_repo: slug })}
            />
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium">Appearance</p>
            <div className="mt-2 inline-flex gap-0.5 rounded-lg border border-border/70 bg-muted/30 p-0.5">
              {THEMES.map((option) => {
                const Icon = option.icon;
                // `theme` is only known after hydration, so the pressed state is
                // applied on the client render to avoid a hydration mismatch.
                const active = mounted && theme === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                    aria-pressed={active}
                    onClick={() => setTheme(option.value)}
                    className={cn("gap-1.5", active && "shadow-sm")}
                  >
                    <Icon aria-hidden="true" />
                    {option.label}
                    {active ? (
                      <CheckIcon className="size-3" aria-hidden="true" />
                    ) : null}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Data"
        description="Conversations are stored only in this browser's local storage."
      >
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {chats.length === 0
              ? "No saved conversations."
              : `${chats.length} conversation${chats.length === 1 ? "" : "s"} · ${questions} question${questions === 1 ? "" : "s"}`}
          </p>
          <div className="ml-auto flex gap-2">
            {confirming ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    clearChats();
                    setConfirming(false);
                    toast.success("Chat history cleared");
                  }}
                >
                  <Trash2Icon aria-hidden="true" />
                  Delete everything
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={chats.length === 0}
                onClick={() => setConfirming(true)}
              >
                <Trash2Icon aria-hidden="true" />
                Clear chat history
              </Button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
