"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
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
  handler: async (ctx, args): Promise<{ snippet: string; steps: string[]; verification: string; pitfalls: string[] }> => {
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
