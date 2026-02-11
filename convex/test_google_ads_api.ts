// Test Google Ads Keywords for Site API - the correct endpoint!
import { internalAction } from "./_generated/server";

const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

export const testGoogleAdsKeywords = internalAction({
  args: {},
  handler: async (): Promise<any> => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      return { error: "No credentials" };
    }

    const authHeader = btoa(`${login}:${password}`);

    console.log("========== TESTING Google Ads Keywords for Site API ==========");
    console.log("Domain: detoksvip.pl");

    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const requestPayload = {
      target: "detoksvip.pl",
      location_code: 2616,
      language_code: "pl",
      date_from: oneYearAgo.toISOString().split("T")[0],
      date_to: now.toISOString().split("T")[0],
      search_partners: true,
      sort_by: "search_volume",
      include_adult_keywords: true,
    };

    console.log("REQUEST:", JSON.stringify(requestPayload, null, 2));

    const response = await fetch(`${DATAFORSEO_API_URL}/keywords_data/google_ads/keywords_for_site/live`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([requestPayload]),
    });

    const data = await response.json();

    console.log("RESPONSE STATUS:", response.status);
    console.log("Status code:", data?.tasks?.[0]?.status_code);
    console.log("Status message:", data?.tasks?.[0]?.status_message);

    const items = data?.tasks?.[0]?.result?.[0]?.items;
    const itemsCount = data?.tasks?.[0]?.result?.[0]?.items_count;

    console.log("Items count:", itemsCount);
    console.log("Items is null:", items === null);
    console.log("Items is array:", Array.isArray(items));

    if (Array.isArray(items) && items.length > 0) {
      console.log(`✅ FOUND ${items.length} KEYWORDS with Google Ads API!`);
      console.log("First 5 keywords:", items.slice(0, 5).map((item: any) => ({
        keyword: item.keyword,
        search_volume: item.search_volume,
        competition: item.competition,
        cpc: item.cpc,
      })));
    } else {
      console.log("❌ NO KEYWORDS returned!");
      console.log("Full response:", JSON.stringify(data, null, 2));
    }

    return {
      success: Array.isArray(items) && items.length > 0,
      itemsCount: Array.isArray(items) ? items.length : 0,
      hasItems: !!items && items !== null,
      firstKeywords: Array.isArray(items) ? items.slice(0, 5).map((item: any) => ({
        keyword: item.keyword,
        search_volume: item.search_volume,
      })) : [],
    };
  },
});
