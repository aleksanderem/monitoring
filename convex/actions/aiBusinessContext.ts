"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { callAI, getAIConfigFromAction } from "./aiProvider";
import { fetchPageContent } from "./scrapeHomepage";

/**
 * Generate business description and target customer persona by scraping
 * the domain's homepage and passing the content through AI.
 */
export const generateBusinessContext = action({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args): Promise<{
    businessDescription: string;
    targetCustomer: string;
    scraped: boolean;
  }> => {
    // 1. Get domain info
    const domain = await ctx.runQuery(internal.domains.getDomainInternal, {
      domainId: args.domainId,
    });
    if (!domain) {
      return { businessDescription: "", targetCustomer: "", scraped: false };
    }

    // 2. Scrape homepage content
    let pageContent: string | null = null;
    try {
      pageContent = await fetchPageContent(domain.domain);
    } catch (error) {
      console.warn("[BusinessContext] Failed to scrape homepage:", error);
    }

    // Log content parsing API usage
    if (pageContent) {
      await ctx.runMutation(internal.apiUsage.logApiUsage, {
        endpoint: "/on_page/content_parsing/live",
        taskCount: 1,
        estimatedCost: 0.001,
        caller: "aiBusinessContext",
        domainId: args.domainId,
      });
    }

    // 3. Resolve AI provider config
    const aiConfig = await getAIConfigFromAction(ctx, args.domainId);

    // 4. Determine target language from domain settings
    const LANGUAGE_NAMES: Record<string, string> = {
      en: "English", pl: "Polish", de: "German", fr: "French",
      es: "Spanish", it: "Italian", nl: "Dutch", pt: "Portuguese",
      cs: "Czech", sk: "Slovak", sv: "Swedish", da: "Danish",
      no: "Norwegian", fi: "Finnish", hu: "Hungarian", ro: "Romanian",
      bg: "Bulgarian", hr: "Croatian", sl: "Slovenian", lt: "Lithuanian",
      lv: "Latvian", et: "Estonian", uk: "Ukrainian", ru: "Russian",
      ja: "Japanese", ko: "Korean", zh: "Chinese", ar: "Arabic",
      tr: "Turkish", th: "Thai", vi: "Vietnamese",
    };
    const targetLanguage = LANGUAGE_NAMES[domain.settings.language?.toLowerCase() ?? "en"] || "English";

    // 5. Build prompt
    const contentSection = pageContent
      ? `=== WEBSITE CONTENT (${domain.domain}) ===\n${pageContent}\n\n=== TASK ===\nBased on the website content above, provide:`
      : `=== DOMAIN ===\n${domain.domain}\n\n=== TASK ===\nBased on the domain name above (the website content could not be scraped), infer what this business likely does and provide:`;

    const prompt = `Analyze the following and generate a business context summary.

${contentSection}

1. A concise business description (2-3 sentences) explaining what this business does, what products/services it offers, and what makes it unique.

2. A target customer/persona description (1-2 sentences) describing who the ideal customer is — their role, needs, and what they're looking for.

IMPORTANT: Write your response in ${targetLanguage}.

Return ONLY a JSON object, no markdown, no code fences:
{"businessDescription":"...","targetCustomer":"..."}`;

    // 6. Call AI
    try {
      const aiResult = await callAI({
        provider: aiConfig.provider,
        model: aiConfig.model,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 1024,
        temperature: 0.3,
      });

      const responseText = aiResult.text;

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("[BusinessContext] Failed to parse AI response — no JSON found");
        return { businessDescription: "", targetCustomer: "", scraped: true };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        businessDescription: parsed.businessDescription || "",
        targetCustomer: parsed.targetCustomer || "",
        scraped: true,
      };
    } catch (error) {
      console.warn("[BusinessContext] AI generation failed:", error);
      return { businessDescription: "", targetCustomer: "", scraped: true };
    }
  },
});
