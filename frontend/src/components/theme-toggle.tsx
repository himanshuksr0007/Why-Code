"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      id="theme-toggle-btn"
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle colour theme"
      title="Toggle colour theme"
      className={className}
      onClick={() => {
        const next = resolvedTheme === "dark" ? "light" : "dark";
        setTheme(next);
      }}
    >
      <SunIcon className="hidden dark:block size-4 text-primary" aria-hidden="true" />
      <MoonIcon className="block dark:hidden size-4 text-muted-foreground hover:text-foreground" aria-hidden="true" />
    </Button>
  );
}
