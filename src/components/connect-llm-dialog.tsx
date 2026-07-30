"use client";

import { useState } from "react";
import { Key, ShieldCheck, AlertCircle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLlmStore } from "@/lib/llm-store";
import { LLM_PROVIDERS, PROVIDERS, type LlmProvider } from "@/lib/llm-config";

export function ConnectLlmDialog({
  open,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const keys = useLlmStore((s) => s.keys);
  const activeProvider = useLlmStore((s) => s.provider);
  const setKey = useLlmStore((s) => s.setKey);
  const clearKey = useLlmStore((s) => s.clearKey);
  const setProvider = useLlmStore((s) => s.setProvider);
  const setModel = useLlmStore((s) => s.setModel);

  // Which provider's key are we editing in the form right now.
  const [editing, setEditing] = useState<LlmProvider>(activeProvider);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const key = draft.trim();
    if (!key) return;
    setBusy(true);
    setErr(null);
    try {
      // Validate + confirm reachability via our proxy (avoids CORS + keeps the
      // key off the third-party origin). 200 => the provider accepted it.
      const res = await fetch("/api/llm/models", {
        headers: { "x-llm-key": key, "x-llm-provider": editing },
      });
      if (!res.ok) {
        setErr(
          res.status === 401
            ? `That key was rejected by ${PROVIDERS[editing].label}.`
            : `${PROVIDERS[editing].label} returned ${res.status}. Try again.`
        );
        return;
      }
      setKey(editing, key);
      // Make the just-connected provider active, and reset the model so the
      // surfaces fall back to that provider's default until the user picks one.
      setProvider(editing);
      setModel(null);
      setDraft("");
      onOpenChange?.(false);
    } catch {
      setErr(`Couldn't reach ${PROVIDERS[editing].label}. Check your network.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Connect a model provider
          </DialogTitle>
          <DialogDescription>
            Bring your own key for Groq or Together.ai. Keys are validated,
            kept in this tab only (sessionStorage), and attached as a header on
            each run. They&apos;re never stored on our server.
          </DialogDescription>
        </DialogHeader>

        {/* Active provider + connection status per provider */}
        <div className="space-y-1.5">
          <Label>Active provider</Label>
          <div className="grid grid-cols-2 gap-2">
            {LLM_PROVIDERS.map((p) => {
              const connected = Boolean(keys[p]);
              const active = activeProvider === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setProvider(p);
                    setModel(null);
                    setEditing(p);
                    setDraft("");
                    setErr(null);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span>{PROVIDERS[p].label}</span>
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      connected
                        ? "bg-emerald-400 shadow-[0_0_10px_oklch(0.78_0.18_150)]"
                        : "bg-muted-foreground/40"
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="llm-key">
              {PROVIDERS[editing].label} API key
              {keys[editing] ? (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-400">
                  <Check className="h-3 w-3" /> connected
                </span>
              ) : null}
            </Label>
            <Input
              id="llm-key"
              type="password"
              placeholder={PROVIDERS[editing].keyPrefix ?? "your API key"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {err ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{err}</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                We validate against{" "}
                <code className="font-mono text-foreground">/models</code>{" "}
                before accepting the key. No run is charged.
              </span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {keys[editing] ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  clearKey(editing);
                  setDraft("");
                }}
              >
                Disconnect {PROVIDERS[editing].label}
              </Button>
            ) : null}
            <Button type="submit" disabled={busy || !draft.trim()}>
              {busy ? "Validating…" : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
