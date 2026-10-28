"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  LayoutGridIcon,
  CalendarIcon,
  BellIcon,
  BookmarkIcon,
  StarIcon,
  SettingsIcon,
  UserIcon,
  ShieldIcon,
  PaletteIcon,
  KeyIcon,
  DatabaseIcon,
  DownloadIcon,
  TrashIcon,
  Trash2Icon,
  SaveIcon,
  CpuIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  CheckIcon,
  LockIcon,
  XIcon,
  ActivityIcon,
  VibrateIcon,
} from "lucide-react";
import { useLocalProfile } from "@/lib/local/profile";
import { useIdentity } from "@/lib/identity";
import { useChatStore, clearChats } from "@/lib/chat/store";
import {
  hapticSelection,
  hapticSuccess,
  hapticSupport,
  runHapticDiagnostic,
  setHapticsEnabled,
  useHapticsEnabled,
  type HapticDiagnostic,
  type HapticSupport,
} from "@/lib/haptics";
import { useMounted } from "@/hooks/use-mounted";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TabType =
  | "profile"
  | "activity"
  | "notifications"
  | "data"
  | "appearance"
  | "system";

export default function SettingsPage() {
  const { profile, update, hydrated } = useLocalProfile();
  const identity = useIdentity();
  const { chats } = useChatStore();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [defaultRepo, setDefaultRepo] = useState("");
  const [formSeeded, setFormSeeded] = useState(false);

  // The form seeds once the stores have read local storage — the
  // first (server/hydration) snapshot only carries placeholders, so
  // initializing state from it would freeze the wrong identity in
  // the inputs.
  useEffect(() => {
    if (!hydrated || formSeeded) return;
    setDisplayName(identity.name || "");
    setHandle(identity.handle || "");
    setDefaultRepo(profile.default_repo || "");
    setFormSeeded(true);
  }, [hydrated, formSeeded, identity, profile]);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    mentions: true,
    updates: false,
  });
  const [language, setLanguage] = useState("en");
  const [autoSave, setAutoSave] = useState(true);

  const questions = chats.reduce((total, chat) => total + chat.turns.length, 0);
  const repositories = new Set(chats.map((chat) => chat.repo)).size;

  const handleSaveProfile = () => {
    if (identity.isAccount) {
      // Name and handle belong to the account; only the workspace
      // default is local.
      update({ default_repo: defaultRepo });
    } else {
      update({
        display_name: displayName,
        handle: handle,
        default_repo: defaultRepo,
      });
    }
    toast.success("Profile updated successfully");
  };

  const handleExportData = () => {
    const data = {
      profile,
      notifications,
      settings: { theme, language, autoSave },
      chatsCount: chats.length,
      questionsCount: questions,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whycode-profile-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported successfully");
  };

  const handleClearCache = () => {
    if (confirm("Are you sure you want to clear all cached data?")) {
      localStorage.clear();
      sessionStorage.clear();
      toast.success("Cache cleared successfully");
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const tabs = [
    { id: "profile" as TabType, label: "Profile", icon: LayoutGridIcon },
    { id: "activity" as TabType, label: "Activity", icon: CalendarIcon },
    { id: "notifications" as TabType, label: "Notifications", icon: BellIcon },
    { id: "data" as TabType, label: "Data & Storage", icon: BookmarkIcon },
    { id: "appearance" as TabType, label: "Appearance", icon: StarIcon },
    { id: "system" as TabType, label: "System & Security", icon: SettingsIcon },
  ];

  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  return (
    <div className="flex flex-1 flex-col min-h-0 w-full max-w-4xl mx-auto py-6 sm:py-8 md:pl-[67px]">
      {/* 3D Floating Liquid Glass Bubble Header */}
      <div className="relative mb-6 overflow-hidden rounded-3xl liquid-glass-bubble p-5 sm:p-6 transition-all duration-300 hover:translate-y-[-2px]">
        {/* Specular gloss highlights & reflections */}
        <div
          className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/75 via-white/25 to-transparent dark:from-white/10 dark:via-white/5 pointer-events-none rounded-t-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -top-12 -left-12 size-36 rounded-full bg-primary/20 blur-2xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-8 -right-8 size-28 rounded-full bg-[#E1A46B]/25 blur-xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Content inside the floating bubble */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex size-12 sm:size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#CC8D51] to-[#E1A46B] text-white shadow-[0_8px_20px_rgba(204,141,81,0.35),inset_0_1.5px_2px_rgba(255,255,255,0.7)] shrink-0">
              <SettingsIcon className="size-6 sm:size-7 drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Profile &amp; Settings
                </h1>
                <span className="hidden sm:inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono font-medium text-primary uppercase tracking-wider shadow-sm">
                  Preferences
                </span>
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Manage your account, personal details, and workspace preferences
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 rounded-full border border-border/80 bg-card/60 dark:border-white/10 dark:bg-white/5 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur-md shadow-sm">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Session</span>
          </div>
        </div>
      </div>

      {/* Desktop Vertical Navigation Rail in the right empty area */}
      <nav
        aria-label="Profile navigation"
        className="hidden xl:flex fixed top-32 right-12 xl:right-20 2xl:right-28 z-30 flex-col items-center select-none"
      >
        {tabs.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          // The line below the active item is bold, or if the last item is active, the line above it is bold
          const isNextLineActive =
            isActive || (activeIndex === tabs.length - 1 && idx === tabs.length - 2);

          return (
            <div key={tab.id} className="flex flex-col items-center">
              {/* Icon Container with Tooltip */}
              <div className="relative flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "group relative flex items-center justify-center transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer",
                    isActive
                      ? "size-12 rounded-2xl bg-primary/15 dark:bg-primary/25 border border-primary/35 dark:border-primary/45 text-primary shadow-[0_4px_16px_rgba(204,141,81,0.25)] ring-1 ring-primary/20 scale-105"
                      : "size-10 rounded-xl text-muted-foreground/80 hover:text-foreground hover:bg-card/80 hover:scale-110"
                  )}
                  aria-label={tab.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "size-5 transition-transform duration-200",
                      isActive && "scale-105 stroke-[2.25]"
                    )}
                  />

                  {/* Selected indicator badge on the icon */}
                  {isActive && (
                    <span className="absolute top-2 right-2 size-2 rounded-full bg-primary ring-2 ring-card dark:ring-[#1c1613] shadow-sm animate-pulse" />
                  )}

                  {/* Speech bubble tooltip on hover - ONLY visible when hovered */}
                  <div
                    role="tooltip"
                    className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 scale-95 translate-x-1 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 transition-all duration-200 ease-out"
                  >
                    <div className="relative flex items-center px-4 py-2 rounded-2xl bg-card dark:bg-[#1c1613] text-foreground text-sm font-semibold tracking-tight shadow-floating-lg border border-border/80 dark:border-white/10 whitespace-nowrap">
                      {/* Left-pointing arrow caret */}
                      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 size-3 bg-card dark:bg-[#1c1613] border-l border-b border-border/80 dark:border-white/10 rotate-45" />
                      <span className="relative z-10">{tab.label}</span>
                    </div>
                  </div>
                </button>
              </div>

              {/* Connecting line between icons with centered dot */}
              {idx < tabs.length - 1 && (
                <div className="relative flex flex-col items-center justify-center my-1.5 h-8">
                  {/* Vertical line: bold if connected to selected item */}
                  <div
                    className={cn(
                      "h-full transition-all duration-300 rounded-full",
                      isNextLineActive
                        ? "w-[3px] bg-primary dark:bg-primary shadow-[0_0_10px_rgba(204,141,81,0.55)]"
                        : "w-[1.5px] bg-border/80 dark:bg-white/15"
                    )}
                  />
                  {/* Node dot in center of line: filled/active if bold */}
                  <div
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-300",
                      isNextLineActive
                        ? "size-2.5 bg-primary ring-4 ring-primary/25 shadow-sm"
                        : "size-1.5 bg-border/90 dark:bg-white/25"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex-1">
        <div>
          {/* Mobile / Tablet Tabs (Hidden on Desktop) */}
          <div className="flex xl:hidden gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap shadow-sm cursor-pointer",
                  activeTab === tab.id
                    ? "bg-primary text-white shadow-floating font-semibold"
                    : "bg-card/90 text-muted-foreground hover:bg-card hover:text-foreground"
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* 1. Profile Tab (Grid Icon) */}
          {activeTab === "profile" && (
            <div className="space-y-6 animate-scale">
              <div className="rounded-2xl bg-card shadow-neumorph p-6 border border-border/60">
                <div className="flex items-center gap-4 mb-6">
                  <PersonAvatar
                    login={identity.handle || identity.name}
                    size="lg"
                    className="size-14 text-lg ring-2 ring-primary/20"
                  />
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Personal Information
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {identity.isAccount
                        ? "Your WhyCode account details and default workspace"
                        : "Update your local account details and default workspace"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your display name"
                      readOnly={identity.isAccount}
                      className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all read-only:cursor-not-allowed read-only:opacity-70"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Username / Handle
                    </label>
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@username"
                      readOnly={identity.isAccount}
                      className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm read-only:cursor-not-allowed read-only:opacity-70"
                    />
                    {identity.isAccount && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Signed in as {identity.email} — your name and handle
                        come from your account.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Default Repository
                    </label>
                    <input
                      type="text"
                      value={defaultRepo}
                      onChange={(e) => setDefaultRepo(e.target.value)}
                      placeholder="owner/repo (e.g. tiangolo/fastapi)"
                      className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Answers, graph queries, and timeline exploration follow this choice by default.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <Button
                      onClick={handleSaveProfile}
                      className="bg-primary-gradient text-white font-medium shadow-floating hover-lift transition-all duration-200 hover:shadow-floating-lg cursor-pointer"
                    >
                      <SaveIcon className="size-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDisplayName(identity.name || "");
                        setHandle(identity.handle || "");
                        setDefaultRepo(profile.default_repo || "");
                        toast.info("Changes discarded");
                      }}
                      className="cursor-pointer"
                    >
                      <XIcon className="size-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Activity Tab (Calendar Icon) */}
          {activeTab === "activity" && (
            <div className="space-y-6 animate-scale">
              <div className="rounded-2xl bg-card shadow-neumorph p-6 border border-border/60">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <CalendarIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Activity &amp; Workspace Stats
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Summary of queries and conversations in this browser
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="rounded-xl border border-border/70 bg-background/50 p-4">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Conversations
                    </p>
                    <p className="mt-1.5 font-heading text-3xl font-bold tabular-nums text-foreground">
                      {chats.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Stored active chats</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/50 p-4">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Questions Asked
                    </p>
                    <p className="mt-1.5 font-heading text-3xl font-bold tabular-nums text-foreground">
                      {questions}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Decisions explored</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/50 p-4">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Repositories
                    </p>
                    <p className="mt-1.5 font-heading text-3xl font-bold tabular-nums text-foreground">
                      {repositories}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Explored codebases</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Local Session Status</p>
                      <p className="text-xs text-muted-foreground">
                        All conversation state is kept in local browser storage.
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-card border border-border/70 text-muted-foreground">
                    Private &amp; Offline
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 3. Notifications Tab (Bell Icon) */}
          {activeTab === "notifications" && (
            <div className="space-y-6 animate-scale">
              <div className="rounded-2xl bg-card shadow-neumorph p-6 border border-border/60">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <BellIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Notifications
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Manage alert preferences and system notifications
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      key: "email",
                      label: "Email Notifications",
                      description: "Receive updates, weekly digests, and answer exports via email",
                    },
                    {
                      key: "push",
                      label: "Browser Push Notifications",
                      description: "Desktop notifications when background queries complete",
                    },
                    {
                      key: "mentions",
                      label: "Mentions & Author Activity",
                      description: "Alert when indexed authors update pull requests",
                    },
                    {
                      key: "updates",
                      label: "Model & Ingestion Updates",
                      description: "Alerts when new repository versions are indexed",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between py-3.5 border-b border-border/40 last:border-0"
                    >
                      <div className="flex-1 pr-4">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNotifications({
                            ...notifications,
                            [item.key]: !notifications[item.key as keyof typeof notifications],
                          });
                          toast.success(
                            `${item.label} ${
                              !notifications[item.key as keyof typeof notifications]
                                ? "enabled"
                                : "disabled"
                            }`
                          );
                        }}
                        className={cn(
                          "relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer shrink-0",
                          notifications[item.key as keyof typeof notifications]
                            ? "bg-primary"
                            : "bg-border"
                        )}
                        aria-label={item.label}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm",
                            notifications[item.key as keyof typeof notifications] &&
                              "translate-x-6"
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. Data & Storage Tab (Bookmark Icon) */}
          {activeTab === "data" && (
            <div className="space-y-6 animate-scale">
              <div className="rounded-2xl bg-card shadow-neumorph p-6 border border-border/60">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <BookmarkIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Data &amp; Storage Management
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Backup, export, or clean up your conversation data
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl bg-accent/40 hover:bg-accent/60 text-foreground transition-all duration-200 border border-border/40 text-left cursor-pointer hover:shadow-sm"
                  >
                    <DownloadIcon className="size-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Export All Workspace Data</p>
                      <p className="text-xs text-muted-foreground">
                        Download profile, preferences, and chats as a JSON file
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl bg-accent/40 hover:bg-accent/60 text-foreground transition-all duration-200 border border-border/40 text-left cursor-pointer hover:shadow-sm"
                  >
                    <TrashIcon className="size-5 text-destructive shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Clear Application Cache</p>
                      <p className="text-xs text-muted-foreground">
                        Purge stale cached queries and force reload
                      </p>
                    </div>
                  </button>

                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        Clear All Chat History
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {chats.length === 0
                          ? "No stored conversations."
                          : `${chats.length} conversation${chats.length === 1 ? "" : "s"} will be permanently removed.`}
                      </p>
                    </div>
                    {confirmingClear ? (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmingClear(false)}
                          className="cursor-pointer"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            clearChats();
                            setConfirmingClear(false);
                            toast.success("Chat history cleared");
                          }}
                          className="cursor-pointer"
                        >
                          Confirm Delete
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={chats.length === 0}
                        onClick={() => setConfirmingClear(true)}
                        className="cursor-pointer text-destructive hover:bg-destructive/10"
                      >
                        <Trash2Icon className="size-4 mr-1.5" />
                        Delete Conversations
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Appearance Tab (Star Icon) */}
          {activeTab === "appearance" && (
            <div className="space-y-6 animate-scale">
              <div className="rounded-2xl bg-card shadow-neumorph p-6 border border-border/60">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <StarIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Theme &amp; Visual Style
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Choose your interface appearance and color accents
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {[
                    {
                      value: "light",
                      label: "Light Mode",
                      icon: SunIcon,
                      description: "Warm cream & caramel neumorphic theme with subtle grid",
                    },
                    {
                      value: "dark",
                      label: "Dark Mode",
                      icon: MoonIcon,
                      description: "Deep warm obsidian & glowing amber night theme",
                    },
                    {
                      value: "system",
                      label: "System",
                      icon: MonitorIcon,
                      description: "Syncs automatically with your operating system preference",
                    },
                  ].map((option) => {
                    const active = mounted && theme === option.value;
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setTheme(option.value);
                          hapticSelection();
                          toast.success(`Theme set to ${option.label}`);
                        }}
                        className={cn(
                          "relative flex flex-col items-start p-4 rounded-2xl text-left border transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer",
                          active
                            ? "border-primary bg-primary/10 text-foreground shadow-floating ring-1 ring-primary/40 scale-[1.02]"
                            : "border-border/60 bg-card/60 hover:bg-card text-muted-foreground hover:text-foreground shadow-neumorph hover:translate-y-[-1px]"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-3">
                          <div
                            className={cn(
                              "flex size-9 items-center justify-center rounded-xl transition-colors",
                              active
                                ? "bg-primary text-white"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <Icon className="size-4" />
                          </div>
                          {active && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                              <CheckIcon className="size-3.5" />
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {option.label}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <HapticsCard />
            </div>
          )}

          {/* 6. System & Security Tab (Settings Icon) */}
          {activeTab === "system" && (
            <div className="space-y-6 animate-scale">
              {/* Performance */}
              <div className="rounded-2xl bg-card shadow-neumorph p-6 border border-border/60">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <CpuIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      System &amp; Performance
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Tune workspace caching, autosave, and language
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-border/40">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Auto-save</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Automatically persist chat turns and preferences
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoSave(!autoSave);
                        toast.success(`Auto-save ${!autoSave ? "enabled" : "disabled"}`);
                      }}
                      className={cn(
                        "relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer",
                        autoSave ? "bg-primary" : "bg-border"
                      )}
                      aria-label="Toggle auto-save"
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm",
                          autoSave && "translate-x-6"
                        )}
                      />
                    </button>
                  </div>

                  <div className="py-3 border-b border-border/40">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Language</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Interface display language
                        </p>
                      </div>
                      <select
                        value={language}
                        onChange={(e) => {
                          setLanguage(e.target.value);
                          toast.success("Language updated");
                        }}
                        className="px-3 py-2 rounded-lg border border-border/60 bg-background/50 text-foreground text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                      >
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="ja">日本語</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security */}
              <div className="rounded-2xl bg-card shadow-neumorph p-6 border border-border/60">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <ShieldIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Security &amp; Keys
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Manage authentication and access tokens
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => toast.info("Password change feature coming soon")}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl bg-accent/40 hover:bg-accent/60 text-foreground transition-all duration-200 border border-border/40 text-left cursor-pointer hover:shadow-sm"
                  >
                    <KeyIcon className="size-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Change Password</p>
                      <p className="text-xs text-muted-foreground">
                        Update your account password
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      toast.info("Two-factor authentication feature coming soon")
                    }
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl bg-accent/40 hover:bg-accent/60 text-foreground transition-all duration-200 border border-border/40 text-left cursor-pointer hover:shadow-sm"
                  >
                    <ShieldIcon className="size-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Two-Factor Authentication</p>
                      <p className="text-xs text-muted-foreground">
                        Add an extra layer of protection
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HapticsCard() {
  const enabled = useHapticsEnabled();
  const [support, setSupport] = useState<HapticSupport | null>(null);
  const [diagnostic, setDiagnostic] = useState<HapticDiagnostic | null>(null);
  useEffect(() => {
    setSupport(hapticSupport());
  }, []);

  const toggle = () => {
    const next = !enabled;
    setHapticsEnabled(next);
    // Confirm the switch-on with the very feedback it enables.
    if (next) hapticSelection();
    toast.success(`Haptic feedback ${next ? "enabled" : "disabled"}`);
  };

  const test = () => {
    // A plain direct 200 ms buzz first — the canonical Vibration API
    // demo call — and its acceptance is reported under the card, so
    // a device that stays silent says why.
    setDiagnostic(runHapticDiagnostic());
    window.setTimeout(() => hapticSuccess(), 500);
  };

  return (
    <div className="rounded-2xl bg-card shadow-neumorph p-6 border border-border/60">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
          <VibrateIcon className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Haptic Feedback
          </h2>
          <p className="text-sm text-muted-foreground">
            Small vibrations on taps, sends and completions
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-52">
          <p className="text-sm font-medium text-foreground">
            {enabled ? "On" : "Off"} by default — saved on this device only
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {support === "vibration"
              ? "This device supports vibration, so you will feel these."
              : support === "ios"
                ? "This iPhone or iPad uses the iOS system haptics (needs iOS 17.4 or later)."
                : support === "none"
                  ? "This device has no vibration hardware, so haptics stay silent here — they work on your phone."
                  : "Works on Android (Vibration API) and iOS 17.4+ (system haptics); desktops without vibration hardware stay silent."}
          </p>
          {diagnostic ? (
            <p className="text-xs mt-1.5 leading-relaxed" aria-live="polite">
              {diagnostic.support === "vibration" ? (
                diagnostic.accepted ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Last test: the browser accepted the vibration. If you
                    felt nothing, the phone&apos;s vibration is off in
                    system Sound settings.
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    Last test: the browser rejected the vibration call —
                    it only accepts them right after a tap, in a visible
                    tab.
                  </span>
                )
              ) : diagnostic.support === "ios" ? (
                <span className="text-muted-foreground">
                  Last test: fired the iOS system haptic.
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  Last test: this device exposes no vibration API.
                </span>
              )}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!enabled}
            onClick={test}
          >
            Test haptics
          </Button>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Haptic feedback"
            onClick={toggle}
            className={cn(
              "relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              enabled ? "bg-primary" : "bg-border",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm",
                enabled && "translate-x-6",
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
