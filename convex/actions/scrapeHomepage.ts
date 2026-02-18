"use node";

import { API_COSTS, extractApiCost } from "../apiUsage";

const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

/**
 * Fetch homepage text content via DataForSEO Content Parsing API.
 * Returns plain text summary (truncated to ~3000 chars for prompt context)
 * and the estimated API cost for logging by the caller.
 * Shared across AI features: business context generation, keyword research, etc.
 */
export async function fetchPageContent(domain: string): Promise<{ text: string | null; apiCost: number }> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return { text: null, apiCost: 0 };

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

    if (!response.ok) return { text: null, apiCost: 0 };

    const data = await response.json();
    const apiCost = extractApiCost(data, API_COSTS.ON_PAGE_CONTENT_PARSING);
    const result = data?.tasks?.[0]?.result?.[0];
    if (!result) return { text: null, apiCost };

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
    const text = fullText.length > 3000 ? fullText.slice(0, 3000) + "..." : fullText;
    return { text, apiCost };
  } catch (error) {
    console.warn("Content parsing failed:", error);
    return { text: null, apiCost: 0 };
  }
}
