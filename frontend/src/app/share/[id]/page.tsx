"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";

import { ShareViewer } from "@/components/share/share-viewer";

/**
 * A shared chat is resolved per-viewer (its access rule depends on
 * the viewer's session), so the viewer streams in behind a Suspense
 * boundary — the same pattern the chat page uses for its URL state.
 */
function SharedChatWithParams() {
  const params = useParams<{ id: string }>();
  return <ShareViewer id={params.id} />;
}

export default function SharedChatPage() {
  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-muted-foreground">
          Loading the shared chat…
        </p>
      }
    >
      <SharedChatWithParams />
    </Suspense>
  );
}
