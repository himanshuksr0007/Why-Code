"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import {
  UserIcon,
  BellIcon,
  ShieldIcon,
  PaletteIcon,
  KeyIcon,
  DatabaseIcon,
  DownloadIcon,
  TrashIcon,
  SaveIcon,
  CpuIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  CheckIcon,
  LockIcon,
  XIcon,
  SettingsIcon
} from "lucide-react";
import { useLocalProfile } from "@/lib/local/profile";
import { useMounted } from "@/hooks/use-mounted";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TabType = "profile" | "system" | "security" | "appearance";

export default function SettingsPage() {
  const { profile, update } = useLocalProfile();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [handle, setHandle] = useState(profile.handle || "");
  const [defaultRepo, setDefaultRepo] = useState(profile.default_repo || "");
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    mentions: true,
    updates: false
  });
  const [language, setLanguage] = useState("en");
  const [autoSave, setAutoSave] = useState(true);

  const handleSaveProfile = () => {
    update({
      display_name: displayName,
      handle: handle,
      default_repo: defaultRepo
    });
    toast.success("Profile updated successfully");
  };

  const handleExportData = () => {
    const data = {
      profile,
      notifications,
      settings: { theme, language, autoSave },
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whycode-data-${Date.now()}.json`;
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
    { id: "profile" as TabType, label: "Profile", icon: UserIcon },
    { id: "system" as TabType, label: "System", icon: CpuIcon },
    { id: "security" as TabType, label: "Security", icon: ShieldIcon },
    { id: "appearance" as TabType, label: "Appearance", icon: PaletteIcon }
  ];

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
                  Settings
                </h1>
                <span className="hidden sm:inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono font-medium text-primary uppercase tracking-wider shadow-sm">
                  Preferences
                </span>
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Manage your account, preferences, and system settings
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 rounded-full border border-border/80 bg-card/60 dark:border-white/10 dark:bg-white/5 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur-md shadow-sm">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Session</span>
          </div>
        </div>
      </div>

      {/* Desktop Vertical Navigation Stack in the right empty area */}
      <nav
        aria-label="Settings navigation"
        className="hidden xl:flex fixed top-28 right-6 xl:right-10 2xl:right-16 z-30 flex-col gap-2.5 w-44 xl:w-48"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "group flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-all duration-200 text-left w-full shadow-neumorph",
                isActive
                  ? "bg-primary text-white shadow-floating font-semibold scale-[1.02]"
                  : "bg-card/90 text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-floating hover:translate-x-[-2px]"
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1">
        <div>
          {/* Mobile / Tablet Tabs (Hidden on Desktop) */}
          <div className="flex xl:hidden gap-2 mb-6 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap shadow-sm",
                  activeTab === tab.id
                    ? "bg-primary text-white shadow-floating"
                    : "bg-card/90 text-muted-foreground hover:bg-card hover:text-foreground"
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Profile Section */}
              <div className="rounded-2xl bg-card shadow-neumorph p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <UserIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>
                    <p className="text-sm text-muted-foreground">Update your profile details</p>
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
                      className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@username"
                      className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Default Repository
                    </label>
                    <input
                      type="text"
                      value={defaultRepo}
                      onChange={(e) => setDefaultRepo(e.target.value)}
                      placeholder="owner/repo"
                      className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleSaveProfile}
                      className="bg-primary-gradient text-white font-medium shadow-floating hover-lift transition-all duration-200 hover:shadow-floating-lg"
                    >
                      <SaveIcon className="size-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDisplayName(profile.display_name || "");
                        setHandle(profile.handle || "");
                        setDefaultRepo(profile.default_repo || "");
                        toast.info("Changes discarded");
                      }}
                    >
                      <XIcon className="size-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div className="rounded-2xl bg-card shadow-neumorph p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <BellIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
                    <p className="text-sm text-muted-foreground">Manage your notification preferences</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { key: "email", label: "Email Notifications", description: "Receive updates via email" },
                    { key: "push", label: "Push Notifications", description: "Browser push notifications" },
                    { key: "mentions", label: "Mentions & Replies", description: "Get notified when mentioned" },
                    { key: "updates", label: "Product Updates", description: "News about features and updates" }
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                      <button
                        onClick={() => {
                          setNotifications({ ...notifications, [item.key]: !notifications[item.key as keyof typeof notifications] });
                          toast.success(`${item.label} ${!notifications[item.key as keyof typeof notifications] ? "enabled" : "disabled"}`);
                        }}
                        className={cn(
                          "relative w-12 h-6 rounded-full transition-colors duration-200",
                          notifications[item.key as keyof typeof notifications] ? "bg-primary" : "bg-border"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm",
                            notifications[item.key as keyof typeof notifications] && "translate-x-6"
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === "system" && (
            <div className="space-y-6">
              {/* Performance */}
              <div className="rounded-2xl bg-card shadow-neumorph p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <MonitorIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Performance</h2>
                    <p className="text-sm text-muted-foreground">Optimize system performance</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-border/40">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Auto-save</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Automatically save your work</p>
                    </div>
                    <button
                      onClick={() => {
                        setAutoSave(!autoSave);
                        toast.success(`Auto-save ${!autoSave ? "enabled" : "disabled"}`);
                      }}
                      className={cn(
                        "relative w-12 h-6 rounded-full transition-colors duration-200",
                        autoSave ? "bg-primary" : "bg-border"
                      )}
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
                        <p className="text-xs text-muted-foreground mt-0.5">Choose your preferred language</p>
                      </div>
                      <select
                        value={language}
                        onChange={(e) => {
                          setLanguage(e.target.value);
                          toast.success("Language updated");
                        }}
                        className="px-3 py-2 rounded-lg border border-border/60 bg-background/50 text-foreground text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
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

              {/* Data Management */}
              <div className="rounded-2xl bg-card shadow-neumorph p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <DatabaseIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Data Management</h2>
                    <p className="text-sm text-muted-foreground">Manage your data and storage</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-accent/40 hover:bg-accent/60 text-foreground transition-all duration-200"
                  >
                    <DownloadIcon className="size-5 text-primary" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">Export Data</p>
                      <p className="text-xs text-muted-foreground">Download all your data as JSON</p>
                    </div>
                  </button>

                  <button
                    onClick={handleClearCache}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-accent/40 hover:bg-accent/60 text-foreground transition-all duration-200"
                  >
                    <TrashIcon className="size-5 text-destructive" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">Clear Cache</p>
                      <p className="text-xs text-muted-foreground">Remove all cached data and reload</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-card shadow-neumorph p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <LockIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Security Settings</h2>
                    <p className="text-sm text-muted-foreground">Protect your account</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => toast.info("Password change feature coming soon")}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-accent/40 hover:bg-accent/60 text-foreground transition-all duration-200"
                  >
                    <KeyIcon className="size-5 text-primary" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">Change Password</p>
                      <p className="text-xs text-muted-foreground">Update your password</p>
                    </div>
                  </button>

                  <button
                    onClick={() => toast.info("Two-factor authentication feature coming soon")}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-accent/40 hover:bg-accent/60 text-foreground transition-all duration-200"
                  >
                    <ShieldIcon className="size-5 text-primary" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">Two-Factor Authentication</p>
                      <p className="text-xs text-muted-foreground">Add an extra security layer</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-card shadow-neumorph p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <PaletteIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Theme &amp; Appearance</h2>
                    <p className="text-sm text-muted-foreground">Select your interface appearance across WhyCode</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      value: "light",
                      label: "Light Mode",
                      icon: SunIcon,
                      description: "Warm cream & caramel neumorphic theme",
                    },
                    {
                      value: "dark",
                      label: "Dark Mode",
                      icon: MoonIcon,
                      description: "Deep warm obsidian & glowing amber theme",
                    },
                    {
                      value: "system",
                      label: "System",
                      icon: MonitorIcon,
                      description: "Syncs automatically with your device settings",
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
                          toast.success(`Theme set to ${option.label}`);
                        }}
                        className={cn(
                          "relative flex flex-col items-start p-4 rounded-2xl text-left border transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          active
                            ? "border-primary bg-primary/10 text-foreground shadow-floating ring-1 ring-primary/40"
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

                <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Current effective theme: <strong className="text-foreground capitalize">{mounted ? (resolvedTheme ?? theme) : "..."}</strong></span>
                  <span>Persisted in browser storage</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
