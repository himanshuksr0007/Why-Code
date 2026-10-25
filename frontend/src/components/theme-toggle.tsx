"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Both icons are always rendered; the `dark:` variant decides which is
 * visible, so no effect or mounted flag is needed and there is no hydration
 * mismatch. The click handler reads the live class list, so the label does not
 * depend on a possibly-undefined resolved theme.
 */
export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle colour theme"
      title="Toggle colour theme"
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark");
        setTheme(isDark ? "light" : "dark");
      }}
    >
      <SunIcon className="hidden dark:block" aria-hidden="true" />
      <MoonIcon className="block dark:hidden" aria-hidden="true" />
    </Button>
  );
}
