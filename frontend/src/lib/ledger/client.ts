/**
 * Read-only client for the decision ledger. In `mock` mode it serves a
 * small fixture so the page renders offline; in `http` mode a missing
 * ledger is reported as "not indexed", never filled in.
 */

import { API_BASE_URL, API_MODE } from "@/lib/api/config";

import { MOCK_DECISIONS, mockHealth } from "./mock";
import type { LedgerDecision, LedgerHealth } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1/ledger${path}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`ledger ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getHealth(repo: string): Promise<LedgerHealth> {
  if (API_MODE !== "http") return mockHealth(repo);
  return getJson<LedgerHealth>(`/why?repo=${encodeURIComponent(repo)}`);
}

export async function listDecisions(repo: string): Promise<LedgerDecision[]> {
  if (API_MODE !== "http") return MOCK_DECISIONS;
  const data = await getJson<{ decisions: LedgerDecision[] }>(
    `/decisions?repo=${encodeURIComponent(repo)}`,
  );
  return data.decisions;
}

export async function searchDecisions(
  repo: string,
  query: string,
): Promise<LedgerDecision[]> {
  if (API_MODE !== "http") {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return MOCK_DECISIONS.filter((d) =>
      terms.every((t) =>
        `${d.title} ${d.decision} ${d.rationale} ${d.scope.join(" ")}`
          .toLowerCase()
          .includes(t),
      ),
    );
  }
  const data = await getJson<{ decisions: LedgerDecision[] }>(
    `/why?repo=${encodeURIComponent(repo)}&query=${encodeURIComponent(query)}&limit=25`,
  );
  return data.decisions ?? [];
}

export async function getDecision(id: string): Promise<LedgerDecision> {
  if (API_MODE !== "http") {
    const found = MOCK_DECISIONS.find((d) => d.decision_id === id);
    if (!found) throw new Error("decision not found");
    return found;
  }
  return getJson<LedgerDecision>(`/decisions/${encodeURIComponent(id)}`);
}

/** A link to where an evidence row lives on GitHub. */
export function evidenceHref(
  repo: string,
  row: {
    url: string | null;
    commit_sha: string | null;
    pr_number: number | null;
    path: string | null;
    start_line: number | null;
    end_line: number | null;
  },
): string | null {
  if (row.url) return row.url;
  if (!repo.includes("/")) return null;
  const base = `https://github.com/${repo}`;
  if (row.commit_sha) return `${base}/commit/${row.commit_sha}`;
  if (row.pr_number) return `${base}/pull/${row.pr_number}`;
  if (row.path) {
    const lines = row.start_line
      ? `#L${row.start_line}${row.end_line && row.end_line !== row.start_line ? `-L${row.end_line}` : ""}`
      : "";
    return `${base}/blob/HEAD/${row.path}${lines}`;
  }
  return null;
}
