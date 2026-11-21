import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-32 text-center">
      <p className="font-mono text-sm text-ink-faint">404</p>
      <h1 className="mt-3 text-3xl font-semibold">No evidence for that page.</h1>
      <p className="mt-3 text-ink-soft">So we won&rsquo;t guess what you meant.</p>
      <Link href="/" className="mt-8 inline-flex h-11 items-center rounded-lg bg-ink px-5 text-sm font-medium text-canvas">
        Back home
      </Link>
    </div>
  );
}
