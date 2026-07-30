import { NextResponse } from "next/server";
import { coerceProvider, providerBaseURL } from "@/lib/llm-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy to a provider's OpenAI-compatible `/models` endpoint.
 *
 * Used both to (a) populate the provider+model dropdowns and (b) validate a
 * pasted BYOK key in the connect dialog. Proxying (vs. calling the provider
 * from the browser) sidesteps CORS differences between Groq and Together and
 * keeps the key off any third-party origin the browser would otherwise hit.
 *
 * The key is read from the `x-llm-key` header, used once, and never persisted
 * or logged; it is scrubbed defensively from any error surfaced back.
 */
export async function GET(request: Request) {
  const key = request.headers.get("x-llm-key");
  const provider = coerceProvider(request.headers.get("x-llm-provider"));
  if (!key) {
    return NextResponse.json({ error: "Missing x-llm-key header" }, { status: 401 });
  }

  const scrub = (msg: string) => msg.split(key).join("<llm-key>");

  try {
    const res = await fetch(`${providerBaseURL(provider)}/models`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const status = res.status;
      return NextResponse.json(
        {
          error:
            status === 401
              ? "Key rejected by the provider."
              : `Provider returned ${status}.`,
        },
        { status: status === 401 ? 401 : 502 }
      );
    }
    const body = (await res.json()) as { data?: Array<{ id?: string }> };
    const models = (body.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ models });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not reach the provider. ${scrub(msg)}` },
      { status: 502 }
    );
  }
}
