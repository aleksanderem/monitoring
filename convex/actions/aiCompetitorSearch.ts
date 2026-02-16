"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { callAI, getAIConfigFromAction } from "./aiProvider";

/**
 * Blocklist of generic platform domains that should never appear as competitor suggestions.
 */
const BLOCKED_DOMAINS = new Set([
  "facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com",
  "linkedin.com", "pinterest.com", "reddit.com", "tumblr.com", "snapchat.com",
  "threads.net", "mastodon.social",
  "youtube.com", "vimeo.com", "dailymotion.com", "twitch.tv",
  "amazon.com", "amazon.de", "amazon.co.uk", "amazon.fr", "amazon.es",
  "amazon.it", "amazon.pl", "amazon.nl", "amazon.se", "amazon.com.au",
  "ebay.com", "ebay.de", "ebay.co.uk", "ebay.fr", "ebay.pl",
  "aliexpress.com", "alibaba.com", "etsy.com", "allegro.pl",
  "walmart.com", "target.com", "temu.com", "shein.com",
  "google.com", "bing.com", "yahoo.com", "duckduckgo.com",
  "yandex.com", "yandex.ru", "baidu.com",
  "wikipedia.org", "en.wikipedia.org", "pl.wikipedia.org", "de.wikipedia.org",
  "quora.com", "medium.com", "blogspot.com", "wordpress.com", "wix.com",
  "github.com", "stackoverflow.com", "stackexchange.com",
  "yelp.com", "tripadvisor.com", "booking.com",
  "news.google.com", "apple.news",
]);

function isBlocked(domain: string): boolean {
  const d = domain.toLowerCase();
  if (BLOCKED_DOMAINS.has(d)) return true;
  for (const blocked of BLOCKED_DOMAINS) {
    if (d.endsWith("." + blocked)) return true;
  }
  return false;
}

export interface AICompetitorSuggestion {
  domain: string;
  reason: string;
  similarity: number; // 1-10
}

/**
 * Use AI to find competitor websites based on business context and location.
 * Works well for niche sites with low SERP visibility.
 */
export const searchCompetitorsWithAI = action({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    competitors?: AICompetitorSuggestion[];
    error?: string;
  }> => {
    // 1. Get domain info
    const domain = await ctx.runQuery(internal.domains.getDomainInternal, {
      domainId: args.domainId,
    });
    if (!domain) {
      return { success: false, error: "Domain not found" };
    }

    // 2. Get existing competitors to exclude
    const existingCompetitors = await ctx.runQuery(
      internal.competitors.getCompetitorDomainsForDomain,
      { domainId: args.domainId }
    );
    const excludeDomains = new Set([
      domain.domain,
      ...(existingCompetitors || []),
    ]);

    // 3. Resolve AI config
    const aiConfig = await getAIConfigFromAction(ctx, args.domainId);

    // 4. Build prompt with business context
    const LANGUAGE_NAMES: Record<string, string> = {
      en: "English", pl: "Polish", de: "German", fr: "French",
      es: "Spanish", it: "Italian", nl: "Dutch", pt: "Portuguese",
      cs: "Czech", sk: "Slovak",
    };
    const targetLanguage = LANGUAGE_NAMES[domain.settings.language?.toLowerCase() ?? "en"] || "English";
    const location = domain.settings.location || "Global";

    const businessContext = domain.businessDescription
      ? `Business: ${domain.businessDescription}\nTarget customer: ${domain.targetCustomer || "not specified"}`
      : `Domain: ${domain.domain} (no business description available, infer from domain name)`;

    const excludeList = Array.from(excludeDomains).join(", ");

    const prompt = `You are an SEO competitor research expert. Find real competitor websites for the following business.

=== BUSINESS CONTEXT ===
${businessContext}
Website: ${domain.domain}
Location/Market: ${location}

=== EXCLUDED DOMAINS (do not suggest these) ===
${excludeList}

=== BLOCKED CATEGORIES (never suggest) ===
Social media (facebook, instagram, tiktok, twitter, linkedin, etc.)
Marketplaces (amazon, ebay, aliexpress, allegro, etsy, etc.)
Search engines (google, bing, yahoo, etc.)
Generic platforms (wikipedia, reddit, quora, medium, etc.)
Video platforms (youtube, vimeo, twitch, etc.)

=== TASK ===
Find 10-15 REAL competitor websites that:
1. Operate in the same niche/industry as ${domain.domain}
2. Target similar customers in ${location}
3. Are actual business websites (not platforms, aggregators, or social media)
4. Have their own domain (not subdomains of large platforms)

For each competitor, provide:
- domain: the exact domain name (e.g., "example.com")
- reason: one sentence explaining why this is a competitor (in ${targetLanguage})
- similarity: score from 1-10 (10 = direct competitor, 1 = tangentially related)

IMPORTANT:
- Only suggest domains you are confident actually exist
- Prefer businesses operating in the same geographic market (${location})
- Include both direct competitors and indirect/adjacent competitors
- Write reasons in ${targetLanguage}

Return ONLY a JSON array, no markdown, no code fences:
[{"domain":"example.com","reason":"...","similarity":8}]`;

    // 5. Call AI
    try {
      const aiResult = await callAI({
        provider: aiConfig.provider,
        model: aiConfig.model,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 2048,
        temperature: 0.4,
      });

      const responseText = aiResult.text;

      // Parse JSON array
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn("[AICompetitorSearch] No JSON array found in response");
        return { success: false, error: "Failed to parse AI response" };
      }

      const parsed: AICompetitorSuggestion[] = JSON.parse(jsonMatch[0]);

      // Filter out blocked and excluded domains
      const filtered = parsed.filter((c) => {
        const d = c.domain?.toLowerCase().replace(/^www\./, "");
        if (!d) return false;
        if (excludeDomains.has(d)) return false;
        if (isBlocked(d)) return false;
        return true;
      }).map((c) => ({
        domain: c.domain.toLowerCase().replace(/^www\./, ""),
        reason: c.reason || "",
        similarity: Math.min(10, Math.max(1, Math.round(c.similarity || 5))),
      }));

      // Deduplicate by domain
      const seen = new Set<string>();
      const unique = filtered.filter((c) => {
        if (seen.has(c.domain)) return false;
        seen.add(c.domain);
        return true;
      });

      return {
        success: true,
        competitors: unique.sort((a, b) => b.similarity - a.similarity),
      };
    } catch (error) {
      console.error("[AICompetitorSearch] AI call failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "AI generation failed",
      };
    }
  },
});
