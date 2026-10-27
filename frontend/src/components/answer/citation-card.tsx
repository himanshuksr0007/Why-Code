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

  const raw = citation as unknown as Record<string, unknown> | string;
  const isStr = typeof raw === "string";
  const obj = !isStr && raw ? (raw as Record<string, unknown>) : {};

  const evidenceId = String(
    isStr ? raw : obj.evidence_id || obj.alias || obj.title || `evidence-${(index ?? 0) + 1}`,
  );
  const title = (obj.title ? String(obj.title) : null) || (isStr ? raw : null) || (obj.path ? String(obj.path) : null) || evidenceId;
  const excerpt = String(obj.excerpt || (isStr ? raw : "") || title || "");
  const sourceType = (obj.source_type || obj.kind || "changed_file") as Citation["source_type"];
  const url = obj.url ? String(obj.url) : null;
  const author = obj.author ? String(obj.author) : null;
  const createdAt = obj.created_at ? String(obj.created_at) : null;

  const formattedDate = createdAt ? formatDate(createdAt) : null;
  const meta = [author, formattedDate !== "—" ? formattedDate : null]
    .filter(Boolean)
    .join(" · ");

  const normalizedCitation: Citation = {
    evidence_id: evidenceId,
    source_type: sourceType,
    url,
    excerpt,
    title,
    author,
    created_at: createdAt,
  };

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
        <SourceTypeBadge type={sourceType} />
        {meta ? (
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        ) : null}
        {url ? (
          <Button
            render={
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${title} on GitHub`}
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
        onClick={() => openEvidence(evidenceId, normalizedCitation)}
        className="mt-2 block w-full cursor-pointer rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-sm font-medium">{title}</p>
        {excerpt && excerpt !== title ? (
          <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">
            {excerpt}
          </p>
        ) : null}
        <span className="mt-2 block font-mono text-[11px] text-muted-foreground">
          {evidenceId}
        </span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
          View evidence
          <ArrowRightIcon className="size-3" aria-hidden="true" />
        </span>
      </button>
    </li>
  );
}
