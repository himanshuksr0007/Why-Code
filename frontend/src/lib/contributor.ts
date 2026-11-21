"use client";

import { coerceCitations } from "@/lib/api/normalize";
import type { AskResponse } from "@/lib/api/types";
import { useChatStore } from "@/lib/chat/store";

/**
 * The person behind the newest PR / commit / issue in the latest
 * answer's own evidence — the rail's contributor card.
 *
 * The data comes only from the answer's citations: an artifact counts
 * when the backend attached its real GitHub author and avatar to the
 * evidence (live PR/issue evidence does). Placeholder authors and
 * avatar-less evidence never produce a card — the UI shows nobody
 * rather than somebody invented.
 */
export interface TurnContributor {
  /** The turn the card belongs to — keys the rail's fade-in. */
  turnId: string;
  kind: "pull_request" | "commit" | "issue";
  login: string;
  avatarUrl: string;
  profileUrl: string;
  /** The artifact's own title (the PR title), when known. */
  title: string | null;
  /** Deep link to the artifact on GitHub. */
  url: string | null;
  /** Short reference label, e.g. `PR #784`. */
  refLabel: string | null;
  createdAt: string | null;
}

const KIND_ORDER = { pull_request: 0, commit: 1, issue: 2 } as const;

function refLabelFor(
  kind: TurnContributor["kind"],
  url: string | null,
  evidenceId: string,
): string | null {
  const fromUrl = url?.match(/\/(?:pull|issues|commit)\/(\d+|[0-9a-f]{7,40})$/);
  const fromId = evidenceId.match(/:(\d+)$/);
  const ref = fromUrl?.[1] ?? fromId?.[1];
  if (!ref) return null;
  if (kind === "pull_request") return `PR #${ref}`;
  if (kind === "issue") return `Issue #${ref}`;
  return `Commit ${ref.slice(0, 7)}`;
}

export function contributorForResponse(
  response: AskResponse | null,
  turnId: string,
): TurnContributor | null {
  if (!response) return null;
  const candidates = coerceCitations(response).filter(
    (citation) =>
      (citation.source_type === "pull_request" ||
        citation.source_type === "commit" ||
        citation.source_type === "issue") &&
      citation.author &&
      citation.author !== "maintainers" &&
      citation.author_avatar_url,
  );
  if (candidates.length === 0) return null;

  // Latest first; on a tie (or missing dates) a PR outranks an issue.
  candidates.sort((a, b) => {
    const byDate = (b.created_at ?? "").localeCompare(a.created_at ?? "");
    if (byDate !== 0) return byDate;
    return (
      KIND_ORDER[a.source_type as TurnContributor["kind"]] -
      KIND_ORDER[b.source_type as TurnContributor["kind"]]
    );
  });

  const top = candidates[0];
  const kind = top.source_type as TurnContributor["kind"];
  const login = String(top.author);
  return {
    turnId,
    kind,
    login,
    avatarUrl: String(top.author_avatar_url),
    profileUrl: `https://github.com/${login}`,
    title: top.title ?? null,
    url: top.url ?? null,
    refLabel: refLabelFor(kind, top.url ?? null, top.evidence_id),
    createdAt: top.created_at ?? null,
  };
}

export function useLatestContributor(): TurnContributor | null {
  const { chats, incognitoChat, activeId } = useChatStore();
  const chat =
    chats.find((candidate) => candidate.id === activeId) ??
    (incognitoChat?.id === activeId ? incognitoChat : null);
  const lastTurn = chat?.turns[chat.turns.length - 1];
  if (!lastTurn) return null;
  return contributorForResponse(lastTurn.response, lastTurn.id);
}
