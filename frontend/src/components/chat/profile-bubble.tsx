"use client";

import { useRouter } from "next/navigation";
import {
  ChevronsUpDownIcon,
  CompassIcon,
  LogInIcon,
  LogOutIcon,
  SettingsIcon,
  UserPlusIcon,
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
import { authApi } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/store";
import { hapticSelection } from "@/lib/haptics";
import { useIdentity } from "@/lib/identity";
import { openTour } from "@/lib/onboarding/tour";
import { cn } from "@/lib/utils";

/**
 * The sidebar's profile bubble: the identity at a glance, with a menu
 * that opens upward. The theme toggle sits at the bubble's right edge,
 * outside the menu.
 *
 * With a real account session the bubble shows the account (name,
 * @handle from the email) and Log out ends the session. Guests see
 * their local profile and get Log in / Sign up entries instead —
 * conversations are device-local history and are kept either way.
 */
export function ProfileBubble({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const identity = useIdentity();
  const { user } = useAuth();
  const router = useRouter();

  const displayName = identity.name;
  const handle = identity.handle;

  const goSettings = () => {
    onNavigate?.();
    router.push("/settings");
  };

  const replayTour = () => {
    hapticSelection();
    onNavigate?.();
    openTour();
  };

  const goAuth = (path: "/login" | "/signup") => {
    hapticSelection();
    onNavigate?.();
    router.push(path);
  };

  const logOut = async () => {
    await authApi.logout();
    onNavigate?.();
    toast.success("Logged out — you are browsing as a guest now");
    router.push("/");
    router.refresh();
  };

  const menu = (
    <DropdownMenuContent
      side={compact ? "right" : "top"}
      align="start"
      sideOffset={8}
      className="w-56"
    >
      {user ? (
        <>
          <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">
            {user.email}
          </div>
          <DropdownMenuSeparator />
        </>
      ) : null}
      <DropdownMenuItem onClick={replayTour}>
        <CompassIcon className="size-4" />
        Product tour
      </DropdownMenuItem>
      <DropdownMenuItem onClick={goSettings}>
        <SettingsIcon className="size-4" />
        Settings
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {user ? (
        <DropdownMenuItem variant="destructive" onClick={() => void logOut()}>
          <LogOutIcon className="size-4" />
          Log out
        </DropdownMenuItem>
      ) : (
        <>
          <DropdownMenuItem onClick={() => goAuth("/login")}>
            <LogInIcon className="size-4" />
            Log in
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => goAuth("/signup")}>
            <UserPlusIcon className="size-4" />
            Sign up
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  );

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={`Account menu for ${displayName}`}
          title={displayName}
        >
          <PersonAvatar login={handle || displayName} />
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
            aria-label={`Account menu for ${displayName}`}
          >
            <PersonAvatar login={handle || displayName} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {displayName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                @{handle}
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
