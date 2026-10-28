/**
 * Normalises the graph path returned by the answer service.
 *
 * The plan's response schema allows `graph_path` to be a bare list of node
 * labels (`["ConfigKey", "Symbol", ...]`). The UI renders richer nodes with
 * captions, so both shapes are accepted here and the bare list is expanded
 * into a chain.
 */

import type {
  AuditReport,
  Citation,
  Decision,
  DecisionRecord,
  DecisionTarget,
  EvidenceDetail,
  EvidenceRef,
  GraphNodeLabel,
  GraphPath,
  PlanGraph,
  PlanView,
  RecordsPage,
  RecordsSearchResult,
  RecordType,
  SupersessionPair,
  WebhookEvents,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function coerceGraphPath(value: unknown): GraphPath | null {
  if (!value) return null;

  // Already structured: { nodes: [...], edges: [...] }
  if (isRecord(value) && Array.isArray(value.nodes)) {
    const nodes = value.nodes
      .filter(isRecord)
      .map((node, index) => ({
        id: String(node.id ?? `node-${index}`),
        label: (node.label ?? "Evidence") as GraphNodeLabel,
        caption: typeof node.caption === "string" ? node.caption : undefined,
      }));
    const edges = Array.isArray(value.edges)
      ? value.edges.filter(isRecord).map((edge, index) => ({
          id: String(edge.id ?? `edge-${index}`),
          source: String(edge.source ?? ""),
          target: String(edge.target ?? ""),
          rel_type: String(edge.rel_type ?? edge.type ?? "NEXT"),
        }))
      : [];
    return { nodes, edges };
  }

  // Bare list of labels or target/node strings: expand into a linear chain.
  if (Array.isArray(value)) {
    const rawItems = value.filter(
      (item): item is string => typeof item === "string",
    );
    if (rawItems.length === 0) return null;
    const nodes = rawItems.map((raw, index) => {
      let label: GraphNodeLabel = "Symbol";
      let caption: string | undefined = raw;
      const colonIdx = raw.indexOf(":");
      if (colonIdx > 0) {
        label = raw.slice(0, colonIdx) as GraphNodeLabel;
        caption = raw.slice(colonIdx + 1);
      } else {
        label = raw as GraphNodeLabel;
      }
      return {
        id: `node-${index}`,
        label,
        caption,
      };
    });
    const edges = rawItems.slice(0, -1).map((_, index) => ({
      id: `node-${index}->node-${index + 1}`,
      source: `node-${index}`,
      target: `node-${index + 1}`,
      rel_type: "CONNECTED_TO",
    }));
    return { nodes, edges };
  }

  return null;
}

export function coerceDecisions(value: unknown): Decision[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => {
    const rawTargets = Array.isArray(item.targets) ? item.targets : [];
    const rawTargetIds = Array.isArray(item.target_ids) ? item.target_ids : [];
    const targets: DecisionTarget[] =
      rawTargets.length > 0
        ? rawTargets.filter(isRecord).map((t) => ({
            type: (t.type ?? "Symbol") as GraphNodeLabel,
            identifier: String(t.identifier ?? ""),
          }))
        : rawTargetIds.map((id) => {
            const strId = String(id);
            const colon = strId.indexOf(":");
            if (colon > 0) {
              return {
                type: strId.slice(0, colon) as GraphNodeLabel,
                identifier: strId.slice(colon + 1),
              };
            }
            return {
              type: "Symbol" as GraphNodeLabel,
              identifier: strId,
            };
          });

    return {
      decision_id: String(item.decision_id ?? ""),
      claim: String(item.claim ?? ""),
      status: (item.status ?? "active") as Decision["status"],
      confidence: (item.confidence ?? "medium") as Decision["confidence"],
      targets,
      target_ids: rawTargetIds.map(String),
      evidence_ids: Array.isArray(item.evidence_ids)
        ? item.evidence_ids.map(String)
        : [],
      supersedes: item.supersedes ? String(item.supersedes) : null,
      superseded_by: item.superseded_by ? String(item.superseded_by) : null,
      pr_number: typeof item.pr_number === "number" ? item.pr_number : null,
      created_at: item.created_at ? String(item.created_at) : null,
      title: item.title ? String(item.title) : null,
    };
  });
}

/**
 * The same underlying record can reach an answer through several
 * decisions, so the raw payload may list one piece of evidence several
 * times. The UI shows each distinct item once: first occurrence wins,
 * keyed by evidence id, then by title+excerpt for id-less duplicates.
 */
