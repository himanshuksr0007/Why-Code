import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50svh] w-full max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono text-xs tracking-wide text-primary uppercase">
        404
      </p>
      <h1 className="mt-2 font-heading text-xl font-semibold">
        That page does not exist
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The evidence explorer only has three views: ask, decisions, and graph
        paths.
      </p>
      <Button render={<Link href="/" />} nativeButton={false} className="mt-5">
        Back to Ask
      </Button>
    </div>
  );
}
