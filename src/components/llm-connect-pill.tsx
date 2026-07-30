"use client";

import { useEffect, useState } from "react";
import { Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectLlmDialog } from "@/components/connect-llm-dialog";
import { useLlmStore } from "@/lib/llm-store";
import { PROVIDERS } from "@/lib/llm-config";

export function LlmConnectPill() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const provider = useLlmStore((s) => s.provider);
  const connected = useLlmStore((s) => Boolean(s.keys[s.provider]));

  // Avoid hydration mismatch — status comes from sessionStorage.
  useEffect(() => {
    setMounted(true);
  }, []);

  const label = !mounted
    ? "Connect model"
    : connected
      ? `${PROVIDERS[provider].label} connected`
      : `Connect ${PROVIDERS[provider].label}`;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 border-primary/30 bg-primary/5 hover:bg-primary/10"
      >
        <span
          className={
            mounted && connected
              ? "inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_oklch(0.78_0.18_150)]"
              : "inline-block h-2 w-2 rounded-full bg-muted-foreground/40"
          }
        />
        <Key className="h-3.5 w-3.5" />
        {label}
      </Button>
      <ConnectLlmDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
