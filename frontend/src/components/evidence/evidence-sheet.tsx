"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarIcon, CopyIcon, ExternalLinkIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { SourceTypeBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { EvidenceDetail } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

type PanelState = "idle" | "loading" | "ready" | "error";

function PayloadTable({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload);
  if (entries.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/3">Field</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, value]) => (
            <TableRow key={key}>
              <TableCell className="align-top font-mono text-xs text-muted-foreground">
                {key}
              </TableCell>
              <TableCell className="align-top font-mono text-xs break-words">
                {typeof value === "string" ? value : JSON.stringify(value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function EvidenceSheet({
  evidenceId,
  initialDetail,
  onOpenChange,
}: {
  evidenceId: string | null;
  initialDetail?: Partial<EvidenceDetail>;
  onOpenChange: (open: boolean) => void;
}) {
  const [result, setResult] = useState<{
    id: string;
    detail: EvidenceDetail;
  } | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!evidenceId) return;
    let cancelled = false;
    api
      .getEvidence(evidenceId)
      .then((detail) => {
        if (cancelled) return;
        setResult({ id: evidenceId, detail });
        setFailedId(null);
      })
      .catch(() => {
        if (cancelled) return;
        setFailedId(evidenceId);
      });
    return () => {
      cancelled = true;
    };
  }, [evidenceId, attempt]);

  // Derived, falling back to initialDetail when available so synthetic/local evidence loads instantly.
  const fetchedDetail = result && result.id === evidenceId ? result.detail : null;
  const rawDetail =
    fetchedDetail ??
    (initialDetail
      ? {
          evidence_id: evidenceId ?? "evidence",
          source_type: initialDetail.source_type ?? "changed_file",
          record_type: (initialDetail.record_type ?? initialDetail.source_type ?? "changed_file") as EvidenceDetail["record_type"],
          repo: initialDetail.repo ?? "",
          url: initialDetail.url ?? null,
          excerpt: initialDetail.excerpt ?? initialDetail.title ?? evidenceId ?? "",
          title: initialDetail.title ?? null,
          author: initialDetail.author ?? null,
          created_at: initialDetail.created_at ?? null,
          body: initialDetail.body ?? initialDetail.excerpt ?? null,
          payload: initialDetail.payload,
        }
      : null);

  const detail: EvidenceDetail | null = rawDetail
    ? {
        ...rawDetail,
        record_type: (rawDetail.record_type ?? rawDetail.source_type ?? "changed_file") as EvidenceDetail["record_type"],
        source_type: rawDetail.source_type ?? rawDetail.record_type ?? "changed_file",
      }
    : null;

  const state: PanelState = !evidenceId
    ? "idle"
    : detail
      ? "ready"
      : failedId === evidenceId
        ? "error"
        : "loading";

  const copyId = async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.evidence_id);
      toast.success("Evidence ID copied");
    } catch {
      toast.error("Could not copy the evidence ID");
    }
  };

  const open = evidenceId !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="gap-1">
          <SheetTitle>{detail?.title ?? "Evidence"}</SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {evidenceId}
          </SheetDescription>
        </SheetHeader>
        <Separator />

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {state === "loading" ? <DetailSkeleton /> : null}

          {state === "error" ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">
                Could not load this evidence
              </p>
              <p className="mt-1 text-muted-foreground">
                The evidence ID may not exist in the graph, or the service is
                unreachable.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setFailedId(null);
                  setAttempt((value) => value + 1);
                }}
              >
                Try again
              </Button>
            </div>
          ) : null}

          {state === "ready" && detail ? (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <SourceTypeBadge type={detail.source_type} />
                {detail.author ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <UserIcon className="size-3.5" aria-hidden="true" />
                    {/^[a-z0-9-]+$/.test(detail.author) ? (
                      <Link
                        href={`/people/${detail.author}`}
                        className="transition-colors hover:text-foreground hover:underline"
                      >
                        {detail.author}
                      </Link>
                    ) : (
                      detail.author
                    )}
                  </span>
                ) : null}
                {detail.created_at ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <CalendarIcon className="size-3.5" aria-hidden="true" />
                    {formatDate(detail.created_at)}
                  </span>
                ) : null}
                {detail.pr_number ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    PR #{detail.pr_number}
                  </span>
                ) : null}
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm leading-relaxed">
                {detail.body ?? detail.excerpt}
              </div>

              {detail.payload ? <PayloadTable payload={detail.payload} /> : null}

              {detail.url ? (
                <Button
                  render={
                    <a href={detail.url} target="_blank" rel="noreferrer" />
                  }
                  nativeButton={false}
                  variant="outline"
                  className="w-full"
                >
                  <ExternalLinkIcon aria-hidden="true" />
                  Open source on GitHub
                </Button>
              ) : null}
            </>
          ) : null}
        </div>

        <Separator />
        <SheetFooter className="flex-row items-center justify-between">
          <p className="text-xs text-muted-foreground capitalize">
            {detail
              ? String(detail.record_type ?? detail.source_type ?? "evidence").replace(/_/g, " ")
              : "—"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyId}
            disabled={state !== "ready"}
          >
            <CopyIcon aria-hidden="true" />
            Copy ID
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
