"use client";

import { useState } from "react";
import { KeyRoundIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ModelInfo } from "@/lib/models/api";
import { addCustomModel } from "@/lib/models/store";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function validateEndpoint(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "Enter a valid URL, e.g. https://api.openai.com/v1";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "The endpoint must be an http(s) URL.";
  }
  if (url.username || url.password) {
    return "The endpoint must not embed credentials — the API key has its own field.";
  }
  if (url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname)) {
    return "Endpoints must use https (http is allowed only for localhost).";
  }
  return null;
}

/**
 * "Add custom model" flow for the model picker.
 *
 * The visitor's own OpenAI-compatible model: name, model id, API base URL
 * and key. The key is sent once over this request, stored encrypted on
 * the server, and never displayed again — the picker shows only its last
 * four characters.
 */
export function AddCustomModelDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (model: ModelInfo) => void;
}) {
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [contextTokens, setContextTokens] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setModel("");
    setEndpoint("");
    setApiKey("");
    setContextTokens("");
    setError(null);
    setSubmitting(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!name.trim()) return setError("Give the model a display name.");
    if (!model.trim()) return setError("Enter the model name the API expects.");
    const endpointError = validateEndpoint(endpoint);
    if (endpointError) return setError(endpointError);
    if (!apiKey.trim()) return setError("Enter the API key for this endpoint.");
    let context = 128_000;
    if (contextTokens.trim()) {
      context = Number(contextTokens);
      if (!Number.isFinite(context) || context < 1_000 || context > 2_000_000) {
        return setError("Context window must be between 1,000 and 2,000,000 tokens.");
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await addCustomModel({
        name: name.trim(),
        model: model.trim(),
        endpoint: endpoint.trim().replace(/\/+$/, ""),
        api_key: apiKey.trim(),
        context_tokens: Math.trunc(context),
      });
      reset();
      onOpenChange(false);
      onAdded(created);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The model could not be added.",
      );
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add custom model</DialogTitle>
          <DialogDescription>
            Use your own OpenAI-compatible model for answers. Your API key is
            stored encrypted on the server and used only for your requests —
            it is never shown again, only its last four characters.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <label htmlFor="custom-model-name" className="text-xs font-medium">
              Display name
            </label>
            <Input
              id="custom-model-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My high-end model"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="custom-model-id" className="text-xs font-medium">
              Model name
            </label>
            <Input
              id="custom-model-id"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="gpt-4.1"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="custom-model-endpoint" className="text-xs font-medium">
              API base URL
            </label>
            <Input
              id="custom-model-endpoint"
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="https://api.openai.com/v1"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="custom-model-key" className="text-xs font-medium">
              API key
            </label>
            <Input
              id="custom-model-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="custom-model-context" className="text-xs font-medium">
              Context window (tokens, optional)
            </label>
            <Input
              id="custom-model-context"
              type="number"
              min={1000}
              max={2000000}
              value={contextTokens}
              onChange={(event) => setContextTokens(event.target.value)}
              placeholder="128000"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Used as the denominator of the token-usage meter under the
              composer.
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <KeyRoundIcon className="animate-pulse" aria-hidden="true" />
              ) : (
                <PlusIcon aria-hidden="true" />
              )}
              {submitting ? "Adding…" : "Add model"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
