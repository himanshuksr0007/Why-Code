"use client";

import { useRef, useState, useSyncExternalStore, type ComponentType, type KeyboardEvent } from "react";

import { ActionDiagram, IntentDiagram, McpDiagram, RetrievalDiagram, ValidatorDiagram } from "./diagrams/answer-diagrams";
import { GitDiagram, GraphDiagram, LedgerDiagram, MinersDiagram, TreeSitterDiagram } from "./diagrams/record-diagrams";
import { TECH } from "@/lib/tech";

import { Pill } from "./ui";

const DIAGRAMS: Record<string, ComponentType> = {
  git: GitDiagram,
  miners: MinersDiagram,
  "tree-sitter": TreeSitterDiagram,
  neo4j: GraphDiagram,
  ledger: LedgerDiagram,
  retrieval: RetrievalDiagram,
  distilbert: IntentDiagram,
  llm: ValidatorDiagram,
  mcp: McpDiagram,
  "github-action": ActionDiagram,
};

function subscribeHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export function TechExplorer() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");
  const [chosen, setChosen] = useState<string | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeId = chosen ?? (TECH.some((t) => t.id === hash) ? hash : TECH[0].id);
  const activeIndex = TECH.findIndex((t) => t.id === activeId);
  const active = TECH[activeIndex];
  const ActiveDiagram = DIAGRAMS[active.id];

  const select = (index: number, focus = false) => {
    const id = TECH[index].id;
    setChosen(id);
    window.history.replaceState(null, "", `#${id}`);
    if (focus) tabs.current[index]?.focus();
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };
    if (event.key in keys) {
      event.preventDefault();
      select((activeIndex + keys[event.key] + TECH.length) % TECH.length, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0, true);
    } else if (event.key === "End") {
      event.preventDefault();
      select(TECH.length - 1, true);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_1fr] lg:gap-6">
      <div
        role="tablist"
        aria-label="Technologies"
        aria-orientation="vertical"
        onKeyDown={onKey}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0"
      >
        {TECH.map((tech, i) => {
          const on = tech.id === activeId;
          return (
            <button
              key={tech.id}
              id={tech.id}
              ref={(node) => {
                tabs.current[i] = node;
              }}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="tech-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => select(i)}
              className={`group relative flex shrink-0 scroll-mt-24 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all duration-300 lg:w-full ${
                on
                  ? "border-ink/60 bg-raised text-ink"
                  : "border-line text-ink-soft hover:border-line-strong hover:text-ink lg:border-transparent"
              }`}
            >
              <span
                className={`font-mono text-[10px] transition-colors ${on ? "text-ink" : "text-ink-faint"}`}
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="whitespace-nowrap">{tech.name}</span>
              <span
                aria-hidden="true"
                className={`ml-auto hidden h-1.5 rounded-full bg-ink transition-all duration-300 lg:block ${on ? "w-4" : "w-0"}`}
              />
            </button>
          );
        })}
      </div>

      <div id="tech-panel" role="tabpanel" aria-labelledby={active.id} className="min-w-0">
        <div key={active.id} className="rise">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-mono text-lg text-ink">{active.name}</h3>
              <p className="mt-1 text-sm text-ink-soft">{active.simple}</p>
            </div>
            <Pill tone={active.status.tone}>{active.status.text}</Pill>
          </div>
          <div className="mt-4">
            <ActiveDiagram />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="font-mono text-[11px] tracking-wider text-ink-faint uppercase">How it works</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{active.how}</p>
            </div>
            <div className="rounded-xl border border-ink/25 bg-surface p-5">
              <p className="font-mono text-[11px] tracking-wider text-ink-faint uppercase">How Why-Code uses it</p>
              <p className="mt-2 text-sm leading-relaxed text-ink">{active.use}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
