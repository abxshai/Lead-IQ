"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  ArrowRight,
  Download,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  CircleAlert,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Same handoff key the RunWizard consumes (also defined in scrape/page.tsx).
const PENDING_SCRAPE_KEY = "qualifier.pending-scrape-push";

type Batch = { batch: string; count: number; last_received_at: string };
type WebhookInfo = {
  configured: boolean;
  url: string | null;
  payloadExample?: Record<string, unknown>;
  message?: string;
};

export function BitscaleInboxCard() {
  const router = useRouter();
  const [info, setInfo] = useState<WebhookInfo | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyBatch, setBusyBatch] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const loadBatches = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/bitscale/inbox");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setBatches(body.batches ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load Bitscale inbox.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/bitscale/webhook-info")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ configured: false, url: null }));
    void loadBatches();
  }, [loadBatches]);

  async function fetchCsv(batch: string): Promise<string> {
    const res = await fetch(
      `/api/bitscale/inbox?batch=${encodeURIComponent(batch)}`
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    return body.csv as string;
  }

  async function pushToCampaign(batch: string) {
    setBusyBatch(batch);
    setErr(null);
    try {
      const csv = await fetchCsv(batch);
      window.sessionStorage.setItem(
        PENDING_SCRAPE_KEY,
        JSON.stringify({
          csv,
          sourceLabel: `bitscale · ${batch}`,
          agentName: batch,
        })
      );
      router.push("/campaigns/new?from=scrape");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Push failed.");
      setBusyBatch(null);
    }
  }

  async function downloadCsv(batch: string) {
    setBusyBatch(batch);
    setErr(null);
    try {
      const csv = await fetchCsv(batch);
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `bitscale-${batch.replace(/[^a-z0-9]+/gi, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusyBatch(null);
    }
  }

  async function clearBatch(batch: string) {
    setBusyBatch(batch);
    setErr(null);
    try {
      const res = await fetch(
        `/api/bitscale/inbox?batch=${encodeURIComponent(batch)}`,
        { method: "DELETE" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      await loadBatches();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Clear failed.");
    } finally {
      setBusyBatch(null);
    }
  }

  function copyUrl() {
    if (!info?.url) return;
    void navigator.clipboard.writeText(info.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-primary" />
          Fetch a Bitscale table
        </CardTitle>
        <CardDescription>
          Bring a Bitscale grid into Lead-IQ, then send the rows into the
          campaign wizard to qualify them — enriched emails ride along. Two ways:{" "}
          <strong>export the grid as CSV</strong> and upload it in New Campaign
          (zero setup), or wire the <strong>webhook</strong> below to push rows
          in automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Webhook setup */}
        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
          <button
            type="button"
            onClick={() => setShowSetup((s) => !s)}
            className="flex w-full items-center justify-between text-sm font-medium"
          >
            <span>Webhook setup</span>
            <Badge
              variant="outline"
              className={
                info?.configured
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
              }
            >
              {info?.configured ? "ready" : "not configured"}
            </Badge>
          </button>

          {showSetup ? (
            <div className="mt-3 space-y-3 text-xs text-muted-foreground">
              {info?.configured && info.url ? (
                <>
                  <div>
                    In Bitscale, on your grid: <strong>Add Column → Action
                    Column → Webhook</strong>. Paste this URL, map your grid
                    columns into the payload, then run the column (it POSTs one
                    row per record):
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-md bg-muted px-2 py-1 font-mono text-foreground">
                      {info.url}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyUrl}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <div>Example payload (map grid columns to these keys):</div>
                  <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] text-foreground/90">
                    {JSON.stringify(info.payloadExample ?? {}, null, 2)}
                  </pre>
                  <div>
                    <code className="font-mono">batch</code> groups rows into one
                    importable list. The rest map through the same aliases as CSV
                    upload.
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-yellow-200">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Each value must be a <strong>live Bitscale column
                      reference</strong> (use Bitscale&apos;s variable / insert
                      control in the payload editor) — not literal{" "}
                      <code className="font-mono">{"{{…}}"}</code> text. Literal
                      text sends the same value for every row, so the whole grid
                      imports as one deduped lead.
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-yellow-200">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {info?.message ??
                      "Set BITSCALE_WEBHOOK_SECRET in the deployment env to enable the webhook."}
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Received batches */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Received tables</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadBatches()}
            disabled={loading}
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </Button>
        </div>

        {err ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{err}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : batches.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
            No Bitscale pushes yet. Configure the webhook above and run a Webhook
            Action Column over a grid in Bitscale.
          </div>
        ) : (
          <ul className="space-y-2">
            {batches.map((b) => {
              const busy = busyBatch === b.batch;
              return (
                <li
                  key={b.batch}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{b.batch}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.count} row{b.count === 1 ? "" : "s"} · last{" "}
                      {new Date(b.last_received_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void pushToCampaign(b.batch)}
                      disabled={busy}
                      className="gap-1.5"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                      Push to Campaign
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void downloadCsv(b.batch)}
                      disabled={busy}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void clearBatch(b.batch)}
                      disabled={busy}
                      title="Clear this batch"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
