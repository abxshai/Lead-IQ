// Plain constants — safe to import from both server and client code.
// Keep this file free of "use client" or server-only imports.
//
// Central registry of the LLM providers Lead-IQ can talk to. Both are
// OpenAI-compatible, so the only per-provider differences are the base URL,
// the key prefix (used for light client-side validation) and the label.

export type LlmProvider = "groq" | "together";

export type ProviderConfig = {
  label: string;
  baseURL: string;
  /** Expected API-key prefix, or null if the provider doesn't use one. */
  keyPrefix: string | null;
  /** A sensible default model id (both providers host gpt-oss-120b). */
  defaultModel: string;
};

export const PROVIDERS: Record<LlmProvider, ProviderConfig> = {
  groq: {
    label: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    keyPrefix: "gsk_",
    defaultModel: "openai/gpt-oss-120b",
  },
  together: {
    label: "Together.ai",
    baseURL: "https://api.together.ai/v1",
    keyPrefix: null,
    defaultModel: "openai/gpt-oss-120b",
  },
};

export const LLM_PROVIDERS = Object.keys(PROVIDERS) as LlmProvider[];

export function isLlmProvider(v: unknown): v is LlmProvider {
  return typeof v === "string" && v in PROVIDERS;
}

/** Normalize an untrusted value to a valid provider, falling back to groq. */
export function coerceProvider(v: unknown): LlmProvider {
  return isLlmProvider(v) ? v : "groq";
}

export function providerBaseURL(p: LlmProvider): string {
  return PROVIDERS[p].baseURL;
}

export function providerDefaultModel(p: LlmProvider): string {
  return PROVIDERS[p].defaultModel;
}

// --- Back-compat re-exports (older imports referenced these directly) -------
export const GROQ_BASE_URL = PROVIDERS.groq.baseURL;
export const GROQ_MODEL = PROVIDERS.groq.defaultModel;