function dedupeCitations(list: Citation[]): Citation[] {
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();
  const out: Citation[] = [];
  for (const citation of list) {
    const contentKey = `${citation.title ?? ""}|${citation.excerpt}`;
    if (
      seenIds.has(citation.evidence_id) ||
      (citation.excerpt && seenContent.has(contentKey))
    ) {
      continue;
    }
    seenIds.add(citation.evidence_id);
    if (citation.excerpt) seenContent.add(contentKey);
    out.push(citation);
  }
  return out;
}

/** Coerce a { nodes, edges } graph payload (plan graphs and repo
 * structure trees share the shape). Returns an empty graph for
 * anything unusable; callers decide whether empty means absent. */
export function coerceGraph(value: unknown): PlanGraph {
  const rawGraph = isRecord(value) ? value : {};
  const nodes = Array.isArray(rawGraph.nodes)
    ? rawGraph.nodes.filter(isRecord).map((node, index) => ({
        id: String(node.id ?? `node-${index}`),
        label: String(node.label ?? "Node"),
        kind: String(node.kind ?? "module"),
        caption: typeof node.caption === "string" ? node.caption : null,
      }))
    : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(rawGraph.edges)
    ? rawGraph.edges
        .filter(isRecord)
        .map((edge) => ({
          source: String(edge.source ?? ""),
          target: String(edge.target ?? ""),
          rel_type: String(edge.rel_type ?? "connects"),
        }))
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    : [];
  return { nodes, edges };
}

export function coercePlan(value: unknown): PlanView | null {
  if (!isRecord(value)) return null;
  const steps = Array.isArray(value.steps)
    ? value.steps
        .filter(isRecord)
        .map((step) => ({
          title: String(step.title ?? ""),
          detail: String(step.detail ?? ""),
          status: (step.status === "done" || step.status === "in_progress"
            ? step.status
            : "needed") as PlanView["steps"][number]["status"],
          evidence_ids: Array.isArray(step.evidence_ids)
            ? step.evidence_ids.map(String)
            : [],
        }))
        .filter((step) => step.title)
    : [];
  return {
    goal: String(value.goal ?? ""),
    steps,
    graph: coerceGraph(value.graph),
  };
}

export function coerceCitations(payload: unknown): Citation[] {
  if (!isRecord(payload)) return [];

  const rawEvidence = Array.isArray(payload.evidence) ? payload.evidence : [];
  const rawCitations = Array.isArray(payload.citations) ? payload.citations : [];

  const parseRecordType = (kind: unknown): RecordType => {
    const s = String(kind ?? "").toLowerCase();
    if (s.includes("pull") || s === "pr") return "pull_request";
    if (s.includes("commit")) return "commit";
    if (s.includes("review_comment")) return "review_comment";
    if (s.includes("review")) return "review";
    if (s.includes("issue_comment")) return "issue_comment";
    if (s.includes("issue")) return "issue";
    if (s.includes("doc")) return "doc_file";
    if (s.includes("person")) return "person";
    return "changed_file";
  };

  const toCitationFromEvidence = (
    item: Record<string, unknown>,
    index: number,
  ): Citation => {
    const id = String(item.evidence_id || item.alias || `evidence-${index + 1}`);
    const path = item.path ? String(item.path) : null;
    const prNum = typeof item.pr_number === "number" ? item.pr_number : null;
    const title =
      (item.title ? String(item.title) : null) ||
      path ||
      (prNum ? `PR #${prNum}` : null) ||
      (item.alias ? String(item.alias) : id);
    const excerpt = String(item.excerpt || item.body || path || title || id);

    return {
      evidence_id: id,
      source_type: parseRecordType(item.kind || item.source_type),
      url: item.url ? String(item.url) : null,
      excerpt,
      author: item.author ? String(item.author) : null,
      created_at: item.created_at ? String(item.created_at) : null,
      title,
    };
  };

  // Index evidence items by id or alias for quick lookup
  const evidenceMap = new Map<string, Record<string, unknown>>();
  for (const item of rawEvidence) {
    if (isRecord(item)) {
      if (item.evidence_id) evidenceMap.set(String(item.evidence_id), item);
      if (item.alias) evidenceMap.set(String(item.alias), item);
      if (item.path) evidenceMap.set(String(item.path), item);
    }
  }

  // If citations are provided
  if (rawCitations.length > 0) {
    return dedupeCitations(rawCitations.map((item, index) => {
      // If already a structured object
      if (isRecord(item)) {
        const id = String(item.evidence_id || item.id || `citation-${index + 1}`);
        const matched = evidenceMap.get(id);
        const merged = matched ? { ...matched, ...item } : item;
        return toCitationFromEvidence(merged, index);
      }

      // If it's a string: e.g. "fastapi/params.py — Depends with cache" or an ID
      if (typeof item === "string") {
        const str = item.trim();
        const matched = evidenceMap.get(str);
        if (matched) {
          return toCitationFromEvidence(matched, index);
        }

        let title: string | null = null;
        let excerpt = str;
        let inferredType: RecordType = "changed_file";

        if (str.includes(" — ")) {
          const parts = str.split(" — ");
          title = parts[0].trim();
          excerpt = parts.slice(1).join(" — ").trim();
        } else if (str.includes(": ") && !str.startsWith("http")) {
          const parts = str.split(": ");
          title = parts[0].trim();
          excerpt = parts.slice(1).join(": ").trim();
        } else if (str.includes(" - ") && !str.startsWith("http")) {
          const parts = str.split(" - ");
          title = parts[0].trim();
          excerpt = parts.slice(1).join(" - ").trim();
        } else {
          title = str;
        }

        if (str.startsWith("http://") || str.startsWith("https://")) {
          return {
            evidence_id: `evidence-${index + 1}`,
            source_type: "doc_file",
            url: str,
            excerpt: str,
            title: title || str,
            author: null,
            created_at: null,
          };
        }

        if (title && (title.endsWith(".md") || title.toLowerCase().includes("doc"))) {
          inferredType = "doc_file";
        } else if (
          title &&
          (title.toLowerCase().includes("pr") || title.toLowerCase().includes("pull"))
        ) {
          inferredType = "pull_request";
        } else if (title && title.toLowerCase().includes("commit")) {
          inferredType = "commit";
        } else if (title && title.toLowerCase().includes("issue")) {
          inferredType = "issue";
        }

        return {
          evidence_id: title || `evidence-${index + 1}`,
          source_type: inferredType,
          url: null,
          excerpt: excerpt || title || `Evidence #${index + 1}`,
          title: title || `Evidence #${index + 1}`,
          author: null,
          created_at: null,
        };
      }

      return {
        evidence_id: `evidence-${index + 1}`,
        source_type: "changed_file",
        url: null,
        excerpt: "Referenced codebase evidence",
        title: `Evidence #${index + 1}`,
        author: null,
        created_at: null,
      };
    }));
  }

  // If citations array was empty, but evidence array exists, use evidence:
  if (rawEvidence.length > 0) {
    return dedupeCitations(rawEvidence.filter(isRecord).map(toCitationFromEvidence));
  }

  return [];
}

