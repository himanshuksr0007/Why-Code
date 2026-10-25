"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { PullRequestSheet } from "@/components/pull-request/pull-request-sheet";

interface PullRequestPanelValue {
  openPullRequest: (number: number) => void;
}

const PullRequestPanelContext = createContext<PullRequestPanelValue | null>(
  null,
);

export function usePullRequestPanel(): PullRequestPanelValue {
  const value = useContext(PullRequestPanelContext);
  if (!value) {
    throw new Error(
      "usePullRequestPanel must be used inside <PullRequestProvider>",
    );
  }
  return value;
}

/**
 * App-wide pull-request panel, mounted once. Any "PR #123" in the UI can open
 * it, so authorship and review participation are always one click away.
 */
export function PullRequestProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [number, setNumber] = useState<number | null>(null);

  const openPullRequest = useCallback((value: number) => setNumber(value), []);

  const value = useMemo<PullRequestPanelValue>(
    () => ({ openPullRequest }),
    [openPullRequest],
  );

  return (
    <PullRequestPanelContext.Provider value={value}>
      {children}
      <PullRequestSheet
        number={number}
        onOpenChange={(open) => {
          if (!open) setNumber(null);
        }}
      />
    </PullRequestPanelContext.Provider>
  );
}
