import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Manually set keyword type for a specific keyword
 */
export const setKeywordType = mutation({
    args: {
        keywordId: v.id("keywords"),
        keywordType: v.union(v.literal("core"), v.literal("longtail"), v.literal("branded")),
    },
    handler: async (ctx, args) => {
        const keyword = await ctx.db.get(args.keywordId);
        if (!keyword) throw new Error("Keyword not found");

        await ctx.db.patch(args.keywordId, { keywordType: args.keywordType });
        return args.keywordId;
    },
});

/**
 * Auto-detect and backfill keyword types for all keywords in a domain
 */
export const backfillKeywordTypes = mutation({
    args: { domainId: v.id("domains") },
    handler: async (ctx, args) => {
        const domain = await ctx.db.get(args.domainId);
        if (!domain) throw new Error("Domain not found");

        const domainBase = domain.domain.replace(/\.(com|pl|net|org|io|co|eu|de|uk)$/i, "").replace(/^www\./, "").toLowerCase();

        const keywords = await ctx.db
            .query("keywords")
            .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
            .collect();

        let updated = 0;
        for (const keyword of keywords) {
            if (keyword.keywordType) continue; // Skip already classified

            const phrase = keyword.phrase.toLowerCase();
            const words = phrase.trim().split(/\s+/);

            let keywordType: "core" | "longtail" | "branded" = "core";
            if (phrase.includes(domainBase)) {
                keywordType = "branded";
            } else if (words.length >= 4) {
                keywordType = "longtail";
            }

            await ctx.db.patch(keyword._id, { keywordType });
            updated++;
        }

        return { updated, total: keywords.length };
    },
});