export function coerceEvidenceDetail(
  raw: unknown,
  fallbackId: string,
): EvidenceDetail {
  if (!isRecord(raw)) {
    return {
      evidence_id: fallbackId,
      source_type: "changed_file",
      record_type: "changed_file",
      repo: "",
      url: null,
      excerpt: fallbackId,
      title: fallbackId,
      author: null,
      created_at: null,
    };
  }

  const rawKind = raw.record_type || raw.source_type || raw.kind;
  const s = String(rawKind ?? "").toLowerCase();
  let recordType: RecordType = "changed_file";
  if (s.includes("pull") || s === "pr") recordType = "pull_request";
  else if (s.includes("commit")) recordType = "commit";
  else if (s.includes("review_comment")) recordType = "review_comment";
  else if (s.includes("review")) recordType = "review";
  else if (s.includes("issue_comment")) recordType = "issue_comment";
  else if (s.includes("issue")) recordType = "issue";
  else if (s.includes("doc")) recordType = "doc_file";
  else if (s.includes("person")) recordType = "person";

  const id = String(raw.evidence_id || fallbackId);
  const path = raw.path ? String(raw.path) : null;
  const prNum = typeof raw.pr_number === "number" ? raw.pr_number : null;
  const title =
    (raw.title ? String(raw.title) : null) ||
    path ||
    (prNum ? `PR #${prNum}` : null) ||
    id;

  return {
    evidence_id: id,
    source_type: recordType,
    record_type: recordType,
    repo: typeof raw.repo === "string" ? raw.repo : "",
    url: typeof raw.url === "string" ? raw.url : null,
    excerpt: String(raw.excerpt || raw.body || path || title || id),
    title,
    author: raw.author ? String(raw.author) : null,
    created_at: raw.created_at ? String(raw.created_at) : null,
    pr_number: prNum,
    body:
      typeof raw.body === "string"
        ? raw.body
        : typeof raw.excerpt === "string"
          ? raw.excerpt
          : null,
    payload: isRecord(raw.payload)
      ? (raw.payload as Record<string, unknown>)
      : undefined,
  };
}


/* ------------------------------------------------------------------ */
/* Decision records (features API)                                     */
/* ------------------------------------------------------------------ */

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

function coerceEvidenceRef(value: unknown): EvidenceRef | null {
  if (!isRecord(value)) return null;
  return {
    evidence_id: String(value.evidence_id ?? ""),
    kind: String(value.kind ?? ""),
    path: value.path ? String(value.path) : null,
    url: value.url ? String(value.url) : null,
    author: value.author ? String(value.author) : null,
  };
}

