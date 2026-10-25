"use client";

import { AuroraHero } from "@/components/ui/aurora-hero";
import { cn } from "@/lib/utils";

/**
 * The aurora-hero component exactly as installed.
 *
 * The background is the component's own output: its palette, glass layer,
 * filters, mask and 60s animation are untouched. The empty title is the same
 * usage as the registry preview, so no headline is drawn behind the app. The
 * only rule added here stretches the 500/600px native height to the workspace
 * so the animation covers the whole panel instead of stopping partway down.
 */
export function AuroraBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "aurora-exact pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <style>{`
        .aurora-exact .aurora-hero-wrapper {
          height: 100% !important;
          min-height: 0 !important;
        }
      `}</style>
      <AuroraHero title="" />
    </div>
  );
}
