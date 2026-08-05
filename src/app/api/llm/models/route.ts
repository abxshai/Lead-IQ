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
    // Response shape differs by provider: OpenAI/Groq wrap the list in
    // `{ data: [...] }`, while Together returns a bare JSON array. Handle both
    // so the full catalogue shows for either provider.
    const body: unknown = await res.json();
    const list: unknown[] = Array.isArray(body)
      ? body
      : Array.isArray((body as { data?: unknown[] })?.data)
        ? (body as { data: unknown[] }).data
        : [];

    // Together's catalogue mixes SERVERLESS models (callable on-demand via the
    // API, priced per-token) with DEDICATED-only models (require a paid GPU
    // endpoint — calling one 400s "Unable to access non-serverless model …").
    // /v1/models has no serverless flag, but serverless models are priced
    // per-token (pricing.input/output > 0) while dedicated-only ones are
    // hourly-priced (token price 0). Keep only serverless CHAT models. Fall
    // back to the full list if nothing matches so the dropdown never empties.
    let entries = list;
    if (provider === "together") {
      const serverlessChat = list.filter((m) => {
        if (typeof m !== "object" || m === null) return false;
        const o = m as { type?: unknown; pricing?: Record<string, unknown> };
        const type = String(o.type ?? "").toLowerCase();
        const pricing = o.pricing ?? {};
        const tokenPriced =
          Number(pricing.input) > 0 || Number(pricing.output) > 0;
        return type === "chat" && tokenPriced;
      });
      if (serverlessChat.length > 0) entries = serverlessChat;
    }

    const models = entries
      .map((m) => (typeof m === "string" ? m : (m as { id?: unknown })?.id))
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
