import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  AnswerStatus,
  ChangeKind,
  Confidence,
  DecisionStatus,
  ParticipationRole,
  RecordType,
} from "@/lib/api/types";
import {
  ANSWER_STATUS,
  CHANGE_KIND,
  CONFIDENCE,
  DECISION_STATUS,
  PARTICIPATION_ROLE,
  RECORD_TYPE_LABEL,
} from "@/lib/labels";

/**
 * Categorical badges. Colour is never the only signal — each badge also
 * carries a text label (design-system: "colour is not the only indicator").
 */

export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence: Confidence;
  className?: string;
}) {
  const tone = CONFIDENCE[confidence];
  if (!tone) {
    // Fallback for unknown confidence levels
    return (
      <Badge variant="outline" className={cn("gap-1", "border-border bg-muted text-muted-foreground", className)}>
        {confidence}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("gap-1", tone.className, className)}>
      {tone.label}
    </Badge>
  );
}

export function AnswerStatusBadge({
  status,
  className,
}: {
  status: AnswerStatus;
  className?: string;
}) {
  const tone = ANSWER_STATUS[status];
  if (!tone) {
    // Fallback for unknown statuses
    return (
      <Badge variant="outline" className={cn("gap-1", "border-border bg-muted text-muted-foreground", className)}>
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("gap-1", tone.className, className)}>
      {tone.label}
    </Badge>
  );
}

export function DecisionStatusBadge({
  status,
  className,
}: {
  status: DecisionStatus;
  className?: string;
}) {
  const tone = DECISION_STATUS[status];
  if (!tone) {
    // Fallback for unknown statuses
    return (
      <Badge variant="outline" className={cn("gap-1", "border-border bg-muted text-muted-foreground", className)}>
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("gap-1", tone.className, className)}>
      {tone.label}
    </Badge>
  );
}

export function SourceTypeBadge({
  type,
  className,
}: {
  type: RecordType;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      {RECORD_TYPE_LABEL[type]}
    </Badge>
  );
}

export function ChangeKindBadge({
  kind,
  className,
}: {
  kind: ChangeKind;
  className?: string;
}) {
  const tone = CHANGE_KIND[kind];
  if (!tone) {
    // Fallback for unknown change kinds
    return (
      <Badge variant="outline" className={cn("gap-1", "border-border bg-muted text-muted-foreground", className)}>
        {kind}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("gap-1", tone.className, className)}>
      {tone.label}
    </Badge>
  );
}

export function ParticipationRoleBadge({
  role,
  className,
}: {
  role: ParticipationRole;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      {PARTICIPATION_ROLE[role]}
    </Badge>
  );
}
