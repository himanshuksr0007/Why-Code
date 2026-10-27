"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { AddCustomModelDialog } from "@/components/chat/add-custom-model-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ModelInfo } from "@/lib/models/api";
import { DEFAULT_MODEL_ID, useModelSelection } from "@/lib/models/store";
import { cn } from "@/lib/utils";

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

function ModelRow({
  model,
  active,
  onSelect,
  onRemove,
}: {
  model: ModelInfo;
  active: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  return (
    <DropdownMenuItem
      onClick={onSelect}
      className="group flex cursor-pointer items-start gap-2 px-2 py-1.5"
    >
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
        {active ? (
          <CheckIcon className="size-3.5 text-primary" aria-hidden="true" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">
          {model.name}
        </span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {model.model} · {endpointHost(model.endpoint)}
          {model.custom && model.key_hint ? ` · key ••••${model.key_hint}` : ""}
        </span>
      </span>
      {model.custom && onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${model.name}`}
          title={`Remove ${model.name}`}
          className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onRemove();
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Trash2Icon aria-hidden="true" />
        </Button>
      ) : null}
    </DropdownMenuItem>
  );
}

/**
 * The model selector pill above the composer.
 *
 * The label is whatever model is actually selected: the server's default
 * (its name comes from the backend's configuration, never hard-coded) or
 * one of the visitor's own custom models. "Add custom model" opens the
 * BYOK dialog.
 */
export function ModelPicker({ disabled = false }: { disabled?: boolean }) {
  const {
    models,
    selectedId,
    selectedModel,
    reachable,
    selectModel,
    removeCustomModel,
  } = useModelSelection();
  const [addOpen, setAddOpen] = useState(false);

  const label = selectedModel?.name ?? (reachable ? "Server model" : "Model");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          aria-label={`Model: ${label}. Change model`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
            "text-xs font-medium transition-all duration-200",
            "bg-card border-border/60 text-muted-foreground hover:border-primary/30 shadow-neumorph",
            "outline-none disabled:pointer-events-none disabled:opacity-60",
          )}
        >
          <span className="text-[#E8651A]">✸</span>
          <span className="max-w-44 truncate">{label}</span>
          <ChevronDownIcon className="size-3 shrink-0" aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-80">
          <div className="px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Model
          </div>

          {models ? (
            <ModelRow
              model={models.default}
              active={selectedId === DEFAULT_MODEL_ID}
              onSelect={() => selectModel(DEFAULT_MODEL_ID)}
            />
          ) : (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {reachable
                ? "Loading models…"
                : "Backend unreachable — model list unavailable."}
            </p>
          )}

          {models?.custom.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              active={selectedId === model.id}
              onSelect={() => selectModel(model.id)}
              onRemove={() => void removeCustomModel(model.id)}
            />
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setAddOpen(true)}
            className="cursor-pointer px-2 py-1.5"
          >
            <PlusIcon className="size-3.5" aria-hidden="true" />
            <span className="text-xs font-medium">Add custom model</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              your API key
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddCustomModelDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => undefined}
      />
    </>
  );
}
