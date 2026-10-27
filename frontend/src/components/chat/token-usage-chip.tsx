/**
 * The token-usage meter shown with the composer: real tokens billed for
 * this visitor against the active model's context window, e.g.
 * "0.3k / 131k  0.21%". Rendered only with real data — callers pass
 * fetched usage or nothing.
 */
export function TokenUsageChip({ used, total }: { used: number; total: number }) {
  if (total <= 0) return null;
  const percentage = ((used / total) * 100).toFixed(2);
  const formattedUsed = (used / 1000).toFixed(1);
  const formattedTotal = (total / 1000).toFixed(0);
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-card shadow-neumorph border border-border/40 px-3 py-1.5 text-xs text-muted-foreground tabular-nums">
      <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="8" cy="8" r="8" opacity="0.3" />
        <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="font-medium">{formattedUsed}k</span>
      <span>/</span>
      <span>{formattedTotal}k</span>
      <span className="ml-1">{percentage}%</span>
    </div>
  );
}
