"use client";

import { CircleSlashIcon } from "lucide-react";

import { CitationCard } from "@/components/answer/citation-card";
import { Button } from "@/components/ui/button";
import TextAnimation from "@/components/ui/staggerText";
import type { RefusalInfo } from "@/lib/api/types";

/**
 * The refusal state. A refusal is a real answer, not an error: it says the
 * evidence does not support a claim. Never a dead end — it always offers the
 * nearest candidates and a way forward.
 */
export function RefusalState({
  question,
  refusal,
  suggestions = [],
  onTryExample,
}: {
  question: string;
  refusal: RefusalInfo;
  suggestions?: string[];
  onTryExample?: (question: string) => void;
}) {
  return (
    <section
      aria-labelledby="refusal-heading"
      className="animate-rise rounded-xl border border-destructive/30 bg-destructive/5 p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <CircleSlashIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            id="refusal-heading"
            className="font-heading text-base font-semibold"
          >
            No defensible evidence found
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            <TextAnimation delay={0.05}>{refusal.reason}</TextAnimation>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Question: <span className="text-foreground">{question}</span>
          </p>
        </div>
      </div>

      {suggestions.length > 0 && onTryExample ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">
            Try one of these instead
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <li key={`${suggestion}-${index}`}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTryExample(suggestion)}
                >
                  {suggestion}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {refusal.nearest_candidates.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-medium text-muted-foreground">
            Nearest candidates — related, but not sufficient to answer
          </p>
          <ul className="mt-2 space-y-2">
            {refusal.nearest_candidates.map((candidate, index) => (
              <CitationCard
                key={candidate.evidence_id ? `${candidate.evidence_id}-${index}` : `candidate-${index}`}
                citation={candidate}
                muted
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
