import { cn } from "@/lib/utils";

/**
 * The WhyCode mark (interlocked triangles and nodes), recolored with
 * the site's primary gradient — the same caramel-orange as the
 * "New chat" button — so it stays visible on both themes. Two
 * static assets (`public/whycode-logo*.png`) carry each theme's
 * gradient stops; the shape itself is the owner's artwork with its
 * background knocked out.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/whycode-logo-light.png"
        alt="WhyCode"
        className={cn("size-8 shrink-0 dark:hidden", className)}
      />
      <img
        src="/whycode-logo.png"
        alt=""
        aria-hidden="true"
        className={cn("hidden size-8 shrink-0 dark:block", className)}
      />
    </>
  );
}
