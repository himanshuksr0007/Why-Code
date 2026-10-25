"use client";

import { ArrowRightIcon, ExternalLinkIcon } from "lucide-react";

import { SourceTypeBadge } from "@/components/badges";
import { useEvidencePanel } from "@/components/evidence/evidence-provider";
import { Button } from "@/components/ui/button";
import type { Citation } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One citation. The body is a button that opens the evidence panel; the GitHub
 * link is a sibling anchor, never nested inside the button, so both remain
 * keyboard-reachable and valid HTML.
 */
export function CitationCard({
  citation,
  index,
  muted = false,
  className,
}: {
  citation: Citation;
  index?: number;
  muted?: boolean;
  className?: string;
}) {
  const { openEvidence } = useEvidencePanel();

  const meta = [citation.author, formatDate(citation.created_at)]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className={cn(
        "rounded-xl border border-border/70 bg-card p-3 transition-colors hover:border-border",
        muted && "opacity-80",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {typeof index === "number" ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[11px] text-muted-foreground">
            {index + 1}
          </span>
        ) : null}
        <SourceTypeBadge type={citation.source_type} />
        {meta ? (
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        ) : null}
        {citation.url ? (
          <Button
            render={
              <a
                href={citation.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${citation.title ?? citation.evidence_id} on GitHub`}
              />
            }
            nativeButton={false}
            variant="ghost"
            size="icon-xs"
            className="ml-auto"
          >
            <ExternalLinkIcon aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => openEvidence(citation.evidence_id)}
        className="mt-2 block w-full cursor-pointer rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {citation.title ? (
          <p className="text-sm font-medium">{citation.title}</p>
        ) : null}
        <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">
          {citation.excerpt}
        </p>
        <span className="mt-2 block font-mono text-[11px] text-muted-foreground">
          {citation.evidence_id}
        </span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
          View evidence
          <ArrowRightIcon className="size-3" aria-hidden="true" />
        </span>
      </button>
    </li>
  );
}
