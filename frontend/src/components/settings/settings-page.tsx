"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  UserIcon,
  BellIcon,
  KeyIcon,
  DatabaseIcon,
  PaletteIcon,
  CodeIcon,
  ShieldIcon,
  ZapIcon,
} from "lucide-react";

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const sections: SettingsSection[] = [
  { id: "profile", label: "Profile", icon: <UserIcon className="size-4" /> },
  { id: "appearance", label: "Appearance", icon: <PaletteIcon className="size-4" /> },
  { id: "notifications", label: "Notifications", icon: <BellIcon className="size-4" /> },
  { id: "api", label: "API Keys", icon: <KeyIcon className="size-4" /> },
  { id: "models", label: "Models", icon: <ZapIcon className="size-4" /> },
  { id: "code", label: "Code Preferences", icon: <CodeIcon className="size-4" /> },
  { id: "data", label: "Data & Storage", icon: <DatabaseIcon className="size-4" /> },
  { id: "security", label: "Security", icon: <ShieldIcon className="size-4" /> },
];

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile");

  return (
    <div className="flex flex-1 min-h-screen">
      {/* Settings Sidebar */}
      <aside className="w-64 border-r border-border/30 bg-card/50 p-4">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Settings</h2>
            <p className="text-xs text-muted-foreground">
              Manage your account and preferences
            </p>
          </div>

          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                  activeSection === section.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Settings Content */}
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-3xl space-y-8">
          {activeSection === "profile" && <ProfileSettings />}
          {activeSection === "appearance" && <AppearanceSettings />}
          {activeSection === "notifications" && <NotificationSettings />}
          {activeSection === "api" && <APISettings />}
          {activeSection === "models" && <ModelSettings />}
          {activeSection === "code" && <CodeSettings />}
          {activeSection === "data" && <DataSettings />}
          {activeSection === "security" && <SecuritySettings />}
        </div>
      </main>
    </div>
  );
}

function ProfileSettings() {
  return (
    <div className="space-y-6 animate-rise">
      <div>
        <h3 className="text-xl font-semibold text-foreground">Profile</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal information
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-neumorph p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Display Name
          </label>
          <input
            type="text"
            placeholder="Your name"
            className="w-full px-4 py-2.5 rounded-lg border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full px-4 py-2.5 rounded-lg border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Bio
          </label>
          <textarea
            rows={3}
            placeholder="Tell us about yourself"
            className="w-full px-4 py-2.5 rounded-lg border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline">Cancel</Button>
          <Button className="bg-primary-gradient">Save Changes</Button>
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  return (
    <div className="space-y-6 animate-rise">
      <div>
        <h3 className="text-xl font-semibold text-foreground">Appearance</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Customize how the app looks and feels
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-neumorph p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Theme
          </label>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">
              Toggle between light and dark mode
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Font Size
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="12"
              max="18"
              defaultValue="14"
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground w-16">14px</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Animation Speed
          </label>
          <select className="w-full px-4 py-2.5 rounded-lg border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option>Normal</option>
            <option>Fast</option>
            <option>Slow</option>
            <option>No animations</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline">Reset to Default</Button>
          <Button className="bg-primary-gradient">Save Changes</Button>
        </div>
      </div>
    </div>
  );
}

function NotificationSettings() {
  return (
    <div className="space-y-6 animate-rise">
      <div>
        <h3 className="text-xl font-semibold text-foreground">Notifications</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose what notifications you receive
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-neumorph p-6 space-y-4">
        {["Email notifications", "Push notifications", "Chat mentions", "System updates"].map((item) => (
          <label key={item} className="flex items-center justify-between py-2">
            <span className="text-sm text-foreground">{item}</span>
            <input type="checkbox" className="rounded" defaultChecked />
          </label>
        ))}
      </div>
    </div>
  );
}

function APISettings() {
  return (
    <div className="space-y-6 animate-rise">
      <div>
        <h3 className="text-xl font-semibold text-foreground">API Keys</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your API keys and integrations
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-neumorph p-6">
        <p className="text-sm text-muted-foreground">
          API key management interface will be implemented here
        </p>
      </div>
    </div>
  );
}

function ModelSettings() {
  return (
    <div className="space-y-6 animate-rise">
      <div>
        <h3 className="text-xl font-semibold text-foreground">Models</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure AI models and parameters
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-neumorph p-6">
        <p className="text-sm text-muted-foreground">
          Model configuration interface will be implemented here
        </p>
      </div>
    </div>
  );
}

function CodeSettings() {
  return (
    <div className="space-y-6 animate-rise">
      <div>
        <h3 className="text-xl font-semibold text-foreground">Code Preferences</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Customize code display and behavior
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-neumorph p-6">
        <p className="text-sm text-muted-foreground">
          Code preferences interface will be implemented here
        </p>
      </div>
    </div>
  );
}

function DataSettings() {
  return (
    <div className="space-y-6 animate-rise">
      <div>
        <h3 className="text-xl font-semibold text-foreground">Data & Storage</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your data and storage preferences
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-neumorph p-6">
        <p className="text-sm text-muted-foreground">
          Data management interface will be implemented here
        </p>
      </div>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-6 animate-rise">
      <div>
        <h3 className="text-xl font-semibold text-foreground">Security</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage security and privacy settings
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-neumorph p-6">
        <p className="text-sm text-muted-foreground">
          Security settings interface will be implemented here
        </p>
      </div>
    </div>
  );
}
