"use client";

import Link from "next/link";

import { PersonAvatar } from "@/components/people/person-avatar";
import { Badge } from "@/components/ui/badge";
import type { PersonSummary } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5">
      <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="font-heading text-sm font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

export function PersonCard({ person }: { person: PersonSummary }) {
  return (
    <Link
      href={`/people/${person.login}`}
      className="group flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex items-center gap-3">
        <PersonAvatar login={person.login} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold">
            {person.name || person.login}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            @{person.login}
          </p>
        </div>
      </div>

      {person.role_tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {person.role_tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <dl className="grid grid-cols-3 gap-2">
        <Stat label="PRs" value={person.authored_pull_requests} />
        <Stat label="Reviews" value={person.reviews} />
        <Stat label="Decisions" value={person.decisions} />
      </dl>

      <p className="text-xs text-muted-foreground">
        Active {formatDate(person.first_seen)} – {formatDate(person.last_seen)}
      </p>
    </Link>
  );
}
