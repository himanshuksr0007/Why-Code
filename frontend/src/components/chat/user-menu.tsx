"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ChevronsUpDownIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/people/person-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearChats, useChatStore } from "@/lib/chat/store";

/**
 * The account row at the bottom of the sidebar. There is no auth in this demo,
 * so it exposes the local profile, a theme switch and history cleanup.
 */
export function UserMenu({
  displayName,
  handle,
}: {
  displayName: string;
  handle: string;
}) {
  const { chats } = useChatStore();
  const { setTheme } = useTheme();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open profile menu"
        className="flex w-full min-w-0 items-center gap-2 rounded-lg p-1.5 text-left transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <PersonAvatar login={handle || displayName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {displayName}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            @{handle} · local
          </span>
        </span>
        <ChevronsUpDownIcon
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-60"
      >
        <div className="px-1.5 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Local profile
        </div>
        <DropdownMenuItem render={<Link href="/profile" />}>
          <UserRoundIcon aria-hidden="true" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />}>
          <SettingsIcon aria-hidden="true" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const isDark = document.documentElement.classList.contains("dark");
            setTheme(isDark ? "light" : "dark");
          }}
        >
          <SunIcon className="hidden dark:block" aria-hidden="true" />
          <MoonIcon className="block dark:hidden" aria-hidden="true" />
          Toggle theme
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={chats.length === 0}
          onClick={() => {
            clearChats();
            toast.success("Chat history cleared");
            router.push("/");
          }}
        >
          <Trash2Icon aria-hidden="true" />
          Clear chat history
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
