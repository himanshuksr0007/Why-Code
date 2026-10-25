"use client";

import { PersonCard } from "@/components/people/person-card";
import type { PersonSummary } from "@/lib/api/types";

export function PersonList({ people }: { people: PersonSummary[] }) {
  if (people.length === 0) {
    return (
      <p className="rounded-xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
        No people were found in the graph for this repository.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {people.map((person) => (
        <li key={person.login}>
          <PersonCard person={person} />
        </li>
      ))}
    </ul>
  );
}
