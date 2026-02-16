"use node";

import Anthropic from "@anthropic-ai/sdk";

// ─── Types ───

export interface AICallOptions {
  provider: "anthropic" | "google" | "zai";
  model: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens: number;
  temperature: number;
}

export interface AICallResult {
  text: string;
  stopReason?: string;
}

// ─── Default models per provider ───

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-5-20250929",
  google: "gemini-2.0-flash",
  zai: "glm-5.0",
};

export function getDefaultModel(provider: string): string {
  return DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.anthropic;
}

// ─── Provider Implementations ───

async function callAnthropic(options: AICallOptions): Promise<AICallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    messages: options.messages,
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return { text, stopReason: message.stop_reason ?? undefined };
}

async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  options: AICallOptions,
): Promise<AICallResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `AI provider returned ${response.status}: ${errorBody.slice(0, 500)}`,
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new Error("Unexpected response format from AI provider");
  }

  return { text, stopReason: data?.choices?.[0]?.finish_reason ?? undefined };
}

async function callZAI(options: AICallOptions): Promise<AICallResult> {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    throw new Error("ZAI_API_KEY is not configured");
  }

  const client = new Anthropic({
    apiKey,
    baseURL: "https://api.z.ai/api/anthropic",
  });
  const message = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    messages: options.messages,
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return { text, stopReason: message.stop_reason ?? undefined };
}

async function callGoogle(options: AICallOptions): Promise<AICallResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured");
  }

  return callOpenAICompatible(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiKey,
    options,
  );
}

// ─── Main Entry Point ───

export async function callAI(options: AICallOptions): Promise<AICallResult> {
  switch (options.provider) {
    case "anthropic":
      return callAnthropic(options);
    case "zai":
      return callZAI(options);
    case "google":
      return callGoogle(options);
    default:
      throw new Error(`Unknown AI provider: ${options.provider}`);
  }
}

// ─── Org Config Resolver (for use inside Convex actions) ───

export async function getAIConfigFromAction(
  ctx: any,
  domainId: string,
): Promise<{ provider: "anthropic" | "google" | "zai"; model: string }> {
  const { internal } = await import("../_generated/api");
  const aiSettings = await ctx.runQuery(internal.aiStrategy.getOrgAISettingsForDomain, { domainId });

  if (!aiSettings?.provider) {
    return { provider: "anthropic", model: DEFAULT_MODELS.anthropic };
  }

  const provider = aiSettings.provider as "anthropic" | "google" | "zai";
  const model = aiSettings.model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.anthropic;

  return { provider, model };
}
