"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import Anthropic from "@anthropic-ai/sdk";

const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  pl: "Polish",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  nl: "Dutch",
  pt: "Portuguese",
  cs: "Czech",
  sk: "Slovak",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  fi: "Finnish",
  hu: "Hungarian",
  ro: "Romanian",
  bg: "Bulgarian",
  hr: "Croatian",
  sl: "Slovenian",
  lt: "Lithuanian",
  lv: "Latvian",
  et: "Estonian",
  uk: "Ukrainian",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  tr: "Turkish",
  th: "Thai",
  vi: "Vietnamese",
};

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] || code;
}

export interface AIKeywordIdea {
  keyword: string;
  searchIntent: "informational" | "commercial" | "transactional" | "navigational";
  relevanceScore: number;
  rationale: string;
  category: string;
  // Enriched from DataForSEO
  searchVolume: number;
  cpc: number;
  competition: number;
  difficulty: number;
}

/**
 * Fetch homepage text content via DataForSEO Content Parsing API.
 * Returns plain text summary (truncated to ~3000 chars for prompt context).
 */
async function fetchPageContent(domain: string): Promise<string | null> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;

  try {
    const auth = Buffer.from(`${login}:${password}`).toString("base64");
    const response = await fetch(`${DATAFORSEO_API_URL}/on_page/content_parsing/live`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ url: `https://${domain}` }]),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.tasks?.[0]?.result?.[0];
    if (!result) return null;

    // Collect text from primary content sections
    const texts: string[] = [];

    const extractTexts = (sections: any) => {
      if (!sections) return;
      for (const section of Array.isArray(sections) ? sections : [sections]) {
        if (section?.primary_content) {
          for (const item of section.primary_content) {
            if (item?.text) texts.push(item.text);
          }
        }
        if (section?.secondary_content) {
          for (const item of section.secondary_content) {
            if (item?.text) texts.push(item.text);
          }
        }
      }
    };

    const pageContent = result.page_content;
    if (pageContent) {
      extractTexts(pageContent.header);
      extractTexts(pageContent.main_topic);
      extractTexts(pageContent.secondary_topic);
    }

    const fullText = texts.join("\n").trim();
    // Truncate to ~3000 chars to keep prompt manageable
    return fullText.length > 3000 ? fullText.slice(0, 3000) + "..." : fullText;
  } catch (error) {
    console.warn("Content parsing failed:", error);
    return null;
  }
}