export function coerceRecord(value: unknown): DecisionRecord | null {
  if (!isRecord(value) || !value.decision_id) return null;
  const evidence = Array.isArray(value.evidence)
    ? value.evidence
        .map(coerceEvidenceRef)
        .filter((ref): ref is EvidenceRef => ref !== null)
    : [];
  return {
    decision_id: String(value.decision_id),
    repo: String(value.repo ?? ""),
    title: value.title ? String(value.title) : null,
    claim: String(value.claim ?? ""),
    rationale: String(value.rationale ?? ""),
    status: String(value.status ?? "active"),
    confidence: String(value.confidence ?? "medium"),
    kind: String(value.kind ?? "decision"),
    topic: value.topic ? String(value.topic) : null,
    target_ids: stringList(value.target_ids),
    evidence_ids: stringList(value.evidence_ids),
    evidence,
    superseded_by: value.superseded_by ? String(value.superseded_by) : null,
    supersedes: stringList(value.supersedes),
    pr_number: typeof value.pr_number === "number" ? value.pr_number : null,
    created_at: value.created_at ? String(value.created_at) : null,
  };
}

export function coerceRecordsPage(value: unknown): RecordsPage {
  if (!isRecord(value)) return { total: 0, limit: 25, offset: 0, records: [] };
  const records = Array.isArray(value.records)
    ? value.records
        .map(coerceRecord)
        .filter((r): r is DecisionRecord => r !== null)
    : [];
  return {
    total: typeof value.total === "number" ? value.total : records.length,
    limit: typeof value.limit === "number" ? value.limit : 25,
    offset: typeof value.offset === "number" ? value.offset : 0,
    records,
  };
}

export function coerceSearchResult(value: unknown): RecordsSearchResult {
  if (!isRecord(value)) return { query: "", repos: [], total: 0, results: [] };
  const results = Array.isArray(value.results)
    ? value.results
        .map(coerceRecord)
        .filter((r): r is DecisionRecord => r !== null)
    : [];
  return {
    query: String(value.query ?? ""),
    repos: stringList(value.repos),
    total: typeof value.total === "number" ? value.total : results.length,
    results,
  };
}

export function coerceSupersessions(value: unknown): SupersessionPair[] {
  if (!Array.isArray(value)) return [];
  const pairs: SupersessionPair[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const earlier = coerceRecord(item.earlier);
    const later = coerceRecord(item.later);
    if (!earlier || !later) continue;
    pairs.push({
      repo: String(item.repo ?? earlier.repo),
      earlier,
      later,
      relation: String(item.relation ?? "SUPERSEDED_BY"),
    });
  }
  return pairs;
}

export function coerceAudit(value: unknown): AuditReport | null {
  if (!isRecord(value)) return null;
  const counts = (input: unknown): Record<string, number> => {
    if (!isRecord(input)) return {};
    return Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, typeof v === "number" ? v : 0]),
    );
  };
  return {
    repo: String(value.repo ?? ""),
    generated_at: String(value.generated_at ?? ""),
    total: typeof value.total === "number" ? value.total : 0,
    by_status: counts(value.by_status),
    by_kind: counts(value.by_kind),
    with_rationale_pct:
      typeof value.with_rationale_pct === "number" ? value.with_rationale_pct : 0,
    with_evidence_pct:
      typeof value.with_evidence_pct === "number" ? value.with_evidence_pct : 0,
    superseded: typeof value.superseded === "number" ? value.superseded : 0,
    security_flagged:
      typeof value.security_flagged === "number" ? value.security_flagged : 0,
    security_missing_rationale: stringList(value.security_missing_rationale),
    missing_evidence: stringList(value.missing_evidence),
  };
}

export function coerceWebhookEvents(value: unknown): WebhookEvents {
  if (!isRecord(value)) return { events: [], jobs: [] };
  const events = Array.isArray(value.events)
    ? value.events.filter(isRecord).map((e) => ({
        delivery_id: String(e.delivery_id ?? ""),
        event: String(e.event ?? ""),
        action: e.action ? String(e.action) : null,
        repo: e.repo ? String(e.repo) : null,
        pr_number: typeof e.pr_number === "number" ? e.pr_number : null,
        title: e.title ? String(e.title) : null,
        received_at: String(e.received_at ?? ""),
      }))
    : [];
  const jobs = Array.isArray(value.jobs)
    ? value.jobs.filter(isRecord).map((j) => ({
        id: typeof j.id === "number" ? j.id : 0,
        kind: String(j.kind ?? ""),
        repo: String(j.repo ?? ""),
        created_at: String(j.created_at ?? ""),
        status: String(j.status ?? ""),
        detail: j.detail ? String(j.detail) : null,
      }))
    : [];
  return { events, jobs };
}
