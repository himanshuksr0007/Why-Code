"use client";

import { useState } from "react";
import { FolderIcon, ChevronRightIcon, FileIcon, MoreVerticalIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTreeItem {
  name: string;
  type: "file" | "folder";
  children?: FileTreeItem[];
  expanded?: boolean;
  icon?: "folder" | "file-code";
}

// Mock file tree data matching reference UI
const mockFileTree: FileTreeItem[] = [
  {
    name: "frontend-web",
    type: "folder",
    expanded: true,
    children: [],
  },
  {
    name: "Architecture Refact...",
    type: "file",
    icon: "file-code",
  },
  {
    name: "Design system mig...",
    type: "file",
    icon: "file-code",
  },
  {
    name: "backend-services",
    type: "folder",
    children: [],
  },
  {
    name: "infrastructure-devops",
    type: "folder",
    children: [],
  },
  {
    name: "mobile-app",
    type: "folder",
    children: [],
  },
  {
    name: "drafts",
    type: "folder",
    children: [],
  },
];

function TreeItem({
  item,
  depth = 0,
}: {
  item: FileTreeItem;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(item.expanded ?? false);

  if (item.type === "folder") {
    return (
      <div className="select-none">
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 hover:bg-accent/60",
            depth > 0 && "ml-4"
          )}
        >
          <FolderIcon className="size-4 shrink-0 text-[#F5C842]" aria-hidden="true" />
          <span className="truncate text-foreground">{item.name}</span>
        </button>
        {expanded && item.children && (
          <div className="ml-2">
            {item.children.map((child, idx) => (
              <TreeItem key={idx} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File items — with a code-branch style icon for code files
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
        depth > 0 ? "ml-6" : "ml-0",
        "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {item.icon === "file-code" ? (
        <svg className="size-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="m10 13-2 2 2 2" />
          <path d="m14 17 2-2-2-2" />
        </svg>
      ) : (
        <FileIcon className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{item.name}</span>
    </button>
  );
}

export function FileTreeSidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "hidden xl:flex xl:w-64 2xl:w-72 shrink-0 flex-col",
        className
      )}
    >
      <div className="sticky top-4 flex flex-col gap-3 p-3">
        <div className="rounded-2xl bg-card shadow-neumorph p-4 animate-scale">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Nexus core engine
            </h2>
            <button
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-150"
              aria-label="More options"
            >
              <MoreVerticalIcon className="size-4" />
            </button>
          </div>
          <div className="space-y-0.5 max-h-[calc(100vh-8rem)] overflow-y-auto">
            {mockFileTree.map((item, idx) => (
              <TreeItem key={idx} item={item} />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