// Helper: log an API step if debug logging is enabled
async function logStep(
  ctx: any,
  debugEnabled: boolean,
  domainId: any,
  step: string,
  requestData: unknown,
  fn: () => Promise<any>,
): Promise<any> {
  const start = Date.now();
  try {
    const result = await fn();
    if (debugEnabled) {
      await ctx.runMutation(internal.debugLog.saveLog, {
        domainId,
        action: "ai_research",
        step,
        request: JSON.stringify(requestData),
        response: JSON.stringify(result),
        durationMs: Date.now() - start,
        status: "success" as const,
      });
    }
    return result;
  } catch (error) {
    if (debugEnabled) {
      await ctx.runMutation(internal.debugLog.saveLog, {
        domainId,
        action: "ai_research",
        step,
        request: JSON.stringify(requestData),
        response: "",
        durationMs: Date.now() - start,
        status: "error" as const,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

export const generateKeywordIdeas = action({
  args: {
    domainId: v.id("domains"),
    businessDescription: v.string(),
    targetCustomer: v.string(),
    keywordCount: v.number(),
    focusType: v.union(
      v.literal("all"),
      v.literal("informational"),
      v.literal("commercial"),
      v.literal("transactional")
    ),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    keywords?: AIKeywordIdea[];
    error?: string;
    dataSources?: { pageContent: boolean; dataforseoKeywords: number; discoveredKeywords: number; monitoredKeywords: number };
  }> => {
    // 0. Check if debug logging is enabled
    const debugEnabled = await ctx.runQuery(internal.debugLog.isEnabled, {});

    // 1. Get domain settings
    const domain = await ctx.runQuery(internal.domains.getDomainInternal, {
      domainId: args.domainId,
    });
    if (!domain) {
      return { success: false, error: "Domain not found" };
    }

    // 2. Validate Anthropic API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "ANTHROPIC_API_KEY is not configured. Add it to your Convex environment variables.",
      };
    }

    // 3. Gather data in parallel: page content, DataForSEO suggestions, existing keywords
    console.log(`[AI Research] Starting data gathering for ${domain.domain}...`);

    const visibilityParams = {
      domain: domain.domain,
      location: domain.settings.location,
      language: domain.settings.language,
      limit: 200,
    };

    const [pageContent, dataforseoResult, discoveredKeywords, monitoredKeywords] = await Promise.all([
      // 3a. Fetch homepage text
      logStep(ctx, debugEnabled, args.domainId, "content_parsing",
        { url: `https://${domain.domain}` },
        () => fetchPageContent(domain.domain)),

      // 3b. Fetch DataForSEO keyword suggestions (ranked + Google Ads)
      logStep(ctx, debugEnabled, args.domainId, "dataforseo_visibility",
        visibilityParams,
        () => ctx.runAction(api.dataforseo.fetchDomainVisibility, visibilityParams))
        .catch(() => ({ success: false as const, keywords: [] as any[], totalFound: 0 })),

      // 3c. Already-discovered keywords
      ctx.runQuery(internal.domains.getDiscoveredKeywordsInternal, {
        domainId: args.domainId,
        limit: 200,
      }),

      // 3d. Already-monitored keywords
      ctx.runQuery(internal.domains.getMonitoredKeywordsInternal, {
        domainId: args.domainId,
      }),
    ]);

    // Log content parsing API usage (if page content was fetched)
    if (pageContent) {
      await ctx.runMutation(internal.apiUsage.logApiUsage, {
        endpoint: "/on_page/content_parsing/live",
        taskCount: 1,
        estimatedCost: 0.001,
        caller: "aiKeywordResearch",
        domainId: args.domainId,
      });
    }

    const dfKeywords = dataforseoResult.success && dataforseoResult.keywords
      ? dataforseoResult.keywords
      : [];

    console.log(`[AI Research] Data gathered: pageContent=${!!pageContent}, dfKeywords=${dfKeywords.length}, discovered=${discoveredKeywords.length}, monitored=${monitoredKeywords.length}`);

    // 4. Build context blocks for AI prompt
    const targetLanguage = getLanguageName(domain.settings.language);
    const location = domain.settings.location;

    let focusInstruction: string;
    switch (args.focusType) {
      case "informational":
        focusInstruction = "Focus ONLY on informational keywords (how-to, guides, what-is, tutorials, educational content).";
        break;
      case "commercial":
        focusInstruction = "Focus ONLY on commercial investigation keywords (best, top, reviews, comparisons, alternatives).";
        break;
      case "transactional":
        focusInstruction = "Focus ONLY on transactional keywords (buy, price, order, discount, deals, near me).";
        break;
      default:
        focusInstruction = "Include a diverse mix of search intents: informational (40%), commercial (30%), and transactional (30%).";
    }

    // DataForSEO keyword summary: top keywords with metrics
    const dfKeywordSummary = dfKeywords
      .slice(0, 100)
      .map((k: any) => {
        const parts = [k.keyword];
        if (k.position) parts.push(`pos:${k.position}`);
        if (k.searchVolume) parts.push(`vol:${k.searchVolume}`);
        if (k.intent) parts.push(`intent:${k.intent}`);
        if (k.cpc) parts.push(`cpc:${k.cpc}`);
        return parts.join(" | ");
      })
      .join("\n");

    // Discovered keywords summary
    const discoveredSummary = discoveredKeywords
      .slice(0, 80)
      .map((k) => {
        const parts = [k.keyword];
        if (k.bestPosition) parts.push(`pos:${k.bestPosition}`);
        if (k.searchVolume) parts.push(`vol:${k.searchVolume}`);
        if (k.intent) parts.push(`intent:${k.intent}`);
        return parts.join(" | ");
      })
      .join("\n");

    // Already-monitored keywords (to avoid suggesting duplicates)
    const monitoredPhrases = monitoredKeywords.map((k) => k.phrase);
    const monitoredList = monitoredPhrases.join(", ");

    // 5. Build the comprehensive prompt
    const prompt = `You are a senior SEO strategist. Analyze all the data below and generate a strategic keyword plan of exactly ${args.keywordCount} NEW keyword ideas.

=== DOMAIN ===
Domain: ${domain.domain}
Market: ${location}
Language: ${targetLanguage} (ALL keywords MUST be in ${targetLanguage})

=== USER CONTEXT ===
Business Description: ${args.businessDescription}
Target Customer: ${args.targetCustomer}

${pageContent ? `=== WEBSITE CONTENT (homepage text) ===\n${pageContent}\n` : ""}
${dfKeywordSummary ? `=== DATAFORSEO KEYWORD DATA (keywords this domain ranks for or is associated with) ===\n${dfKeywordSummary}\n` : ""}
${discoveredSummary ? `=== DISCOVERED KEYWORDS (already found ranking) ===\n${discoveredSummary}\n` : ""}
${monitoredList ? `=== ALREADY MONITORED (DO NOT suggest these) ===\n${monitoredList}\n` : ""}

=== TASK ===
Based on ALL the data above — the website content, existing keyword profile, discovered rankings, business description, and customer profile — generate ${args.keywordCount} NEW keyword opportunities.

RULES:
1. ALL keywords MUST be in ${targetLanguage}
2. ${focusInstruction}
3. DO NOT repeat any keyword from the "ALREADY MONITORED" list
4. Include a strategic mix: head terms (1-2 words), mid-tail (2-3 words), and long-tail (4+ words)
5. Assign a category to each keyword (e.g., "product", "service", "educational", "local", "comparison", "how-to", "pricing", etc.)
6. Rate relevance 1-10 based on alignment with the business, customer profile, and existing keyword profile
7. Prioritize keywords that fill GAPS in the existing keyword profile — topics the site should rank for but doesn't yet
8. Provide a brief strategic rationale for each keyword

Return ONLY a JSON array, no markdown, no code fences:
[{"keyword":"...","searchIntent":"informational|commercial|transactional|navigational","relevanceScore":8,"rationale":"...","category":"..."}]`;

    // 6. Call Claude API
    let aiKeywords: Array<{
      keyword: string;
      searchIntent: string;
      relevanceScore: number;
      rationale: string;
      category: string;
    }>;

    try {
      const claudeRequestParams = {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        promptLength: prompt.length,
        domain: domain.domain,
        location,
        language: targetLanguage,
        keywordCount: args.keywordCount,
        focusType: args.focusType,
      };

      const client = new Anthropic({ apiKey });
      const start = Date.now();

      const message = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });

      const responseText = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      if (debugEnabled) {
        await ctx.runMutation(internal.debugLog.saveLog, {
          domainId: args.domainId,
          action: "ai_research",
          step: "claude_api",
          request: JSON.stringify(claudeRequestParams),
          response: JSON.stringify({
            usage: message.usage,
            stopReason: message.stop_reason,
            responseLength: responseText.length,
            responsePreview: responseText.slice(0, 500),
          }),
          durationMs: Date.now() - start,
          status: "success" as const,
        });
      }

      // Extract JSON array — handle potential markdown code fences
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return { success: false, error: "Failed to parse AI response — no JSON array found" };
      }

      aiKeywords = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(aiKeywords) || aiKeywords.length === 0) {
        return { success: false, error: "AI returned empty or invalid keyword list" };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error calling Claude API";
      if (debugEnabled) {
        await ctx.runMutation(internal.debugLog.saveLog, {
          domainId: args.domainId,
          action: "ai_research",
          step: "claude_api",
          request: JSON.stringify({ domain: domain.domain, location, language: targetLanguage }),
          response: "",
          durationMs: 0,
          status: "error" as const,
          error: msg,
        });
      }
      return { success: false, error: `AI generation failed: ${msg}` };
    }

    // 7. Filter out any keywords that are already monitored (safety check)
    const monitoredSet = new Set(monitoredPhrases.map((p) => p.toLowerCase()));
    aiKeywords = aiKeywords.filter((k) => !monitoredSet.has(k.keyword.toLowerCase()));

    // 8. Enrich with DataForSEO metrics (search volume, CPC, difficulty)
    const keywordPhrases = aiKeywords.map((k) => k.keyword);

    const enrichmentMap = new Map<string, { searchVolume: number; cpc: number; competition: number; difficulty: number }>();

    const enrichParams = {
      keywords: keywordPhrases,
      location: domain.settings.location,
      language: domain.settings.language,
    };

    try {
      const enrichResult = await logStep(ctx, debugEnabled, args.domainId, "dataforseo_enrichment",
        { ...enrichParams, keywordsCount: keywordPhrases.length, keywordsPreview: keywordPhrases.slice(0, 5) },
        () => ctx.runAction(api.dataforseo.fetchKeywordData, enrichParams));

      if (enrichResult.success && enrichResult.data) {
        for (const item of enrichResult.data) {
          enrichmentMap.set(item.keyword.toLowerCase(), {
            searchVolume: item.searchVolume ?? 0,
            cpc: item.cpc ?? 0,
            competition: item.competition ?? 0,
            difficulty: item.difficulty ?? 0,
          });
        }
      }
    } catch (error) {
      console.warn("DataForSEO enrichment failed, returning keywords without metrics:", error);
    }

    // 9. Merge and sort
    const enrichedKeywords: AIKeywordIdea[] = aiKeywords.map((k) => {
      const metrics = enrichmentMap.get(k.keyword.toLowerCase()) || {
        searchVolume: 0,
        cpc: 0,
        competition: 0,
        difficulty: 0,
      };
      return {
        keyword: k.keyword,
        searchIntent: k.searchIntent as AIKeywordIdea["searchIntent"],
        relevanceScore: k.relevanceScore,
        rationale: k.rationale,
        category: k.category || "general",
        ...metrics,
      };
    });

    // Sort: by search volume desc, then relevance desc
    enrichedKeywords.sort((a, b) => {
      if (b.searchVolume !== a.searchVolume) return b.searchVolume - a.searchVolume;
      return b.relevanceScore - a.relevanceScore;
    });

    // 10. Persist session to history
    try {
      await ctx.runMutation(internal.aiResearch.saveSession, {
        domainId: args.domainId,
        businessDescription: args.businessDescription,
        targetCustomer: args.targetCustomer,
        keywordCount: args.keywordCount,
        focusType: args.focusType,
        keywords: enrichedKeywords,
      });
    } catch (err) {
      console.warn("Failed to save AI research session:", err);
    }

    return {
      success: true,
      keywords: enrichedKeywords,
      dataSources: {
        pageContent: !!pageContent,
        dataforseoKeywords: dfKeywords.length,
        discoveredKeywords: discoveredKeywords.length,
        monitoredKeywords: monitoredKeywords.length,
      },
    };
  },
});
