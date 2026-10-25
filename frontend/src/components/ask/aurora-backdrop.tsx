import { cn } from "@/lib/utils";

/**
 * The hero backdrop: soft satin folds over the warm ground, from the design
 * reference. Pure CSS (the `bg-satin` utility in globals.css) so it follows
 * the light/dark tokens and costs no canvas or animation frames.
 */
export function AuroraBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-satin pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    />
  );
}
