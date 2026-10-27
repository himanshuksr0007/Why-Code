"use client";

import { useRouter } from "next/navigation";
import {
  ChevronsUpDownIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/people/person-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reset as resetProfile, useLocalProfile } from "@/lib/local/profile";
import { cn } from "@/lib/utils";

/**
 * The sidebar's profile bubble: the signed-in identity at a glance, with a
 * menu that opens upward (Settings, then Log out in destructive red). The
 * theme toggle sits at the bubble's right edge, outside the menu.
 *
 * There is no account backend in this app — identity is the local profile —
 * so logging out resets that profile to the guest defaults and goes home.
 * Conversations are device-local history and are kept.
 */
export function ProfileBubble({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const { profile } = useLocalProfile();
  const router = useRouter();

  const goSettings = () => {
    onNavigate?.();
    router.push("/settings");
  };

  const logOut = () => {
    resetProfile();
    onNavigate?.();
    toast.success("Logged out — you are browsing as a guest now");
    router.push("/");
  };

  const menu = (
    <DropdownMenuContent
      side={compact ? "right" : "top"}
      align="start"
      sideOffset={8}
      className="w-56"
    >
      <DropdownMenuItem onClick={goSettings}>
        <SettingsIcon className="size-4" />
        Settings
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={logOut}>
        <LogOutIcon className="size-4" />
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={`Account menu for ${profile.display_name}`}
          title={profile.display_name}
        >
          <PersonAvatar login={profile.handle || profile.display_name} />
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    );
  }

  return (
    <div className="animate-scale rounded-2xl bg-card p-2 shadow-neumorph">
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left outline-none transition-colors",
              "hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
            aria-label={`Account menu for ${profile.display_name}`}
          >
            <PersonAvatar login={profile.handle || profile.display_name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {profile.display_name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                @{profile.handle}
              </span>
            </span>
            <ChevronsUpDownIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </DropdownMenuTrigger>
          {menu}
        </DropdownMenu>
        <ThemeToggle />
      </div>
    </div>
  );
}
