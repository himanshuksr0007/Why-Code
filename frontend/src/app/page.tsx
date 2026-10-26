import { Suspense } from "react";

import { AskWorkspace } from "@/components/ask/ask-workspace";
import { ConversationsPanel } from "@/components/chat/conversations-panel";
import { Skeleton } from "@/components/ui/skeleton";

function AskFallback() {
  return (
    <div
      className="mx-auto w-full max-w-3xl px-4 py-12"
      aria-busy="true"
    >
      <Skeleton className="mx-auto h-3 w-28" />
      <Skeleton className="mx-auto mt-3 h-9 w-80" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl self-center" />
      <Skeleton className="mt-8 h-28 w-full rounded-2xl" />
      <Skeleton className="mx-auto mt-6 h-8 w-64" />
    </div>
  );
}

async function AskContent({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const params = await searchParams;
  const question = typeof params.q === "string" ? params.q : undefined;
  const chat = typeof params.chat === "string" ? params.chat : undefined;

  // Keyed on the URL so opening a conversation from the sidebar re-seeds the
  // workspace; a new `?q=` deep-link remounts with the right initial state.
  return (
    <AskWorkspace
      key={chat ?? question ?? "new"}
      initialChatId={chat}
      initialQuestion={question}
    />
  );
}

export default function AskPage(props: PageProps<"/">) {
  return (
    <>
      <ConversationsPanel />
      <div className="flex-1 flex flex-col">
        <Suspense fallback={<AskFallback />}>
          <AskContent searchParams={props.searchParams} />
        </Suspense>
      </div>
    </>
  );
}
