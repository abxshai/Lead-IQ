import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { rowToLead } from "@/lib/lead-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bitscale Webhook/Export receiver.
 *
 * Bitscale's run/enrich REST API is Enterprise-gated and has no read-rows
 * endpoint, so we ingest via its per-row "Webhook Action Column": the user
 * configures a column in Bitscale that POSTs one JSON object per grid row to
 * this URL. The payload shape is user-defined, so we run it through the shared
 * `rowToLead` mapper (same aliases as CSV/PB ingest) — any of fullName /
 * first+last / companyName / title / linkedInUrl / email columns map through.
 *
 * Auth: a shared secret in `?token=` (or the `x-bitscale-webhook-secret`
 * header) matched against BITSCALE_WEBHOOK_SECRET. Bitscale can't do Supabase
 * auth, so this token gates the endpoint; the handler writes as the service
 * role. Rows land in `bitscale_inbox`, grouped by `batch`, and the /scrape page
 * turns a batch into a campaign.
 */
export async function POST(request: Request) {
  const secret = process.env.BITSCALE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured (BITSCALE_WEBHOOK_SECRET unset)." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ??
    request.headers.get("x-bitscale-webhook-secret") ??
    "";
  if (token !== secret) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
  }

  // Batch = which grid/campaign this row belongs to. Accept a few key names the
  // user might wire up; default so nothing is dropped.
  const batchRaw =
    body.batch ?? body.campaign ?? body.grid ?? body.grid_name ?? body.table;
  const batch =
    typeof batchRaw === "string" && batchRaw.trim().length > 0
      ? batchRaw.trim().slice(0, 200)
      : "Bitscale import";

  const lead = rowToLead(body);

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("bitscale_inbox").insert({
    batch,
    default_profile_url: lead.default_profile_url,
    full_name: lead.full_name,
    first_name: lead.first_name,
    last_name: lead.last_name,
    company_name: lead.company_name,
    title: lead.title,
    summary: lead.summary,
    title_description: lead.title_description,
    location: lead.location,
    email: lead.email,
    raw: body,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, batch });
}
