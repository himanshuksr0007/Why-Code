import Link from "next/link";

import { PersonAvatar, type AvatarSize } from "@/components/people/person-avatar";
import type { PersonRef } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const BASE =
  "inline-flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-muted/30 py-0.5 pr-2.5 pl-0.5 text-xs";

/**
 * A compact person reference. Links to the profile so any mention of a person
 * in the app is one click from their work.
 */
export function PersonChip({
  person,
  size = "sm",
  linked = true,
  className,
}: {
  person: PersonRef;
  size?: AvatarSize;
  linked?: boolean;
  className?: string;
}) {
  const content = (
    <>
      <PersonAvatar login={person.login} size={size} />
      <span className="truncate">{person.name || person.login}</span>
    </>
  );

  if (!linked) {
    return <span className={cn(BASE, className)}>{content}</span>;
  }

  return (
    <Link
      href={`/people/${person.login}`}
      title={`@${person.login}`}
      className={cn(
        BASE,
        "transition-colors hover:border-primary/40 hover:bg-primary/10",
        className,
      )}
    >
      {content}
    </Link>
  );
}

/**
 * Overlapping avatars for a group (reviewers, participants). The extra people
 * beyond `max` are summarised as "+N" and announced to screen readers.
 */
export function PersonAvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: PersonRef[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <span className={cn("inline-flex items-center", className)}>
      <span className="flex -space-x-2">
        {shown.map((person) => (
          <span
            key={person.login}
            title={`@${person.login}`}
            className="rounded-full ring-2 ring-card"
          >
            <PersonAvatar login={person.login} size={size} />
          </span>
        ))}
        {overflow > 0 ? (
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-full bg-muted font-mono text-muted-foreground ring-2 ring-card",
              size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs",
            )}
          >
            +{overflow}
          </span>
        ) : null}
      </span>
      <span className="sr-only">
        {people.length} people: {people.map((person) => `@${person.login}`).join(", ")}
      </span>
    </span>
  );
}
