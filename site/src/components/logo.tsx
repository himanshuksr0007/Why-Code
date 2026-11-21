/** Monochrome mark: a "?" inside a bracket pair — code that explains itself. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#ededed" />
      <path d="M10 9 6.5 16 10 23M22 9l3.5 7-3.5 7" stroke="#0a0a0a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M13.6 12.6a2.6 2.6 0 1 1 3.4 2.5c-.6.2-1 .8-1 1.4v.9"
        stroke="#0a0a0a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="21.2" r="1.3" fill="#0a0a0a" />
    </svg>
  );
}
