import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The lead columns we surface out of the inbox, in canonical (snake_case) form
// so the produced CSV re-parses cleanly through lead-parser on Push-to-Campaign.
const ROW_COLS = [
  "default_profile_url",
  "full_name",
  "first_name",
  "last_name",
  "company_name",
  "title",
  "summary",
  "title_description",
  "location",
  "email",
] as const;

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * GET /api/bitscale/inbox            → grouped batch list
 * GET /api/bitscale/inbox?batch=NAME → rows for a batch, plus a ready CSV
 */
export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batch = new URL(request.url).searchParams.get("batch");

  if (!batch) {
    // Grouped list — the inbox is small (hundreds of rows), so group in JS.
    const { data, error } = await supabase
      .from("bitscale_inbox")
      .select("batch, received_at")
      .order("received_at", { ascending: false })
      .range(0, 9999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const groups = new Map<string, { count: number; last: string }>();
    for (const r of data ?? []) {
      const g = groups.get(r.batch) ?? { count: 0, last: r.received_at };
      g.count += 1;
      if (r.received_at > g.last) g.last = r.received_at;
      groups.set(r.batch, g);
    }
    const batches = Array.from(groups.entries())
      .map(([name, g]) => ({ batch: name, count: g.count, last_received_at: g.last }))
      .sort((a, b) => (a.last_received_at < b.last_received_at ? 1 : -1));
    return NextResponse.json({ batches });
  }

  const { data, error } = await supabase
    .from("bitscale_inbox")
    .select(ROW_COLS.join(","))
    .eq("batch", batch)
    .order("received_at", { ascending: true })
    .range(0, 49999);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Record<string, string | null>[];
  const csv = Papa.unparse({
    fields: [...ROW_COLS],
    data: rows.map((r) => ROW_COLS.map((c) => r[c] ?? "")),
  });
  return NextResponse.json({ batch, count: rows.length, csv });
}

/** DELETE /api/bitscale/inbox?batch=NAME → clear a batch after it's been used. */
export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batch = new URL(request.url).searchParams.get("batch");
  if (!batch) {
    return NextResponse.json({ error: "Missing batch" }, { status: 400 });
  }
  const { error } = await supabase
    .from("bitscale_inbox")
    .delete()
    .eq("batch", batch);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
