"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { callAI, getAIConfigFromAction } from "./aiProvider";

export const generateLlmsTxt = action({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; outputIdShort?: Id<"generatorOutputs">; outputIdFull?: Id<"generatorOutputs">; shortSections?: string[]; fullSections?: string[]; error?: string }> => {
    const startTime = Date.now();

    // 1. Create two pending records (llmsTxt + llmsFullTxt)
    const outputIdShort: Id<"generatorOutputs"> = await ctx.runMutation(
      api.generators.createGeneratorOutput,
      { domainId: args.domainId, type: "llmsTxt" }
    );
    const outputIdFull: Id<"generatorOutputs"> = await ctx.runMutation(
      api.generators.createGeneratorOutput,
      { domainId: args.domainId, type: "llmsFullTxt" }
    );

    // 2. Mark both as generating
    await Promise.all([
      ctx.runMutation(internal.generators.updateGeneratorStatus, {
        outputId: outputIdShort,
        status: "generating",
      }),
      ctx.runMutation(internal.generators.updateGeneratorStatus, {
        outputId: outputIdFull,
        status: "generating",
      }),
    ]);

    try {
      // 3. Get AI config
      const aiConfig = await getAIConfigFromAction(ctx, args.domainId);

      // 4. Gather data in parallel
      const [domain, pages, sitemapUrls, topKeywords] = await Promise.all([
        ctx.runQuery(internal.domains.getDomainInternal, {
          domainId: args.domainId,
        }),
        ctx.runQuery(internal.generators.getOnsitePagesInternal, {
          domainId: args.domainId,
          limit: 100,
        }),
        ctx.runQuery(internal.generators.getSitemapUrlsInternal, {
          domainId: args.domainId,
        }),
        ctx.runQuery(internal.generators.getTopKeywordsInternal, {
          domainId: args.domainId,
          limit: 50,
        }),
      ]);

      if (!domain) throw new Error("Domain not found");

      // 5. Build page data for prompt
      const pageData = pages.map((p: any) => {
        const headings = p.htags
          ? [
              ...(p.htags.h1 || []).map((h: string) => `H1: ${h}`),
              ...(p.htags.h2 || []).map((h: string) => `H2: ${h}`),
            ].join("; ")
          : "";
        return `URL: ${p.url} | Title: ${p.title || "N/A"} | Meta: ${p.metaDescription || "N/A"} | Headings: ${headings} | Words: ${p.wordCount}`;
      });

      // 6. Build keyword context
      const keywordContext = topKeywords
        .map((k: any) => `"${k.keyword}" (pos: ${k.position}) → ${k.url || "N/A"}`)
        .join("\n");

      // 7. Build prompt
      const prompt = `You are an SEO and AI specialist. Generate llms.txt and llms-full.txt files for a website following the llmstxt.org specification.

=== WEBSITE INFO ===
Domain: ${domain.domain}
Business: ${(domain as any).businessDescription || "Not provided"}
Target Customer: ${(domain as any).targetCustomer || "Not provided"}

=== SITEMAP (${sitemapUrls.length} URLs) ===
${sitemapUrls.slice(0, 200).join("\n")}

=== CRAWLED PAGES (${pages.length} pages) ===
${pageData.join("\n")}

=== TOP KEYWORDS (${topKeywords.length}) ===
${keywordContext}

=== INSTRUCTIONS ===
Generate TWO files following the llmstxt.org specification:

FILE 1: llms.txt (concise version)
- H1: Site name
- Blockquote: 1-2 sentence description
- H2 sections grouping pages logically (e.g., ## Docs, ## Blog, ## Products, ## Services, ## About)
- Each page: "- [Title](URL): One sentence description"
- Include an ## Optional section for less important pages
- Keep descriptions brief (max 15 words each)

FILE 2: llms-full.txt (expanded version)
- Same structure but:
  - Fuller descriptions (2-3 sentences per page)
  - Add summary paragraph under each H2 before the list
  - Add ## FAQ section with 5-10 AI-generated Q&A pairs based on the content
  - Add ## Key Topics section listing main topics covered
  - Include all pages from Optional with full descriptions

IMPORTANT: Respond with a JSON object with two keys:
{
  "llmsTxt": "full content of llms.txt here",
  "llmsFullTxt": "full content of llms-full.txt here"
}

No markdown fencing around the JSON. Just the raw JSON object.`;

      // 8. Call AI
      const result = await callAI({
        provider: aiConfig.provider,
        model: aiConfig.model,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 12000,
        temperature: 0.4,
      });

      // 9. Parse response — robust extraction
      let parsed: { llmsTxt: string; llmsFullTxt: string };
      try {
        let text = result.text.trim();

        // Strip ALL markdown fencing variants
        text = text.replace(/^```(?:json|jsonld|javascript)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "");
        text = text.trim();

        // Try direct parse first
        try {
          parsed = JSON.parse(text);
        } catch {
          // Fallback: extract JSON object from surrounding text
          const objMatch = text.match(/\{[\s\S]*\}/);
          if (objMatch) {
            parsed = JSON.parse(objMatch[0]);
          } else {
            throw new Error("No JSON object found in AI response");
          }
        }

        if (!parsed.llmsTxt || !parsed.llmsFullTxt) {
          throw new Error("Missing llmsTxt or llmsFullTxt in response");
        }
      } catch (parseError: any) {
        // Save raw response for debugging
        const errorMsg = `JSON parse error: ${parseError.message}\n\nRaw AI response (first 500 chars):\n${result.text.slice(0, 500)}`;
        await Promise.all([
          ctx.runMutation(internal.generators.updateGeneratorStatus, {
            outputId: outputIdShort,
            status: "failed",
            error: errorMsg,
          }),
          ctx.runMutation(internal.generators.updateGeneratorStatus, {
            outputId: outputIdFull,
            status: "failed",
            error: errorMsg,
          }),
        ]);
        return { success: false, error: parseError.message };
      }

      // 10. Count sections in each file
      const countSections = (txt: string) =>
        (txt.match(/^## .+$/gm) || []).map((s) => s.replace("## ", ""));

      const generationTimeMs = Date.now() - startTime;
      const shortSections = countSections(parsed.llmsTxt);
      const fullSections = countSections(parsed.llmsFullTxt);

      // 11. Save both outputs
      await Promise.all([
        ctx.runMutation(internal.generators.updateGeneratorStatus, {
          outputId: outputIdShort,
          status: "completed",
          content: parsed.llmsTxt,
          metadata: {
            pagesAnalyzed: pages.length,
            sections: shortSections,
            generationTimeMs,
          },
        }),
        ctx.runMutation(internal.generators.updateGeneratorStatus, {
          outputId: outputIdFull,
          status: "completed",
          content: parsed.llmsFullTxt,
          metadata: {
            pagesAnalyzed: pages.length,
            sections: fullSections,
            generationTimeMs,
          },
        }),
      ]);

      return {
        success: true,
        outputIdShort,
        outputIdFull,
        shortSections,
        fullSections,
      };
    } catch (error: any) {
      await Promise.all([
        ctx.runMutation(internal.generators.updateGeneratorStatus, {
          outputId: outputIdShort,
          status: "failed",
          error: error.message,
        }),
        ctx.runMutation(internal.generators.updateGeneratorStatus, {
          outputId: outputIdFull,
          status: "failed",
          error: error.message,
        }),
      ]);
      return { success: false, error: error.message };
    }
  },
});
