import { FileCode2Icon, QuoteIcon } from "lucide-react";

import type { LedgerDecision } from "@/lib/ledger/types";
import { cn } from "@/lib/utils";

import {
  CurrencyBadge,
  PinnedMark,
  SOURCE_LABEL,
  VerificationMark,
} from "./decision-badges";

/** One decision in the list. The whole card opens the detail drawer. */
export function DecisionCard({
  decision,
  onOpen,
}: {
  decision: LedgerDecision;
  onOpen: (id: string) => void;
}) {
  const quote = decision.evidence[0]?.quote;
  const why = decision.rationale || decision.context;
  return (
    <button
      type="button"
      onClick={() => onOpen(decision.decision_id)}
      className={cn(
        "group w-full cursor-pointer rounded-2xl border border-border/70 bg-card p-4 text-left shadow-neumorph transition-[transform,border-color] duration-200 sm:p-5",
        "hover:-translate-y-0.5 hover:border-primary/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        !decision.in_force && "bg-card/70",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <CurrencyBadge currency={decision.currency} />
        {decision.pinned ? <PinnedMark /> : null}
        <span className="text-xs text-muted-foreground">
          {SOURCE_LABEL[decision.source] ?? decision.source}
        </span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {decision.decision_id}
        </span>
      </div>

      <h3 className="mt-3 text-[15px] leading-snug font-semibold text-foreground group-hover:text-primary">
        {decision.title}
      </h3>
      {why ? (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {why}
        </p>
      ) : null}

      {quote ? (
        <blockquote className="mt-3 flex gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[13px] leading-relaxed text-foreground/90">
          <QuoteIcon
            className="mt-0.5 size-3.5 shrink-0 text-primary/70"
            aria-hidden="true"
          />
          <span className="line-clamp-2">{quote}</span>
        </blockquote>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {decision.scope.slice(0, 3).map((path) => (
          <span
            key={path}
            className="inline-flex max-w-full items-center gap-1 truncate font-mono text-[11.5px] text-muted-foreground"
          >
            <FileCode2Icon className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{path}</span>
          </span>
        ))}
        {decision.scope.length > 3 ? (
          <span className="text-[11.5px] text-muted-foreground">
            +{decision.scope.length - 3} more
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <VerificationMark level={decision.verification.level} showLabel={false} />
          {decision.verification.verified}/{decision.verification.total} evidence verified
        </span>
      </div>
    </button>
  );
}
