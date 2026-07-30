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
  // Build the PUBLIC origin from proxy headers. Behind Railway, request.url
  // reflects the internal bind address (localhost:PORT) — using it produces a
  // private-IP webhook URL that Bitscale rejects ("access to private IP
  // addresses is not allowed"). Prefer x-forwarded-host / -proto.
  const reqUrl = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto") ?? reqUrl.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    reqUrl.host;
  const origin = `${proto}://${host}`;

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
