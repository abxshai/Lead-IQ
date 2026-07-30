import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the Bitscale webhook URL (with the shared token) and a payload guide,
 * so a teammate can wire up a Webhook Action Column in Bitscale. Authenticated
 * only — the token is a shared secret and must not ship in the static bundle.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = process.env.BITSCALE_WEBHOOK_SECRET;
  const origin = new URL(request.url).origin;

  if (!secret) {
    return NextResponse.json({
      configured: false,
      url: null,
      message:
        "Set BITSCALE_WEBHOOK_SECRET in the deployment env to enable the Bitscale webhook.",
    });
  }

  return NextResponse.json({
    configured: true,
    url: `${origin}/api/bitscale/webhook?token=${secret}`,
    method: "POST",
    contentType: "application/json",
    // The keys a Bitscale Webhook Action Column should send per row. `batch`
    // groups the rows into one importable list; the rest map through the same
    // aliases as CSV upload (fullName / firstName+lastName / companyName /
    // title / linkedInUrl / email are all recognized).
    payloadExample: {
      batch: "{{grid name}}",
      full_name: "{{Full Name}}",
      company_name: "{{Company}}",
      title: "{{Job Title}}",
      default_profile_url: "{{LinkedIn URL}}",
      location: "{{Location}}",
      email: "{{Email}}",
    },
  });
}
