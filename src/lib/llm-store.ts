"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type LlmProvider,
  providerDefaultModel,
} from "@/lib/llm-config";

type LlmStore = {
  /** Per-provider BYOK keys — both stay resident so switching is instant. */
  keys: Record<LlmProvider, string | null>;
  /** The active provider used for new runs / chat turns. */
  provider: LlmProvider;
  /** The active model id (provider-specific). Null = provider default. */
  model: string | null;

  setKey: (provider: LlmProvider, key: string) => void;
  clearKey: (provider: LlmProvider) => void;
  setProvider: (provider: LlmProvider) => void;
  setModel: (model: string | null) => void;
};

/**
 * BYOK store for the LLM providers (Groq + Together.ai).
 *
 * - Lives in memory for fast reads.
 * - Mirrored to sessionStorage so a refresh within the same tab keeps the
 *   user connected; tab close wipes it.
 * - NEVER persisted to localStorage, cookies, or our own backend.
 *
 * Both provider keys are kept at once — the `provider` field just chooses
 * which one is active, so flipping providers needs no reconnect.
 */
export const useLlmStore = create<LlmStore>()(
  persist(
    (set) => ({
      keys: { groq: null, together: null },
      provider: "groq",
      model: null,
      setKey: (provider, key) =>
        set((s) => ({ keys: { ...s.keys, [provider]: key } })),
      clearKey: (provider) =>
        set((s) => ({ keys: { ...s.keys, [provider]: null } })),
      setProvider: (provider) => set({ provider }),
      setModel: (model) => set({ model }),
    }),
    {
      name: "qualifier.llm-byok",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (undefined as unknown as Storage)
          : window.sessionStorage
      ),
    }
  )
);

/** The key for the currently-active provider (may be null if not connected). */
export function useActiveLlmKey(): string | null {
  return useLlmStore((s) => s.keys[s.provider]);
}

/** The active model id, falling back to the active provider's default. */
export function useActiveLlmModel(): string {
  return useLlmStore((s) => s.model ?? providerDefaultModel(s.provider));
}

export {
  PROVIDERS,
  LLM_PROVIDERS,
  providerDefaultModel,
  type LlmProvider,
} from "@/lib/llm-config";
