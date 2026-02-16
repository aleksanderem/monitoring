# JSON Schema & llms.txt Generator — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Generators" tab to domain detail page with JSON Schema (schema.org) and llms.txt/llms-full.txt generators, powered by AI, with platform-specific implementation instructions.

**Architecture:** Single-pass AI generation using existing crawl data (domainOnsitePages, schemaValidation, keywords, sitemap). One Convex action per generator type. Results stored in `generatorOutputs` table with versioned history. Platform instructions generated on-demand via separate AI call.

**Tech Stack:** Convex (schema, queries, mutations, actions), AI via aiProvider.ts (Anthropic/Google/Z.AI), Next.js + React frontend, next-intl i18n.

**Design doc:** `docs/plans/2026-02-16-generators-design.md`

---

## Task 1: Schema — Add `generatorOutputs` Table

**Files:**
- Modify: `convex/schema.ts:1888` (before closing `});`)

**Step 1: Add table definition**

Insert before the closing `});` on line 1889 of `convex/schema.ts`. Add after the `notifications` table `.index("by_user_unread"...)` line:

```typescript
  generatorOutputs: defineTable({
    domainId: v.id("domains"),
    type: v.union(
      v.literal("jsonSchema"),
      v.literal("llmsTxt"),
      v.literal("llmsFullTxt")
    ),
    version: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
    content: v.optional(v.string()),
    metadata: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_domain_type", ["domainId", "type"])
    .index("by_domain", ["domainId"]),
```

**Step 2: Verify**

Run: `npx convex dev --once`
Expected: Schema deploys without errors.

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add generatorOutputs table for schema/llms.txt generators"
```

---

## Task 2: Convex Queries & Mutations — `convex/generators.ts`

**Files:**
- Create: `convex/generators.ts`

**Step 1: Create the file with all queries and mutations**

```typescript
import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Queries ─────────────────────────────────────────────

