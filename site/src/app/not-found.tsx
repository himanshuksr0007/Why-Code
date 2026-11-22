import Link from "next/link";

export default function NotFound() {
  return (
    <div className="hero-in mx-auto max-w-xl px-4 py-32 text-center">
      <p className="font-mono text-sm text-ink-faint">
        404 · evidence []<span className="caret ml-1 inline-block h-3.5 w-1.5 translate-y-0.5 bg-ink-faint" aria-hidden="true" />
      </p>
      <h1 className="mt-3 text-3xl font-semibold">No evidence for that page.</h1>
      <p className="mt-3 text-ink-soft">So we won&rsquo;t guess what you meant.</p>
      <Link href="/" className="mt-8 inline-flex h-11 items-center rounded-lg bg-ink px-5 text-sm font-medium text-canvas transition-opacity hover:opacity-85">
        Back home
      </Link>
    </div>
  );
}
