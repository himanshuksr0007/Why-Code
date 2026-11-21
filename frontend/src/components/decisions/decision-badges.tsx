import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleHelpIcon,
  CircleSlashIcon,
  HistoryIcon,
  PinIcon,
  ShieldCheckIcon,
  ShieldQuestionIcon,
  ShieldIcon,
  type LucideIcon,
} from "lucide-react";

import type { Currency, DecisionSource, Verification } from "@/lib/ledger/types";
import { cn } from "@/lib/utils";

export const CURRENCY_META: Record<
  Currency,
  { label: string; hint: string; icon: LucideIcon; tone: string }
> = {
  active: {
    label: "Active",
    hint: "In force and still describes the code",
    icon: CircleCheckIcon,
    tone: "text-emerald-700 bg-emerald-500/10 border-emerald-600/30 dark:text-emerald-300 dark:border-emerald-400/30",
  },
  needs_review: {
    label: "Needs review",
    hint: "In force, but half or more of its files changed since it was settled",
    icon: CircleAlertIcon,
    tone: "text-amber-700 bg-amber-500/10 border-amber-600/35 dark:text-amber-300 dark:border-amber-400/35",
  },
  stale: {
    label: "Stale",
    hint: "Every file it governs is gone",
    icon: CircleSlashIcon,
    tone: "text-destructive bg-destructive/10 border-destructive/30",
  },
  background: {
    label: "Background",
    hint: "Mined from history, not yet confirmed by a person or agent",
    icon: CircleDashedIcon,
    tone: "text-muted-foreground bg-muted/50 border-border",
  },
  uncheckable: {
    label: "Uncheckable",
    hint: "Names no files, so it cannot be checked against the code",
    icon: CircleHelpIcon,
    tone: "text-muted-foreground bg-muted/50 border-border",
  },
  superseded: {
    label: "Superseded",
    hint: "Replaced by a later decision; kept for history",
    icon: HistoryIcon,
    tone: "text-rose-700 bg-rose-500/10 border-rose-600/30 dark:text-rose-300 dark:border-rose-400/30",
  },
  dismissed: {
    label: "Dismissed",
    hint: "Withdrawn; kept as a tombstone",
    icon: CircleSlashIcon,
    tone: "text-muted-foreground bg-muted/40 border-border line-through",
  },
};

export const SOURCE_LABEL: Record<DecisionSource, string> = {
  adr: "ADR",
  inline_marker: "Code comment",
  commit: "Commit",
  pr_block: "Pull request",
  manual: "Recorded by hand",
  agent: "Coding agent",
};

const VERIFICATION_META: Record<
  Verification,
  { label: string; icon: LucideIcon; tone: string; hint: string }
> = {
  verified: {
    label: "Verified",
    icon: ShieldCheckIcon,
    tone: "text-emerald-700 dark:text-emerald-300",
    hint: "Quote found verbatim at the cited location",
  },
  fuzzy: {
    label: "Fuzzy",
    icon: ShieldIcon,
    tone: "text-amber-700 dark:text-amber-300",
    hint: "Quote found after normalisation, or elsewhere in the file",
  },
  unverified: {
    label: "Unverified",
    icon: ShieldQuestionIcon,
    tone: "text-muted-foreground",
    hint: "Could not be checked against the repository",
  },
};

export function CurrencyBadge({
  currency,
  className,
}: {
  currency: Currency;
  className?: string;
}) {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.uncheckable;
  const Icon = meta.icon;
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
        meta.tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function VerificationMark({
  level,
  showLabel = true,
}: {
  level: Verification;
  showLabel?: boolean;
}) {
  const meta = VERIFICATION_META[level];
  const Icon = meta.icon;
  return (
    <span
      title={meta.hint}
      className={cn("inline-flex items-center gap-1 text-xs font-medium", meta.tone)}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {showLabel ? meta.label : <span className="sr-only">{meta.label}</span>}
    </span>
  );
}

export function PinnedMark() {
  return (
    <span
      title="Pinned: held as law. Changing its files needs an explicit Decision-Ack."
      className="inline-flex h-6 items-center gap-1 rounded-full bg-primary/15 px-2.5 text-xs font-semibold text-primary"
    >
      <PinIcon className="size-3.5" aria-hidden="true" />
      Pinned
    </span>
  );
}
