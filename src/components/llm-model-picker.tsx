"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLlmStore } from "@/lib/llm-store";
import {
  LLM_PROVIDERS,
  PROVIDERS,
  providerDefaultModel,
  type LlmProvider,
} from "@/lib/llm-config";

/**
 * Provider + model selector, driven by the shared BYOK store. Fetches the
 * active provider's model list live from `/api/llm/models` (which also
 * validates the key). Used on both the campaign wizard and the chat surface.
 *
 * `size="sm"` renders a compact inline variant (chat header) without labels.
 */
export function LlmModelPicker({ size = "default" }: { size?: "sm" | "default" }) {
  const provider = useLlmStore((s) => s.provider);
  const model = useLlmStore((s) => s.model);
  const key = useLlmStore((s) => s.keys[s.provider]);
  const setProvider = useLlmStore((s) => s.setProvider);
  const setModel = useLlmStore((s) => s.setModel);

  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const effectiveModel = model ?? providerDefaultModel(provider);

  // (Re)load the model list whenever the active provider or its key changes.
  useEffect(() => {
    if (!key) {
      setModels([]);
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch("/api/llm/models", {
      headers: { "x-llm-key": key, "x-llm-provider": provider },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as {
          models?: string[];
          error?: string;
        } | null;
        if (cancelled) return;
        if (!res.ok) {
          setErr(body?.error ?? `Couldn't load models (${res.status}).`);
          setModels([]);
          return;
        }
        setModels(body?.models ?? []);
      })
      .catch(() => {
        if (!cancelled) setErr("Couldn't reach the model list.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, key]);

  // Ensure the currently-selected model is always an option (provider default,
  // or a previously-chosen model not present in a freshly-loaded list).
  const options = Array.from(new Set([effectiveModel, ...models]));

  const compact = size === "sm";

  return (
    <div className={compact ? "flex items-center gap-2" : "grid gap-4 sm:grid-cols-2"}>
      <div className={compact ? "" : "space-y-1.5"}>
        {!compact ? <Label>Model provider</Label> : null}
        <Select
          value={provider}
          onValueChange={(v) => {
            setProvider(v as LlmProvider);
            setModel(null); // fall back to the new provider's default
          }}
        >
          <SelectTrigger size={compact ? "sm" : "default"} className={compact ? "" : "w-full"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LLM_PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>
                {PROVIDERS[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={compact ? "" : "space-y-1.5"}>
        {!compact ? (
          <Label className="flex items-center gap-2">
            Model
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : null}
          </Label>
        ) : null}
        <Select
          value={effectiveModel}
          onValueChange={(v) => setModel(v as string)}
        >
          <SelectTrigger
            size={compact ? "sm" : "default"}
            className={compact ? "max-w-[16rem]" : "w-full"}
            disabled={!key}
          >
            <SelectValue placeholder={key ? "Pick a model" : "Connect a key first"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!compact && err ? (
          <p className="text-xs text-destructive">{err}</p>
        ) : null}
        {!compact && !key ? (
          <p className="text-xs text-muted-foreground">
            Connect a {PROVIDERS[provider].label} key from the top-right to load
            the model list.
          </p>
        ) : null}
      </div>
    </div>
  );
}
