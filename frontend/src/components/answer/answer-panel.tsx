"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { AnswerMarkdown } from "@/components/answer/answer-markdown";
import { CitationCard } from "@/components/answer/citation-card";
import { DecisionCard } from "@/components/answer/decision-card";
import { CodeChangeCard } from "@/components/changes/code-change-card";
import { GraphPathView } from "@/components/graph/graph-path-view";
import { AnswerStatusBadge, ConfidenceBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import TextAnimation from "@/components/ui/staggerText";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AskResponse } from "@/lib/api/types";
import { formatLatency } from "@/lib/format";

/**
 * Splits the opening paragraph off the answer so it can be revealed word by
 * word with the registry's stagger-text animation. Anything that is not a
 * simple paragraph (a list, a heading, a fence) stays with the markdown
 * renderer.
 */
function splitLead(markdown: string): { lead: string | null; rest: string } {
  const paragraphs = markdown.split(/\n{2,}/);
  const first = paragraphs[0]?.trim() ?? "";
  const rest = paragraphs.slice(1).join("\n\n").trim();

  if (
    !first ||
    !rest ||
    first.includes("\n") ||
    /^(#|[-*+>|]|```)/.test(first) ||
    first.split(/\s+/).length > 60
  ) {
    return { lead: null, rest: markdown };
  }

  const lead = first
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return lead ? { lead, rest } : { lead: null, rest: markdown };
}

export function AnswerPanel({ response }: { response: AskResponse }) {
  const { citations, graph_path, decisions, changes } = response;
  const latency = formatLatency(response.latency_ms);
  const decisionList = decisions ?? [];
  const changeList = changes ?? [];
  const { lead, rest } = splitLead(response.answer);

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(response.answer);
      toast.success("Answer copied");
    } catch {
      toast.error("Could not copy the answer");
    }
  };

  return (
    <section
      aria-label="Answer"
      className="animate-rise overflow-hidden rounded-3xl border border-border/60 bg-card shadow-lift"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
        <AnswerStatusBadge status={response.status} />
        <ConfidenceBadge confidence={response.confidence} />
        {latency ? (
          <span className="text-xs text-muted-foreground">{latency}</span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <span
            className="hidden font-mono text-[11px] text-muted-foreground sm:inline"
            title="Retrieval trace ID"
          >
            {response.retrieval_trace_id}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={copyAnswer}>
            <CopyIcon aria-hidden="true" />
            <span className="sr-only">Copy answer</span>
          </Button>
        </div>
      </div>

      <div className="px-4 py-4">
        {lead ? (
          <>
            <p className="mb-3 text-[0.95rem] leading-relaxed font-medium text-foreground">
              <TextAnimation delay={0.04}>{lead}</TextAnimation>
            </p>
            <AnswerMarkdown>{rest}</AnswerMarkdown>
          </>
        ) : (
          <AnswerMarkdown>{response.answer}</AnswerMarkdown>
        )}

        {response.status === "partial" ? (
          <p className="mt-4 rounded-lg border border-chart-4/40 bg-chart-4/10 px-3 py-2 text-xs text-chart-4">
            This is a partial answer: the evidence supports part of it, but not
            all of it. Treat the unsupported part as unverified.
          </p>
        ) : null}

        {response.superseded_by ? (
          <p className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Superseded by a later decision:{" "}
            <span className="font-mono">{response.superseded_by}</span>
          </p>
        ) : null}
      </div>

      <Tabs defaultValue="evidence" className="border-t border-border/70">
        <div className="px-4 pt-3">
          <TabsList variant="line">
            <TabsTrigger value="evidence">
              Evidence
              <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                {citations.length}
              </span>
            </TabsTrigger>
            {graph_path ? (
              <TabsTrigger value="graph">Graph path</TabsTrigger>
            ) : null}
            {changeList.length > 0 ? (
              <TabsTrigger value="changes">
                Changes
                <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                  {changeList.length}
                </span>
              </TabsTrigger>
            ) : null}
            {decisionList.length > 0 ? (
              <TabsTrigger value="decisions">
                Decisions
                <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                  {decisionList.length}
                </span>
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <TabsContent value="evidence" className="px-4 pt-3 pb-4">
          {citations.length > 0 ? (
            <ul className="space-y-2">
              {citations.map((citation, index) => (
                <CitationCard
                  key={citation.evidence_id}
                  citation={citation}
                  index={index}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No citations were attached to this answer.
            </p>
          )}
        </TabsContent>

        {graph_path ? (
          <TabsContent value="graph" className="px-4 pt-3 pb-4">
            <GraphPathView path={graph_path} />
          </TabsContent>
        ) : null}

        {changeList.length > 0 ? (
          <TabsContent value="changes" className="px-4 pt-3 pb-4">
            <div className="space-y-3">
              {changeList.map((change) => (
                <CodeChangeCard key={change.change_id} change={change} />
              ))}
            </div>
          </TabsContent>
        ) : null}

        {decisionList.length > 0 ? (
          <TabsContent value="decisions" className="px-4 pt-3 pb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {decisionList.map((decision) => (
                <DecisionCard key={decision.decision_id} decision={decision} />
              ))}
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </section>
  );
}