export const getGeneratorOutputs = query({
  args: {
    domainId: v.id("domains"),
    type: v.optional(
      v.union(
        v.literal("jsonSchema"),
        v.literal("llmsTxt"),
        v.literal("llmsFullTxt")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.type) {
      return await ctx.db
        .query("generatorOutputs")
        .withIndex("by_domain_type", (q) =>
          q.eq("domainId", args.domainId).eq("type", args.type!)
        )
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("generatorOutputs")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .collect();
  },
});

export const getLatestOutput = query({
  args: {
    domainId: v.id("domains"),
    type: v.union(
      v.literal("jsonSchema"),
      v.literal("llmsTxt"),
      v.literal("llmsFullTxt")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generatorOutputs")
      .withIndex("by_domain_type", (q) =>
        q.eq("domainId", args.domainId).eq("type", args.type)
      )
      .order("desc")
      .first();
  },
});

// ─── Mutations ───────────────────────────────────────────

export const createGeneratorOutput = mutation({
  args: {
    domainId: v.id("domains"),
    type: v.union(
      v.literal("jsonSchema"),
      v.literal("llmsTxt"),
      v.literal("llmsFullTxt")
    ),
  },
  handler: async (ctx, args) => {
    // Auto-increment version
    const latest = await ctx.db
      .query("generatorOutputs")
      .withIndex("by_domain_type", (q) =>
        q.eq("domainId", args.domainId).eq("type", args.type)
      )
      .order("desc")
      .first();

    const version = (latest?.version ?? 0) + 1;

    return await ctx.db.insert("generatorOutputs", {
      domainId: args.domainId,
      type: args.type,
      version,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// ─── Internal (for actions) ──────────────────────────────

export const updateGeneratorStatus = internalMutation({
  args: {
    outputId: v.id("generatorOutputs"),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
    content: v.optional(v.string()),
    metadata: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { outputId, ...updates } = args;
    const patch: Record<string, any> = { status: updates.status };
    if (updates.content !== undefined) patch.content = updates.content;
    if (updates.metadata !== undefined) patch.metadata = updates.metadata;
    if (updates.error !== undefined) patch.error = updates.error;
    await ctx.db.patch(outputId, patch);
  },
});

export const getOnsitePagesInternal = internalQuery({
  args: { domainId: v.id("domains"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    // Sort by pageScore descending, take top N
    const sorted = pages
      .sort((a, b) => {
        const scoreA = (a as any).pageScore?.overall ?? 0;
        const scoreB = (b as any).pageScore?.overall ?? 0;
        return scoreB - scoreA;
      })
      .slice(0, args.limit ?? 50);

    return sorted.map((p) => ({
      url: p.url,
      title: p.title ?? null,
      metaDescription: p.metaDescription ?? null,
      h1: p.h1 ?? null,
      htags: p.htags ?? null,
      wordCount: p.wordCount,
      statusCode: p.statusCode,
    }));
  },
});

export const getSchemaValidationInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schemaValidation")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

export const getSitemapUrlsInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const sitemap = await ctx.db
      .query("domainSitemapData")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .order("desc")
      .first();
    return sitemap?.urls ?? [];
  },
});

export const getTopKeywordsInternal = internalQuery({
  args: { domainId: v.id("domains"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    return keywords
      .filter((k) => k.currentPosition != null && k.currentPosition > 0)
      .sort((a, b) => (a.currentPosition ?? 999) - (b.currentPosition ?? 999))
      .slice(0, args.limit ?? 30)
      .map((k) => ({
        keyword: k.keyword,
        position: k.currentPosition,
        url: k.currentUrl ?? null,
      }));
  },
});
```

**Step 2: Verify**

Run: `npx convex dev --once`
Expected: Functions deploy without errors.

**Step 3: Commit**

```bash
git add convex/generators.ts
git commit -m "feat: add generators queries, mutations, and internal helpers"
```

---

## Task 3: Action — `convex/actions/generateSchema.ts`

**Files:**
- Create: `convex/actions/generateSchema.ts`

**Step 1: Create the action file**

This action collects crawl data, builds a prompt, calls AI, parses JSON-LD output, and saves to `generatorOutputs`.

```typescript
"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { callAI, getAIConfigFromAction } from "./aiProvider";

export const generateJsonSchema = action({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // 1. Create pending record
    const outputId = await ctx.runMutation(api.generators.createGeneratorOutput, {
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
            limit: 50,
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
      const pageSummaries = pages.map((p) => {
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

IMPORTANT: Respond with ONLY a valid JSON array of JSON-LD objects. No markdown, no explanation. Each object must have @context and @type.

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
        maxTokens: 8192,
        temperature: 0.3,
      });

      // 10. Parse and validate
      let schemas: any[];
      try {
        // Strip potential markdown fencing
        let text = result.text.trim();
        if (text.startsWith("```")) {
          text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        schemas = JSON.parse(text);
        if (!Array.isArray(schemas)) {
          schemas = [schemas];
        }
      } catch {
        throw new Error("AI returned invalid JSON. Raw response saved in error field.");
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
```

**Step 2: Verify**

Run: `npx convex dev --once`
Expected: Action deploys without errors.

**Step 3: Commit**

```bash
git add convex/actions/generateSchema.ts
git commit -m "feat: add JSON Schema generator action with AI-powered type detection"
```

---

## Task 4: Action — `convex/actions/generateLlmsTxt.ts`

**Files:**
- Create: `convex/actions/generateLlmsTxt.ts`

**Step 1: Create the action file**

```typescript
"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { callAI, getAIConfigFromAction } from "./aiProvider";

export const generateLlmsTxt = action({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // 1. Create two pending records (llmsTxt + llmsFullTxt)
    const outputIdShort = await ctx.runMutation(
      api.generators.createGeneratorOutput,
      { domainId: args.domainId, type: "llmsTxt" }
    );
    const outputIdFull = await ctx.runMutation(
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
      const pageData = pages.map((p) => {
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
        .map((k) => `"${k.keyword}" (pos: ${k.position}) → ${k.url || "N/A"}`)
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

      // 9. Parse response
      let parsed: { llmsTxt: string; llmsFullTxt: string };
      try {
        let text = result.text.trim();
        if (text.startsWith("```")) {
          text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        parsed = JSON.parse(text);
        if (!parsed.llmsTxt || !parsed.llmsFullTxt) {
          throw new Error("Missing llmsTxt or llmsFullTxt in response");
        }
      } catch {
        throw new Error("AI returned invalid JSON for llms.txt generation");
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
```

**Step 2: Verify**

Run: `npx convex dev --once`
Expected: Action deploys without errors.

**Step 3: Commit**

```bash
git add convex/actions/generateLlmsTxt.ts
git commit -m "feat: add llms.txt and llms-full.txt generator action"
```

---

## Task 5: Action — `convex/actions/generatePlatformInstructions.ts`

**Files:**
- Create: `convex/actions/generatePlatformInstructions.ts`

**Step 1: Create the action file**

```typescript
"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { callAI, getAIConfigFromAction } from "./aiProvider";

export const generatePlatformInstructions = action({
  args: {
    domainId: v.id("domains"),
    outputId: v.id("generatorOutputs"),
    platform: v.union(
      v.literal("shoper"),
      v.literal("wordpress"),
      v.literal("woocommerce"),
      v.literal("shopify"),
      v.literal("prestashop"),
      v.literal("custom")
    ),
    outputType: v.union(
      v.literal("jsonSchema"),
      v.literal("llmsTxt"),
      v.literal("llmsFullTxt")
    ),
  },
  handler: async (ctx, args) => {
    // 1. Get AI config
    const aiConfig = await getAIConfigFromAction(ctx, args.domainId);

    // 2. Build platform-specific prompt
    const platformNames: Record<string, string> = {
      shoper: "Shoper (Polish e-commerce platform)",
      wordpress: "WordPress",
      woocommerce: "WooCommerce (WordPress plugin)",
      shopify: "Shopify",
      prestashop: "PrestaShop",
      custom: "custom HTML website",
    };

    const isSchema = args.outputType === "jsonSchema";
    const fileType = isSchema ? "JSON-LD schema.org structured data" : "llms.txt file";

    const prompt = `You are a web developer expert. Generate step-by-step instructions for adding ${fileType} to a ${platformNames[args.platform]} website.

=== CONTENT TYPE ===
${isSchema ? "JSON-LD structured data (goes in <head> as <script type=\"application/ld+json\">)" : "Plain text file that must be accessible at the root URL /llms.txt or /llms-full.txt"}

=== PLATFORM ===
${platformNames[args.platform]}

=== INSTRUCTIONS ===
Provide:
1. A ready-to-paste code snippet (if applicable)
2. Step-by-step instructions for where to paste/upload on ${platformNames[args.platform]}
3. How to verify it works after deployment
4. Common pitfalls or gotchas for this platform

${isSchema ? `For JSON-LD: The snippet should be a <script type="application/ld+json"> tag wrapping the schema data. Show exactly where in the platform to paste it.` : `For llms.txt: The file needs to be at the domain root (e.g., example.com/llms.txt). Show how to upload or create this file on the platform.`}

${args.platform === "shoper" ? "NOTE: Shoper has 'Wygląd → Edycja szablonu' and 'Ustawienia → Własne kody HTML' sections. For files, FTP/SFTP access is needed." : ""}
${args.platform === "shopify" ? "NOTE: Shopify doesn't allow direct file placement in the root directory. For llms.txt, suggest Cloudflare Workers or redirect rules as alternatives." : ""}

IMPORTANT: Respond with a JSON object:
{
  "snippet": "ready-to-paste code (or empty string if not applicable)",
  "steps": ["Step 1: ...", "Step 2: ...", ...],
  "verification": "How to verify it works",
  "pitfalls": ["Pitfall 1", "Pitfall 2", ...]
}`;

    // 3. Call AI
    const result = await callAI({
      provider: aiConfig.provider,
      model: aiConfig.model,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4096,
      temperature: 0.3,
    });

    // 4. Parse
    try {
      let text = result.text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      return JSON.parse(text);
    } catch {
      return {
        snippet: "",
        steps: ["Error: Could not generate platform instructions. Please try again."],
        verification: "",
        pitfalls: [],
      };
    }
  },
});
```

**Step 2: Verify**

Run: `npx convex dev --once`
Expected: Action deploys without errors.

**Step 3: Commit**

```bash
git add convex/actions/generatePlatformInstructions.ts
git commit -m "feat: add platform-specific instruction generator for schema/llms.txt"
```

---

## Task 6: i18n — Generator Translations

**Files:**
- Create: `src/messages/en/generators.json`
- Create: `src/messages/pl/generators.json`
- Modify: `src/i18n/request.ts` (add namespace import if needed)

**Step 1: Create English translations**

Create `src/messages/en/generators.json`:

```json
{
  "tabGenerators": "Generators",
  "schemaGeneratorTitle": "JSON Schema (schema.org)",
  "schemaGeneratorDesc": "Generate structured data markup for your pages",
  "llmsGeneratorTitle": "llms.txt & llms-full.txt",
  "llmsGeneratorDesc": "Generate AI-optimized site description files",
  "generateSchema": "Generate Schema",
  "generateLlmsTxt": "Generate llms.txt",
  "regenerate": "Regenerate",
  "notGenerated": "Not generated yet",
  "lastGenerated": "Last generated: {date}",
  "version": "Version {version}",
  "generating": "Generating...",
  "stepCollecting": "Collecting page data...",
  "stepAnalyzing": "Analyzing content structure...",
  "stepGenerating": "Generating with AI...",
  "stepFinalizing": "Finalizing output...",
  "generationFailed": "Generation failed",
  "generationComplete": "Generation complete",
  "schemasGenerated": "{count} schemas generated",
  "schemaTypes": "Detected types",
  "pagesAnalyzed": "{count} pages analyzed",
  "sectionsGenerated": "{count} sections",
  "copyAll": "Copy All",
  "copyToClipboard": "Copy to Clipboard",
  "download": "Download",
  "downloadJson": "Download .json",
  "downloadTxt": "Download .txt",
  "copied": "Copied to clipboard!",
  "history": "History",
  "noHistory": "No previous generations",
  "viewVersion": "View version {version}",
  "platformInstructions": "Platform Instructions",
  "selectPlatform": "Select your platform",
  "platformShoper": "Shoper",
  "platformWordpress": "WordPress",
  "platformWoocommerce": "WooCommerce",
  "platformShopify": "Shopify",
  "platformPrestashop": "PrestaShop",
  "platformCustom": "Custom / HTML",
  "implementationSteps": "Implementation Steps",
  "codeSnippet": "Code Snippet",
  "verification": "Verification",
  "commonPitfalls": "Common Pitfalls",
  "loadingInstructions": "Generating platform instructions...",
  "llmsTxtTab": "llms.txt",
  "llmsFullTxtTab": "llms-full.txt",
  "faqCount": "{count} FAQ items",
  "requiresCrawl": "Run an On-Site scan first to have page data available for generation.",
  "editBeforeDownload": "Edit",
  "saveEdits": "Save",
  "cancelEdits": "Cancel"
}
```

**Step 2: Create Polish translations**

Create `src/messages/pl/generators.json`:

```json
{
  "tabGenerators": "Generatory",
  "schemaGeneratorTitle": "JSON Schema (schema.org)",
  "schemaGeneratorDesc": "Generuj znaczniki danych strukturalnych dla Twoich stron",
  "llmsGeneratorTitle": "llms.txt i llms-full.txt",
  "llmsGeneratorDesc": "Generuj pliki opisu strony zoptymalizowane pod AI",
  "generateSchema": "Generuj Schema",
  "generateLlmsTxt": "Generuj llms.txt",
  "regenerate": "Generuj ponownie",
  "notGenerated": "Jeszcze nie wygenerowano",
  "lastGenerated": "Ostatnio wygenerowano: {date}",
  "version": "Wersja {version}",
  "generating": "Generowanie...",
  "stepCollecting": "Zbieranie danych stron...",
  "stepAnalyzing": "Analiza struktury treści...",
  "stepGenerating": "Generowanie przez AI...",
  "stepFinalizing": "Finalizowanie...",
  "generationFailed": "Generowanie nie powiodło się",
  "generationComplete": "Generowanie zakończone",
  "schemasGenerated": "Wygenerowano {count} schematów",
  "schemaTypes": "Wykryte typy",
  "pagesAnalyzed": "Przeanalizowano {count} stron",
  "sectionsGenerated": "{count} sekcji",
  "copyAll": "Kopiuj wszystko",
  "copyToClipboard": "Kopiuj do schowka",
  "download": "Pobierz",
  "downloadJson": "Pobierz .json",
  "downloadTxt": "Pobierz .txt",
  "copied": "Skopiowano do schowka!",
  "history": "Historia",
  "noHistory": "Brak wcześniejszych generowań",
  "viewVersion": "Zobacz wersję {version}",
  "platformInstructions": "Instrukcje dla platformy",
  "selectPlatform": "Wybierz platformę",
  "platformShoper": "Shoper",
  "platformWordpress": "WordPress",
  "platformWoocommerce": "WooCommerce",
  "platformShopify": "Shopify",
  "platformPrestashop": "PrestaShop",
  "platformCustom": "Własna / HTML",
  "implementationSteps": "Kroki wdrożenia",
  "codeSnippet": "Fragment kodu",
  "verification": "Weryfikacja",
  "commonPitfalls": "Częste pułapki",
  "loadingInstructions": "Generowanie instrukcji dla platformy...",
  "llmsTxtTab": "llms.txt",
  "llmsFullTxtTab": "llms-full.txt",
  "faqCount": "{count} pozycji FAQ",
  "requiresCrawl": "Najpierw uruchom skan On-Site, aby mieć dane stron do generowania.",
  "editBeforeDownload": "Edytuj",
  "saveEdits": "Zapisz",
  "cancelEdits": "Anuluj"
}
```

**Step 3: Register namespace in i18n**

Check `src/i18n/request.ts` — add `generators` to the messages import if the pattern requires it (may auto-detect from file). Also check if `src/messages/en/generators.json` needs explicit import in the i18n config.

**Step 4: Commit**

```bash
git add src/messages/en/generators.json src/messages/pl/generators.json src/i18n/request.ts
git commit -m "feat: add i18n translations for generators tab (EN + PL)"
```

---

## Task 7: Frontend — Shared Components

**Files:**
- Create: `src/components/domain/sections/generators/CodePreview.tsx`
- Create: `src/components/domain/sections/generators/GeneratorHistoryList.tsx`
- Create: `src/components/domain/sections/generators/PlatformInstructions.tsx`

**Step 1: Create CodePreview component**

`src/components/domain/sections/generators/CodePreview.tsx` — syntax-highlighted code preview with copy/download buttons.

```tsx
"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface CodePreviewProps {
  code: string;
  language: "json" | "markdown";
  filename: string;
  onEdit?: (newCode: string) => void;
}

export function CodePreview({ code, language, filename, onEdit }: CodePreviewProps) {
  const t = useTranslations("generators");
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(isEditing ? editedCode : code);
    toast.success(t("copied"));
  }, [code, editedCode, isEditing, t]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([isEditing ? editedCode : code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, editedCode, filename, isEditing]);

  const handleSaveEdit = useCallback(() => {
    onEdit?.(editedCode);
    setIsEditing(false);
  }, [editedCode, onEdit]);

  return (
    <div className="rounded-lg border border-secondary bg-primary">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-secondary px-4 py-2">
        <span className="text-xs font-medium text-tertiary">{filename}</span>
        <div className="flex gap-2">
          {onEdit && !isEditing && (
            <button
              onClick={() => { setEditedCode(code); setIsEditing(true); }}
              className="rounded px-2 py-1 text-xs text-tertiary hover:bg-secondary hover:text-primary"
            >
              {t("editBeforeDownload")}
            </button>
          )}
          {isEditing && (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="rounded px-2 py-1 text-xs text-tertiary hover:bg-secondary hover:text-primary"
              >
                {t("cancelEdits")}
              </button>
              <button
                onClick={handleSaveEdit}
                className="rounded bg-brand-500 px-2 py-1 text-xs text-white hover:bg-brand-600"
              >
                {t("saveEdits")}
              </button>
            </>
          )}
          <button
            onClick={handleCopy}
            className="rounded px-2 py-1 text-xs text-tertiary hover:bg-secondary hover:text-primary"
          >
            {t("copyToClipboard")}
          </button>
          <button
            onClick={handleDownload}
            className="rounded px-2 py-1 text-xs text-tertiary hover:bg-secondary hover:text-primary"
          >
            {t("download")}
          </button>
        </div>
      </div>

      {/* Code area */}
      {isEditing ? (
        <textarea
          value={editedCode}
          onChange={(e) => setEditedCode(e.target.value)}
          className="w-full resize-y bg-primary p-4 font-mono text-xs text-primary focus:outline-none"
          rows={20}
          spellCheck={false}
        />
      ) : (
        <pre className="max-h-[500px] overflow-auto p-4">
          <code className="font-mono text-xs text-primary whitespace-pre-wrap break-words">
            {code}
          </code>
        </pre>
      )}
    </div>
  );
}
```

**Step 2: Create GeneratorHistoryList component**

`src/components/domain/sections/generators/GeneratorHistoryList.tsx`

```tsx
"use client";

import { useTranslations } from "next-intl";

interface HistoryItem {
  _id: string;
  version: number;
  status: string;
  createdAt: number;
  metadata?: any;
}

interface GeneratorHistoryListProps {
  items: HistoryItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function GeneratorHistoryList({ items, selectedId, onSelect }: GeneratorHistoryListProps) {
  const t = useTranslations("generators");

  if (items.length === 0) {
    return <p className="text-sm text-tertiary">{t("noHistory")}</p>;
  }

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium uppercase tracking-wider text-quaternary">{t("history")}</h4>
      {items.map((item) => (
        <button
          key={item._id}
          onClick={() => onSelect(item._id)}
          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
            selectedId === item._id
              ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
              : "text-secondary hover:bg-secondary"
          }`}
        >
          <span>{t("version", { version: item.version })}</span>
          <span className="text-xs text-tertiary">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </button>
      ))}
    </div>
  );
}
```

**Step 3: Create PlatformInstructions component**

`src/components/domain/sections/generators/PlatformInstructions.tsx`

```tsx
"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";

const PLATFORMS = [
  { id: "shoper", label: "platformShoper" },
  { id: "wordpress", label: "platformWordpress" },
  { id: "woocommerce", label: "platformWoocommerce" },
  { id: "shopify", label: "platformShopify" },
  { id: "prestashop", label: "platformPrestashop" },
  { id: "custom", label: "platformCustom" },
] as const;

type Platform = (typeof PLATFORMS)[number]["id"];

interface PlatformInstructionsProps {
  domainId: Id<"domains">;
  outputId: Id<"generatorOutputs">;
  outputType: "jsonSchema" | "llmsTxt" | "llmsFullTxt";
  generatedContent: string;
}

export function PlatformInstructions({
  domainId,
  outputId,
  outputType,
  generatedContent,
}: PlatformInstructionsProps) {
  const t = useTranslations("generators");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [instructions, setInstructions] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateInstructions = useAction(api.actions.generatePlatformInstructions.generatePlatformInstructions);

  const handlePlatformSelect = useCallback(
    async (platform: Platform) => {
      setSelectedPlatform(platform);
      setInstructions(null);
      setLoading(true);
      try {
        const result = await generateInstructions({
          domainId,
          outputId,
          platform,
          outputType,
        });
        setInstructions(result);
      } catch (err: any) {
        toast.error(err.message || "Failed to generate instructions");
      } finally {
        setLoading(false);
      }
    },
    [domainId, outputId, outputType, generateInstructions]
  );

  const handleCopySnippet = useCallback(async () => {
    if (instructions?.snippet) {
      await navigator.clipboard.writeText(instructions.snippet);
      toast.success(t("copied"));
    }
  }, [instructions, t]);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-primary">{t("platformInstructions")}</h4>

      {/* Platform selector */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePlatformSelect(p.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              selectedPlatform === p.id
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                : "border-secondary text-secondary hover:border-primary hover:text-primary"
            }`}
          >
            {t(p.label)}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-tertiary">
          <div className="size-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          {t("loadingInstructions")}
        </div>
      )}

      {/* Instructions display */}
      {instructions && !loading && (
        <div className="space-y-4 rounded-lg border border-secondary bg-secondary/30 p-4">
          {/* Snippet */}
          {instructions.snippet && (
            <div>
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-medium uppercase tracking-wider text-quaternary">
                  {t("codeSnippet")}
                </h5>
                <button
                  onClick={handleCopySnippet}
                  className="text-xs text-brand-500 hover:text-brand-600"
                >
                  {t("copyToClipboard")}
                </button>
              </div>
              <pre className="mt-2 max-h-[200px] overflow-auto rounded bg-primary p-3">
                <code className="font-mono text-xs text-primary whitespace-pre-wrap break-words">
                  {instructions.snippet}
                </code>
              </pre>
            </div>
          )}

          {/* Steps */}
          {instructions.steps?.length > 0 && (
            <div>
              <h5 className="text-xs font-medium uppercase tracking-wider text-quaternary">
                {t("implementationSteps")}
              </h5>
              <ol className="mt-2 space-y-2">
                {instructions.steps.map((step: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-secondary">
                    <span className="shrink-0 font-medium text-brand-500">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Verification */}
          {instructions.verification && (
            <div>
              <h5 className="text-xs font-medium uppercase tracking-wider text-quaternary">
                {t("verification")}
              </h5>
              <p className="mt-1 text-sm text-secondary">{instructions.verification}</p>
            </div>
          )}

          {/* Pitfalls */}
          {instructions.pitfalls?.length > 0 && (
            <div>
              <h5 className="text-xs font-medium uppercase tracking-wider text-quaternary">
                {t("commonPitfalls")}
              </h5>
              <ul className="mt-1 space-y-1">
                {instructions.pitfalls.map((p: string, i: number) => (
                  <li key={i} className="text-sm text-warning-600 dark:text-warning-400">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/domain/sections/generators/
git commit -m "feat: add shared generator components (CodePreview, HistoryList, PlatformInstructions)"
```

---

## Task 8: Frontend — Schema Generator Panel

**Files:**
- Create: `src/components/domain/sections/generators/SchemaGeneratorPanel.tsx`

**Step 1: Create the panel component**

This component shows latest schema output, handles generation trigger, displays results with preview and platform instructions, and shows history.

```tsx
"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { CodePreview } from "./CodePreview";
import { GeneratorHistoryList } from "./GeneratorHistoryList";
import { PlatformInstructions } from "./PlatformInstructions";
import { Button } from "@/components/base/buttons/button";

interface SchemaGeneratorPanelProps {
  domainId: Id<"domains">;
}

export function SchemaGeneratorPanel({ domainId }: SchemaGeneratorPanelProps) {
  const t = useTranslations("generators");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const latest = useQuery(api.generators.getLatestOutput, {
    domainId,
    type: "jsonSchema",
  });
  const history = useQuery(api.generators.getGeneratorOutputs, {
    domainId,
    type: "jsonSchema",
  });

  const generateSchema = useAction(api.actions.generateSchema.generateJsonSchema);

  const isGenerating = latest?.status === "pending" || latest?.status === "generating";

  const handleGenerate = useCallback(async () => {
    try {
      await generateSchema({ domainId });
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    }
  }, [domainId, generateSchema]);

  // Determine which output to display
  const displayOutput = selectedHistoryId
    ? history?.find((h) => h._id === selectedHistoryId)
    : latest;

  const schemaTypes = (displayOutput?.metadata as any)?.schemaTypes ?? [];
  const schemasGenerated = (displayOutput?.metadata as any)?.schemasGenerated ?? 0;
  const pagesAnalyzed = (displayOutput?.metadata as any)?.pagesAnalyzed ?? 0;

  return (
    <div className="rounded-xl border border-secondary bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
        <div>
          <h3 className="text-base font-semibold text-primary">{t("schemaGeneratorTitle")}</h3>
          <p className="text-sm text-tertiary">{t("schemaGeneratorDesc")}</p>
        </div>
        <Button
          size="md"
          color="primary"
          onClick={handleGenerate}
          isDisabled={isGenerating}
        >
          {isGenerating ? t("generating") : displayOutput?.content ? t("regenerate") : t("generateSchema")}
        </Button>
      </div>

      <div className="p-6">
        {/* Generation progress */}
        {isGenerating && (
          <div className="space-y-3 py-8 text-center">
            <div className="mx-auto size-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary">{t("generating")}</p>
              <p className="text-xs text-tertiary">{t("stepGenerating")}</p>
            </div>
          </div>
        )}

        {/* Failed state */}
        {displayOutput?.status === "failed" && (
          <div className="rounded-lg border border-error-300 bg-error-50 p-4 dark:border-error-800 dark:bg-error-950">
            <p className="text-sm font-medium text-error-700 dark:text-error-300">{t("generationFailed")}</p>
            <p className="mt-1 text-xs text-error-600 dark:text-error-400">{displayOutput.error}</p>
          </div>
        )}

        {/* Completed output */}
        {displayOutput?.status === "completed" && displayOutput.content && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="flex flex-wrap gap-4">
              <div className="rounded-lg bg-secondary/50 px-3 py-2">
                <span className="text-xs text-tertiary">{t("pagesAnalyzed", { count: pagesAnalyzed })}</span>
              </div>
              <div className="rounded-lg bg-secondary/50 px-3 py-2">
                <span className="text-xs text-tertiary">{t("schemasGenerated", { count: schemasGenerated })}</span>
              </div>
              {schemaTypes.length > 0 && (
                <div className="rounded-lg bg-secondary/50 px-3 py-2">
                  <span className="text-xs text-tertiary">
                    {t("schemaTypes")}: {schemaTypes.join(", ")}
                  </span>
                </div>
              )}
            </div>

            {/* Code preview */}
            <CodePreview
              code={displayOutput.content}
              language="json"
              filename="schema.json"
            />

            {/* Platform instructions */}
            <PlatformInstructions
              domainId={domainId}
              outputId={displayOutput._id as Id<"generatorOutputs">}
              outputType="jsonSchema"
              generatedContent={displayOutput.content}
            />
          </div>
        )}

        {/* Empty state */}
        {!isGenerating && !displayOutput && (
          <div className="py-12 text-center">
            <p className="text-sm text-tertiary">{t("notGenerated")}</p>
          </div>
        )}

        {/* History sidebar */}
        {history && history.length > 1 && (
          <div className="mt-6 border-t border-secondary pt-4">
            <GeneratorHistoryList
              items={history.map((h) => ({
                _id: h._id,
                version: h.version,
                status: h.status,
                createdAt: h.createdAt,
                metadata: h.metadata,
              }))}
              selectedId={selectedHistoryId ?? latest?._id}
              onSelect={(id) => setSelectedHistoryId(id === latest?._id ? null : id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/domain/sections/generators/SchemaGeneratorPanel.tsx
git commit -m "feat: add Schema Generator Panel with preview, stats, and platform instructions"
```

---

## Task 9: Frontend — llms.txt Generator Panel

**Files:**
- Create: `src/components/domain/sections/generators/LlmsTxtGeneratorPanel.tsx`

**Step 1: Create the panel component**

Similar to SchemaGeneratorPanel but handles two outputs (llmsTxt + llmsFullTxt) with sub-tabs.

```tsx
"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { CodePreview } from "./CodePreview";
import { GeneratorHistoryList } from "./GeneratorHistoryList";
import { PlatformInstructions } from "./PlatformInstructions";
import { Button } from "@/components/base/buttons/button";

interface LlmsTxtGeneratorPanelProps {
  domainId: Id<"domains">;
}

export function LlmsTxtGeneratorPanel({ domainId }: LlmsTxtGeneratorPanelProps) {
  const t = useTranslations("generators");
  const [activeSubTab, setActiveSubTab] = useState<"llmsTxt" | "llmsFullTxt">("llmsTxt");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const latestShort = useQuery(api.generators.getLatestOutput, {
    domainId,
    type: "llmsTxt",
  });
  const latestFull = useQuery(api.generators.getLatestOutput, {
    domainId,
    type: "llmsFullTxt",
  });
  const historyShort = useQuery(api.generators.getGeneratorOutputs, {
    domainId,
    type: "llmsTxt",
  });

  const generateLlmsTxt = useAction(api.actions.generateLlmsTxt.generateLlmsTxt);

  const isGenerating =
    latestShort?.status === "pending" ||
    latestShort?.status === "generating" ||
    latestFull?.status === "pending" ||
    latestFull?.status === "generating";

  const handleGenerate = useCallback(async () => {
    try {
      await generateLlmsTxt({ domainId });
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    }
  }, [domainId, generateLlmsTxt]);

  const latest = activeSubTab === "llmsTxt" ? latestShort : latestFull;
  const displayOutput = selectedHistoryId
    ? historyShort?.find((h) => h._id === selectedHistoryId)
    : latest;

  const hasOutput = latestShort?.status === "completed" || latestFull?.status === "completed";
  const sections = (displayOutput?.metadata as any)?.sections ?? [];
  const pagesAnalyzed = (displayOutput?.metadata as any)?.pagesAnalyzed ?? 0;

  return (
    <div className="rounded-xl border border-secondary bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
        <div>
          <h3 className="text-base font-semibold text-primary">{t("llmsGeneratorTitle")}</h3>
          <p className="text-sm text-tertiary">{t("llmsGeneratorDesc")}</p>
        </div>
        <Button
          size="md"
          color="primary"
          onClick={handleGenerate}
          isDisabled={isGenerating}
        >
          {isGenerating ? t("generating") : hasOutput ? t("regenerate") : t("generateLlmsTxt")}
        </Button>
      </div>

      <div className="p-6">
        {/* Generation progress */}
        {isGenerating && (
          <div className="space-y-3 py-8 text-center">
            <div className="mx-auto size-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary">{t("generating")}</p>
              <p className="text-xs text-tertiary">{t("stepGenerating")}</p>
            </div>
          </div>
        )}

        {/* Failed state */}
        {displayOutput?.status === "failed" && (
          <div className="rounded-lg border border-error-300 bg-error-50 p-4 dark:border-error-800 dark:bg-error-950">
            <p className="text-sm font-medium text-error-700 dark:text-error-300">{t("generationFailed")}</p>
            <p className="mt-1 text-xs text-error-600 dark:text-error-400">{displayOutput.error}</p>
          </div>
        )}

        {/* Completed output */}
        {hasOutput && !isGenerating && (
          <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
              <button
                onClick={() => { setActiveSubTab("llmsTxt"); setSelectedHistoryId(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeSubTab === "llmsTxt"
                    ? "bg-primary text-primary shadow-sm"
                    : "text-tertiary hover:text-primary"
                }`}
              >
                {t("llmsTxtTab")}
              </button>
              <button
                onClick={() => { setActiveSubTab("llmsFullTxt"); setSelectedHistoryId(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeSubTab === "llmsFullTxt"
                    ? "bg-primary text-primary shadow-sm"
                    : "text-tertiary hover:text-primary"
                }`}
              >
                {t("llmsFullTxtTab")}
              </button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4">
              <div className="rounded-lg bg-secondary/50 px-3 py-2">
                <span className="text-xs text-tertiary">{t("pagesAnalyzed", { count: pagesAnalyzed })}</span>
              </div>
              {sections.length > 0 && (
                <div className="rounded-lg bg-secondary/50 px-3 py-2">
                  <span className="text-xs text-tertiary">
                    {t("sectionsGenerated", { count: sections.length })}
                  </span>
                </div>
              )}
            </div>

            {/* Code preview */}
            {displayOutput?.content && (
              <CodePreview
                code={displayOutput.content}
                language="markdown"
                filename={activeSubTab === "llmsTxt" ? "llms.txt" : "llms-full.txt"}
              />
            )}

            {/* Platform instructions */}
            {displayOutput?.content && (
              <PlatformInstructions
                domainId={domainId}
                outputId={displayOutput._id as Id<"generatorOutputs">}
                outputType={activeSubTab}
                generatedContent={displayOutput.content}
              />
            )}
          </div>
        )}

        {/* Empty state */}
        {!isGenerating && !hasOutput && (
          <div className="py-12 text-center">
            <p className="text-sm text-tertiary">{t("notGenerated")}</p>
          </div>
        )}

        {/* History */}
        {historyShort && historyShort.length > 1 && (
          <div className="mt-6 border-t border-secondary pt-4">
            <GeneratorHistoryList
              items={historyShort.map((h) => ({
                _id: h._id,
                version: h.version,
                status: h.status,
                createdAt: h.createdAt,
                metadata: h.metadata,
              }))}
              selectedId={selectedHistoryId ?? latestShort?._id}
              onSelect={(id) => setSelectedHistoryId(id === latestShort?._id ? null : id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/domain/sections/generators/LlmsTxtGeneratorPanel.tsx
git commit -m "feat: add llms.txt Generator Panel with sub-tabs and platform instructions"
```

---

## Task 10: Frontend — GeneratorsSection Main Component

**Files:**
- Create: `src/components/domain/sections/GeneratorsSection.tsx`

**Step 1: Create the main section**

```tsx
"use client";

import type { Id } from "../../../../convex/_generated/dataModel";
import { SchemaGeneratorPanel } from "./generators/SchemaGeneratorPanel";
import { LlmsTxtGeneratorPanel } from "./generators/LlmsTxtGeneratorPanel";

interface GeneratorsSectionProps {
  domainId: Id<"domains">;
}

export function GeneratorsSection({ domainId }: GeneratorsSectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SchemaGeneratorPanel domainId={domainId} />
      <LlmsTxtGeneratorPanel domainId={domainId} />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/domain/sections/GeneratorsSection.tsx
git commit -m "feat: add GeneratorsSection with side-by-side panels"
```

---

## Task 11: Integration — Add "Generators" Tab to Domain Page

**Files:**
- Modify: `src/app/(dashboard)/domains/[domainId]/page.tsx`
- Modify: `src/messages/en/domains.json`
- Modify: `src/messages/pl/domains.json`

**Step 1: Add import**

Add at the top of `src/app/(dashboard)/domains/[domainId]/page.tsx` near other section imports (around line 91-92):

```typescript
import { GeneratorsSection } from "@/components/domain/sections/GeneratorsSection";
```

Also import `Code01` icon from `@untitledui/icons` — add it to one of the existing import lines.

**Step 2: Add tab to TAB_EZICONS map**

In the `TAB_EZICONS` object (line ~98-114), add before `"diagnostics"`:

```typescript
  "generators": "code",
```

**Step 3: Add tab definition**

In the `tabs` array (line ~234-250), add before `settings`:

```typescript
    { id: "generators", label: t('tabGenerators'), icon: Code01 },
```

**Step 4: Add TabPanel**

Add a new `TabPanel` near the other panels (around line 928-932, after `strategy` panel):

```tsx
            <TabPanel id="generators">
              <GeneratorsSection domainId={domainId} />
            </TabPanel>
```

**Step 5: Add i18n key to domains.json**

In `src/messages/en/domains.json`, add:
```json
"tabGenerators": "Generators"
```

In `src/messages/pl/domains.json`, add:
```json
"tabGenerators": "Generatory"
```

**Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 7: Commit**

```bash
git add src/app/(dashboard)/domains/[domainId]/page.tsx src/messages/en/domains.json src/messages/pl/domains.json
git commit -m "feat: integrate Generators tab into domain detail page"
```

---

## Task 12: Deploy & Verify

**Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Convex deploy**

Run: `npx convex dev --once`
Expected: All functions deploy successfully.

**Step 3: Manual verification checklist**

1. Open a domain detail page
2. New "Generators" tab appears in the tab list
3. Click it — two panels appear side by side
4. Click "Generate Schema" — loading spinner appears, then JSON-LD output
5. Schema shows detected types (Article, Organization, etc.)
6. "Copy All" and "Download .json" buttons work
7. Select a platform (e.g., Shoper) — instructions appear
8. Click "Generate llms.txt" — loading, then output with two sub-tabs
9. Switch between llms.txt and llms-full.txt tabs
10. Platform instructions work for llms.txt too
11. Generate again — version increments, history list appears
12. Click older version in history — previous output displays

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete JSON Schema and llms.txt generator with platform instructions"
```

---

## Files Summary

| # | File | Action |
|---|------|--------|
| 1 | `convex/schema.ts` | Modify — add `generatorOutputs` table |
| 2 | `convex/generators.ts` | Create — queries, mutations, internal helpers |
| 3 | `convex/actions/generateSchema.ts` | Create — JSON Schema generation action |
| 4 | `convex/actions/generateLlmsTxt.ts` | Create — llms.txt generation action |
| 5 | `convex/actions/generatePlatformInstructions.ts` | Create — platform instruction generation |
| 6 | `src/messages/en/generators.json` | Create — English translations (~50 keys) |
| 7 | `src/messages/pl/generators.json` | Create — Polish translations (~50 keys) |
| 8 | `src/components/domain/sections/generators/CodePreview.tsx` | Create — code viewer with copy/download/edit |
| 9 | `src/components/domain/sections/generators/GeneratorHistoryList.tsx` | Create — version history list |
| 10 | `src/components/domain/sections/generators/PlatformInstructions.tsx` | Create — platform selector + instructions |
| 11 | `src/components/domain/sections/generators/SchemaGeneratorPanel.tsx` | Create — JSON Schema panel |
| 12 | `src/components/domain/sections/generators/LlmsTxtGeneratorPanel.tsx` | Create — llms.txt panel |
| 13 | `src/components/domain/sections/GeneratorsSection.tsx` | Create — main section wrapper |
| 14 | `src/app/(dashboard)/domains/[domainId]/page.tsx` | Modify — add Generators tab + TabPanel |
| 15 | `src/messages/en/domains.json` | Modify — add tabGenerators key |
| 16 | `src/messages/pl/domains.json` | Modify — add tabGenerators key |
