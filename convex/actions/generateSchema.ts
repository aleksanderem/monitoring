"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { callAI, getAIConfigFromAction } from "./aiProvider";

export const generateJsonSchema = action({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; outputId?: Id<"generatorOutputs">; schemaTypes?: string[]; schemasGenerated?: number; error?: string }> => {
    const startTime = Date.now();

    // 1. Create pending record
    const outputId: Id<"generatorOutputs"> = await ctx.runMutation(api.generators.createGeneratorOutput, {
      domainId: args.domainId,
      type: "jsonSchema",
    });

    // 2. Update to generating
    await ctx.runMutation(internal.generators.updateGeneratorStatus, {
      outputId,
      status: "generating",
    });

    try {
      // 3. Get AI config
      const aiConfig = await getAIConfigFromAction(ctx, args.domainId);

      // 4. Gather data in parallel
      const [domain, pages, schemaValidation, sitemapUrls, topKeywords] =
        await Promise.all([
          ctx.runQuery(internal.domains.getDomainInternal, {
            domainId: args.domainId,
          }),
          ctx.runQuery(internal.generators.getOnsitePagesInternal, {
            domainId: args.domainId,
            limit: 25,
          }),
          ctx.runQuery(internal.generators.getSchemaValidationInternal, {
            domainId: args.domainId,
          }),
          ctx.runQuery(internal.generators.getSitemapUrlsInternal, {
            domainId: args.domainId,
          }),
          ctx.runQuery(internal.generators.getTopKeywordsInternal, {
            domainId: args.domainId,
            limit: 30,
          }),
        ]);

      if (!domain) {
        throw new Error("Domain not found");
      }

      // 5. Build existing schema types summary
      const existingSchemaTypes = new Map<string, number>();
      for (const sv of schemaValidation) {
        for (const t of sv.schemaTypes) {
          existingSchemaTypes.set(t, (existingSchemaTypes.get(t) || 0) + 1);
        }
      }

      // 6. Build keyword-to-URL mapping
      const keywordsByUrl = new Map<string, string[]>();
      for (const kw of topKeywords) {
        if (kw.url) {
          const existing = keywordsByUrl.get(kw.url) || [];
          existing.push(`${kw.keyword} (pos: ${kw.position})`);
          keywordsByUrl.set(kw.url, existing);
        }
      }

      // 7. Build page summaries for prompt
      const pageSummaries = pages.map((p: any) => {
        const keywords = keywordsByUrl.get(p.url) || [];
        const headings = p.htags
          ? [
              ...(p.htags.h1 || []).map((h: string) => `H1: ${h}`),
              ...(p.htags.h2 || []).map((h: string) => `H2: ${h}`),
              ...(p.htags.h3 || []).map((h: string) => `H3: ${h}`),
            ].join("; ")
          : "none";
        return `URL: ${p.url}\n  Title: ${p.title || "N/A"}\n  Meta: ${p.metaDescription || "N/A"}\n  H1: ${p.h1 || "N/A"}\n  Headings: ${headings}\n  Words: ${p.wordCount}\n  Keywords: ${keywords.length > 0 ? keywords.join(", ") : "none"}`;
      });

      // 8. Build prompt
      const prompt = `You are a senior SEO specialist. Generate schema.org JSON-LD structured data for a website.

=== WEBSITE INFO ===
Domain: ${domain.domain}
Business Description: ${(domain as any).businessDescription || "Not provided"}
Target Customer: ${(domain as any).targetCustomer || "Not provided"}

=== EXISTING SCHEMA TYPES ON SITE ===
${existingSchemaTypes.size > 0 ? Array.from(existingSchemaTypes.entries()).map(([t, c]) => `${t}: ${c} pages`).join("\n") : "None detected"}

=== SITEMAP URLS (${sitemapUrls.length} total) ===
${sitemapUrls.slice(0, 100).join("\n")}

=== TOP PAGES WITH SEO DATA (${pages.length} pages) ===
${pageSummaries.join("\n\n")}

=== INSTRUCTIONS ===
Generate schema.org JSON-LD for this website. For each page, auto-detect the most appropriate schema type based on URL path, title, headings, and content length.

Required outputs:
1. One WebSite schema for the homepage
2. One Organization or LocalBusiness schema (based on business description)
3. Per-page schemas — detect type: Article, Product, FAQ, HowTo, Service, Event, BlogPosting, ItemPage, CollectionPage, etc.
4. BreadcrumbList schemas derived from URL hierarchy
5. If FAQ patterns detected in headings (questions as H2/H3), generate FAQPage schema

For each JSON-LD object, include realistic property values derived from the page data (title, description, headings, keywords).

IMPORTANT RULES:
- Respond with ONLY a valid JSON array of JSON-LD objects. No markdown fencing, no explanation, no text before or after.
- Each object must have @context and @type.
- Keep each schema object concise — include only the most important properties (max 8-10 properties per object).
- Generate schemas for the top 15-20 most important pages only, not every page.
- Total response must be valid, complete JSON. Do NOT let the response get truncated.

Example format:
[
  {"@context": "https://schema.org", "@type": "WebSite", "name": "...", "url": "...", ...},
  {"@context": "https://schema.org", "@type": "Organization", "name": "...", ...},
  {"@context": "https://schema.org", "@type": "Article", "headline": "...", ...}
]`;

      // 9. Call AI
      const result = await callAI({
        provider: aiConfig.provider,
        model: aiConfig.model,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 16384,
        temperature: 0.3,
      });

      // 10. Parse and validate — robust extraction
      let schemas: any[];
      try {
        let text = result.text.trim();

        // Strip ALL markdown fencing variants
        text = text.replace(/^```(?:json|jsonld|javascript)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "");
        text = text.trim();

        // Try direct parse first
        try {
          const parsed = JSON.parse(text);
          schemas = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          // Fallback: extract JSON array from surrounding text
          const arrayMatch = text.match(/\[[\s\S]*\]/);
          if (arrayMatch) {
            schemas = JSON.parse(arrayMatch[0]);
            if (!Array.isArray(schemas)) schemas = [schemas];
          } else {
            // Fallback: extract JSON object
            const objMatch = text.match(/\{[\s\S]*\}/);
            if (objMatch) {
              schemas = [JSON.parse(objMatch[0])];
            } else {
              throw new Error("No JSON found in AI response");
            }
          }
        }
      } catch (parseError: any) {
        // Save raw response for debugging
        await ctx.runMutation(internal.generators.updateGeneratorStatus, {
          outputId,
          status: "failed",
          error: `JSON parse error: ${parseError.message}\n\nRaw AI response (first 500 chars):\n${result.text.slice(0, 500)}`,
        });
        return { success: false, outputId, error: parseError.message };
      }

      // 11. Extract schema types for metadata
      const schemaTypes = [...new Set(schemas.map((s) => s["@type"]).filter(Boolean))];

      // 12. Save completed output
      const generationTimeMs = Date.now() - startTime;
      await ctx.runMutation(internal.generators.updateGeneratorStatus, {
        outputId,
        status: "completed",
        content: JSON.stringify(schemas, null, 2),
        metadata: {
          pagesAnalyzed: pages.length,
          schemaTypes,
          schemasGenerated: schemas.length,
          tokensUsed: prompt.length + result.text.length,
          generationTimeMs,
        },
      });

      return { success: true, outputId, schemaTypes, schemasGenerated: schemas.length };
    } catch (error: any) {
      await ctx.runMutation(internal.generators.updateGeneratorStatus, {
        outputId,
        status: "failed",
        error: error.message || "Unknown error",
      });
      return { success: false, outputId, error: error.message };
    }
  },
});
