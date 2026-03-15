// ============================================================
// AI Provider Abstraction
// Allows swapping between Claude, OpenAI, Gemini, Ollama
// Default: Claude via Agent SDK (only one currently implemented)
// ============================================================

export type ProviderName = "claude" | "openai" | "gemini" | "ollama";

export interface ProviderConfig {
  name: ProviderName;
  model: string;
  apiKey?: string;
  baseUrl?: string; // For Ollama or custom endpoints
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIProvider {
  name: ProviderName;
  complete(messages: ProviderMessage[]): Promise<ProviderResult>;
}

// ── Default Models ─────────────────────────────────────────

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  claude: "sonnet",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
  ollama: "llama3.1",
};

// ── Provider Factory ───────────────────────────────────────

export function getProviderConfig(name?: string): ProviderConfig {
  const providerName = (name || "claude") as ProviderName;

  return {
    name: providerName,
    model: DEFAULT_MODELS[providerName] || DEFAULT_MODELS.claude,
  };
}

/**
 * Multi-provider support is designed but only Claude is implemented.
 * This module provides the foundation for future providers.
 *
 * To add a new provider:
 * 1. Create a class implementing AIProvider
 * 2. Register it in the factory below
 * 3. The orchestrator and worker will use it automatically
 *
 * Note: The Agent SDK currently only supports Claude.
 * For other providers, we'll need to implement raw API calls.
 */
export function isProviderSupported(name: string): boolean {
  return name === "claude"; // Only Claude is implemented currently
}
