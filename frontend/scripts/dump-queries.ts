import fs from "node:fs";
import path from "node:path";

import { createMockClient } from "@/lib/api/mock-transport";
import type { AskResponse } from "@/lib/api/types";
import { MOCK_REPOS } from "@/lib/mock";

const OUT = process.argv[2] ?? "/tmp/opencode/whycode-package/queries-and-outputs";

type Entry = {
  repo: string;
  question: string;
  kind: "example" | "refusal" | "fallback" | "unindexed";
  response: AskResponse;
};

const client = createMockClient();

function kindFor(repo: string, question: string): Entry["kind"] {
  const bundle = MOCK_REPOS[repo];
  if (!bundle) return "unindexed";
  const normalised = question.toLowerCase();
  if (bundle.refusalKeywords.some((keyword) => normalised.includes(keyword))) {
    return "refusal";
  }
  if (bundle.questions.includes(question)) return "example";
  return "fallback";
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n+/g, " ");
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function responseMarkdown(entry: Entry, index: number): string {
  const { repo, question, kind, response } = entry;
  const lines: string[] = [];
  lines.push(`### ${index}. ${question}`);
  lines.push("");
  lines.push(
    `**Repository:** \`${repo}\` · **Kind:** ${kind} · **Status:** \`${response.status}\` · **Confidence:** \`${response.confidence}\` · **Simulated latency:** ${response.latency_ms ?? "—"} ms`,
  );
  lines.push("");
  lines.push("#### Answer");
  lines.push("");
  lines.push(response.answer.trim());
  lines.push("");

  if (response.refusal) {
    lines.push("#### Refusal");
    lines.push("");
    lines.push(response.refusal.reason.trim());
    lines.push("");
    if (response.refusal.nearest_candidates.length > 0) {
      lines.push("Closest candidates:");
      lines.push("");
      for (const candidate of response.refusal.nearest_candidates) {
        lines.push(
          `- \`${candidate.source_type}\` — ${candidate.title ?? candidate.evidence_id}${candidate.url ? ` ([link](${candidate.url}))` : ""}`,
        );
        lines.push(`  > ${candidate.excerpt.replace(/\n+/g, " ")}`);
      }
      lines.push("");
    }
  }

  if (response.citations.length > 0) {
    lines.push(`#### Evidence (${response.citations.length})`);
    lines.push("");
    response.citations.forEach((citation, i) => {
      const link = citation.url
        ? `[${citation.title ?? citation.evidence_id}](${citation.url})`
        : citation.title ?? citation.evidence_id;
      lines.push(
        `${i + 1}. **${citation.source_type}** — ${link} · ${citation.author ?? "unknown"} · ${formatDate(citation.created_at)}`,
      );
      lines.push(`   > ${citation.excerpt.replace(/\n+/g, " ")}`);
      lines.push("");
    });
  }

  if (response.decisions && response.decisions.length > 0) {
    lines.push(`#### Decisions (${response.decisions.length})`);
    lines.push("");
    for (const decision of response.decisions) {
      lines.push(
        `- \`${decision.decision_id}\` — **${decision.claim}** (${decision.status}, ${decision.confidence})`,
      );
      if (decision.targets.length > 0) {
        lines.push(
          `  - Targets: ${decision.targets
            .map((target) => `\`${target.type}:${target.identifier}\``)
            .join(", ")}`,
        );
      }
      if (decision.pr_number) {
        lines.push(
          `  - Pull request: [#${decision.pr_number}](https://github.com/${repo}/pull/${decision.pr_number})`,
        );
      }
      if (decision.evidence_ids.length > 0) {
        lines.push(
          `  - Evidence: ${decision.evidence_ids
            .map((id) => `\`${id}\``)
            .join(", ")}`,
        );
      }
    }
    lines.push("");
  }

  if (response.changes && response.changes.length > 0) {
    lines.push(`#### Code changes (${response.changes.length})`);
    lines.push("");
    for (const change of response.changes) {
      lines.push(
        `- \`${change.path}\`${change.symbol ? ` (\`${change.symbol}\`)` : ""} — ${change.change_kind}, +${change.additions}/-${change.deletions}`,
      );
      lines.push(
        `  - PR [#${change.pr.number}](${change.pr.url ?? `https://github.com/${repo}/pull/${change.pr.number}`}) by ${change.author?.name ?? change.author?.login ?? "unknown"}`,
      );
      lines.push(`  - Reasoning: ${change.reasoning.replace(/\n+/g, " ")}`);
      if (change.decision) {
        lines.push(`  - Decision: \`${change.decision.decision_id}\` — ${change.decision.claim}`);
      }
    }
    lines.push("");
  }

  if (response.graph_path) {
    lines.push("#### Graph path");
    lines.push("");
    for (const node of response.graph_path.nodes) {
      lines.push(
        `- \`${node.id}\` — **${node.label}**${node.caption ? ` · ${node.caption}` : ""}`,
      );
    }
    if (response.graph_path.edges.length > 0) {
      lines.push("");
      lines.push("Edges:");
      lines.push("");
      for (const edge of response.graph_path.edges) {
        lines.push(
          `- \`${edge.source}\` → \`${edge.target}\` (${edge.rel_type})`,
        );
      }
    }
    lines.push("");
  }

  lines.push(`_Trace: \`${response.retrieval_trace_id}\`_`);
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const entries: Entry[] = [];

  for (const [repo, bundle] of Object.entries(MOCK_REPOS)) {
    for (const question of bundle.questions) {
      const response = await client.ask({
        question,
        repo,
        include_graph_path: true,
        max_evidence_items: 8,
      });
      entries.push({
        repo,
        question,
        kind: kindFor(repo, question),
        response,
      });
    }

    // Starlette's examples do not include a refusal, so add the obvious one
    // that the other repositories demonstrate.
    if (repo === "encode/starlette") {
      const question = "Why is HTTP/3 not supported?";
      const response = await client.ask({
        question,
        repo,
        include_graph_path: true,
        max_evidence_items: 8,
      });
      entries.push({
        repo,
        question,
        kind: kindFor(repo, question),
        response,
      });
    }

    const fallbackQuestion = "What is the meaning of life?";
    const fallback = await client.ask({
      question: fallbackQuestion,
      repo,
      include_graph_path: true,
      max_evidence_items: 8,
    });
    entries.push({
      repo,
      question: fallbackQuestion,
      kind: "fallback",
      response: fallback,
    });
  }

  const unindexedQuestion = "Why are retries disabled by default?";
  const unindexed = await client.ask({
    question: unindexedQuestion,
    repo: "acme/private-service",
    include_graph_path: true,
    max_evidence_items: 8,
  });
  entries.push({
    repo: "acme/private-service",
    question: unindexedQuestion,
    kind: "unindexed",
    response: unindexed,
  });

  fs.mkdirSync(OUT, { recursive: true });

  const generatedAt = new Date().toISOString();
  const json = {
    meta: {
      generated_at: generatedAt,
      transport: "mock",
      note: "Responses from the in-memory demo adapter (src/lib/api/mock-transport.ts) using the fixtures in src/lib/mock/repos/. The fixtures are illustrative until the retrieval service is connected; set NEXT_PUBLIC_API_MODE=http to use the live API.",
      total: entries.length,
    },
    queries: entries.map((entry) => ({
      repo: entry.repo,
      question: entry.question,
      kind: entry.kind,
      response: entry.response,
    })),
  };
  fs.writeFileSync(path.join(OUT, "queries.json"), JSON.stringify(json, null, 2));

  const indexRows = entries
    .map(
      (entry, i) =>
        `| ${i + 1} | \`${entry.repo}\` | ${esc(entry.question)} | ${entry.kind} | ${entry.response.status} | ${entry.response.confidence} | ${entry.response.citations.length} |`,
    )
    .join("\n");

  const byRepo = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = byRepo.get(entry.repo) ?? [];
    list.push(entry);
    byRepo.set(entry.repo, list);
  }

  const sections: string[] = [];
  let n = 0;
  for (const [repo, list] of byRepo) {
    sections.push(`## \`${repo}\``);
    sections.push("");
    for (const entry of list) {
      n += 1;
      sections.push(responseMarkdown(entry, n));
    }
  }

  const md = [
    "# Why-Code demo — real queries and outputs",
    "",
    `Generated **${generatedAt}** from the in-memory mock adapter.`,
    "",
    "These are the exact `AskResponse` objects the frontend renders in demo mode, captured by running every bundled example question plus a fallback, a refusal and an unindexed-repository query. The fixtures are illustrative until the retrieval service is connected; set `NEXT_PUBLIC_API_MODE=http` and `NEXT_PUBLIC_API_BASE_URL` to switch to the live API without changing the UI.",
    "",
    "## Query index",
    "",
    "| # | Repository | Question | Kind | Status | Confidence | Citations |",
    "| -: | --- | --- | --- | --- | --- | -: |",
    indexRows,
    "",
    "## How to reproduce in the UI",
    "",
    "```bash",
    "cd frontend",
    "npm install",
    "npm run dev",
    "```",
    "",
    "Open <http://localhost:3000>, pick the repository in the selector, and click one of the example questions (or paste it into the composer). The same data is returned by the mock transport. A refusal query shows the refusal screen; an unindexed slug shows the not-indexed state.",
    "",
    ...sections,
  ].join("\n");

  fs.writeFileSync(path.join(OUT, "queries.md"), md);

  const txtLines: string[] = [
    "Why-Code demo — copy/paste query list",
    "",
    "Each repository's bundled example questions:",
    "",
  ];
  for (const [repo, bundle] of Object.entries(MOCK_REPOS)) {
    txtLines.push(repo);
    for (const question of bundle.questions) txtLines.push(`- ${question}`);
    txtLines.push("");
  }
  txtLines.push("Extra coverage:");
  txtLines.push("- encode/starlette: Why is HTTP/3 not supported? (refusal)");
  txtLines.push("- any indexed repo: What is the meaning of life? (partial/fallback)");
  txtLines.push("- acme/private-service: Why are retries disabled by default? (not indexed)");
  txtLines.push("");
  fs.writeFileSync(path.join(OUT, "queries.txt"), txtLines.join("\n"));

  const statusCounts = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.response.status] = (acc[entry.response.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        out: OUT,
        total: entries.length,
        byRepo: Object.fromEntries(
          [...byRepo].map(([repo, list]) => [repo, list.length]),
        ),
        statusCounts,
        files: fs.readdirSync(OUT),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
