"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { AnswerMarkdown, normalizeMarkdown } from "@/components/answer/answer-markdown";
import { CitationCard } from "@/components/answer/citation-card";
import { PlanTable } from "@/components/answer/plan-view";
import { DecisionCard } from "@/components/answer/decision-card";
import { CodeChangeCard } from "@/components/changes/code-change-card";
import {
  GraphCanvas,
  KIND_COLORS,
} from "@/components/graph/graph-canvas";
import { graphPathToPlanGraph } from "@/lib/graph";
import type { PlanGraph } from "@/lib/api/types";
import { AnswerStatusBadge, ConfidenceBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import TextAnimation from "@/components/ui/staggerText";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AskResponse } from "@/lib/api/types";
import { coerceCitations } from "@/lib/api/normalize";
import { formatLatency } from "@/lib/format";
import { hapticSelection } from "@/lib/haptics";

/**
 * Splits the opening paragraph off the answer so it can be revealed word by
 * word with the registry's stagger-text animation. Anything that is not a
 * simple paragraph (a list, a heading, a fence) stays with the markdown
 * renderer.
 */
function splitLead(markdown: string): { lead: string | null; rest: string } {
  const normalized = normalizeMarkdown(markdown);
  const paragraphs = normalized.split(/\n{2,}/);
  const first = paragraphs[0]?.trim() ?? "";
  const rest = paragraphs.slice(1).join("\n\n").trim();

  if (
    !first ||
    !rest ||
    first.includes("\n") ||
    /^(#|[-*+>|]|```|\d+\.)/.test(first) ||
    first.split(/\s+/).length > 60
  ) {
    return { lead: null, rest: normalized };
  }

  const lead = first
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return lead ? { lead, rest } : { lead: null, rest: normalized };
}

/**
 * The one graph figure for the answer panel: the shared GraphCanvas
 * (the same renderer as the rail bubble and the fullscreen viewer),
 * at natural size in a scrollable frame, with a kind legend.
 */
function GraphFigure({
  graph,
  caption,
}: {
  graph: PlanGraph;
  caption: string;
}) {
  const kinds = [...new Set(graph.nodes.map((node) => node.kind))];
  return (
    <figure className="space-y-2.5">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/40 shadow-[inset_2px_2px_5px_var(--neu-dark),inset_-2px_-2px_5px_var(--neu-light)]">
        <GraphCanvas graph={graph} variant="connections" sizing="natural" />
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="min-w-0 flex-1">{caption}</span>
        {kinds.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1">
            <span
              className="size-1.5 rounded-full"
              style={{ background: KIND_COLORS[kind] ?? KIND_COLORS.module }}
            />
            {kind}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function AnswerPanel({ response }: { response: AskResponse }) {
  const citations = coerceCitations(response);
  const { graph_path, decisions, changes } = response;
  const plan = response.plan ?? null;
  const latency = formatLatency(response.latency_ms);
  const decisionList = decisions ?? [];
  const changeList = changes ?? [];
  const normalizedAnswer = normalizeMarkdown(response.answer);
  const { lead, rest } = splitLead(normalizedAnswer);

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(normalizedAnswer);
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
        <div className="flex items-center gap-2 mr-1">
          <div className="size-6 rounded-full overflow-hidden shrink-0 border border-border/60 shadow-xs bg-muted">
            <img
              src="/WhyAgent.png"
              alt="WhyAgent logo"
              className="size-full object-cover"
            />
          </div>
          <span className="text-xs font-semibold text-foreground tracking-tight">
            WhyAgent
          </span>
        </div>
        {response.status ? <AnswerStatusBadge status={response.status} /> : null}
        {response.confidence ? <ConfidenceBadge confidence={response.confidence} /> : null}
        {plan ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            Plan mode
          </span>
        ) : null}
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
          <AnswerMarkdown>{normalizedAnswer}</AnswerMarkdown>
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

      <Tabs
        defaultValue={plan ? "plan" : "evidence"}
        onValueChange={() => hapticSelection()}
        className="border-t border-border/70"
      >
        <div className="px-4 pt-3">
          <TabsList variant="line">
            {plan ? (
              <TabsTrigger key="plan" value="plan">
                Plan
                <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                  {plan.steps.length}
                </span>
              </TabsTrigger>
            ) : null}
            {plan ? (
              <TabsTrigger key="connections" value="connections">
                Connections
              </TabsTrigger>
            ) : null}
            <TabsTrigger key="evidence" value="evidence">
              Evidence
              <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                {citations.length}
              </span>
            </TabsTrigger>
            {graph_path ? (
              <TabsTrigger key="graph" value="graph">Graph path</TabsTrigger>
            ) : null}
            {changeList.length > 0 ? (
              <TabsTrigger key="changes" value="changes">
                Changes
                <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                  {changeList.length}
                </span>
              </TabsTrigger>
            ) : null}
            {decisionList.length > 0 ? (
              <TabsTrigger key="decisions" value="decisions">
                Decisions
                <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                  {decisionList.length}
                </span>
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        {plan ? (
          <TabsContent key="plan" value="plan" className="px-4 pt-3 pb-4">
            <PlanTable steps={plan.steps} citations={citations} />
          </TabsContent>
        ) : null}

        {plan ? (
          <TabsContent key="connections" value="connections" className="px-4 pt-3 pb-4">
            <GraphFigure graph={plan.graph} caption={plan.goal} />
          </TabsContent>
        ) : null}

        <TabsContent key="evidence" value="evidence" className="px-4 pt-3 pb-4">
          {citations.length > 0 ? (
            <ul className="space-y-2">
              {citations.map((citation, index) => (
                <CitationCard
                  key={citation.evidence_id ? `${citation.evidence_id}-${index}` : `citation-${index}`}
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
          <TabsContent key="graph" value="graph" className="px-4 pt-3 pb-4">
            <GraphFigure
              graph={graphPathToPlanGraph(graph_path)}
              caption="The path retrieval walked to ground this answer — the same graph the rail's View Graph opens fullscreen."
            />
          </TabsContent>
        ) : null}

        {changeList.length > 0 ? (
          <TabsContent key="changes" value="changes" className="px-4 pt-3 pb-4">
            <div className="space-y-3">
              {changeList.map((change, index) => (
                <CodeChangeCard
                  key={change.change_id ? `${change.change_id}-${index}` : `change-${index}`}
                  change={change}
                />
              ))}
            </div>
          </TabsContent>
        ) : null}

        {decisionList.length > 0 ? (
          <TabsContent key="decisions" value="decisions" className="px-4 pt-3 pb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {decisionList.map((decision, index) => (
                <DecisionCard
                  key={decision.decision_id ? `${decision.decision_id}-${index}` : `decision-${index}`}
                  decision={decision}
                />
              ))}
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </section>
  );
}
