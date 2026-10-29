import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Explorer page header in the settings style: a centered dark pill
 * (#171009) carrying the page icon and title in the primary orange,
 * a muted subtitle underneath, and an optional controls row (the
 * repo switcher) below that.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col items-center text-center">
      <div className="inline-flex items-center gap-2.5 rounded-full bg-[#171009] px-6 py-3 shadow-neumorph">
        <Icon className="size-5 text-primary" aria-hidden="true" />
        <h1 className="font-heading text-lg leading-none font-semibold text-primary">
          {title}
        </h1>
      </div>
      <p className="mt-3.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
      {children ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      ) : null}
    </header>
  );
}
