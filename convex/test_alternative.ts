// Test alternative endpoint: keywords_for_site
import { internalAction } from "./_generated/server";

const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

export const testKeywordsForSite = internalAction({
  args: {},
  handler: async (): Promise<any> => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      return { error: "No credentials" };
    }

    const authHeader = btoa(`${login}:${password}`);

    console.log("========== TESTING keywords_for_site for detoksvip.pl ==========");

    const requestPayload = {
      target: "detoksvip.pl",
      location_code: 2616,
      language_code: "pl",
      limit: 10,
    };

    console.log("REQUEST:", JSON.stringify(requestPayload, null, 2));

    const response = await fetch(`${DATAFORSEO_API_URL}/dataforseo_labs/google/keywords_for_site/live`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([requestPayload]),
    });

    const data = await response.json();

    console.log("FULL RESPONSE:", JSON.stringify(data, null, 2));

    const items = data?.tasks?.[0]?.result?.[0]?.items;
    const itemsCount = data?.tasks?.[0]?.result?.[0]?.items_count;

    if (Array.isArray(items) && items.length > 0) {
      console.log(`✅ FOUND ${items.length} KEYWORDS with keywords_for_site!`);
      console.log("Keywords:", items.map((item: any) => item.keyword || item.keyword_data?.keyword));
    } else {
      console.log("❌ NO KEYWORDS with keywords_for_site either");
    }

    return {
      endpoint: "keywords_for_site",
      domain: "detoksvip.pl",
      itemsCount: Array.isArray(items) ? items.length : 0,
      hasItems: !!items && items !== null,
    };
  },
});
