// Direct comparison test: allegro.pl vs detoksvip.pl
import { internalAction } from "./_generated/server";

const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

export const compareResults = internalAction({
  args: {},
  handler: async (): Promise<any> => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      return { error: "No credentials" };
    }

    const authHeader = btoa(`${login}:${password}`);

    // Test with exact same parameters
    const testDomain = async (domain: string) => {
      console.log(`\n\n========== TESTING: ${domain} ==========`);

      const requestPayload = {
        target: domain,
        location_code: 2616,
        language_code: "pl",
        item_types: ['organic'],
        limit: 10,
      };

      console.log("REQUEST:", JSON.stringify(requestPayload, null, 2));

      const response = await fetch(`${DATAFORSEO_API_URL}/dataforseo_labs/google/ranked_keywords/live`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([requestPayload]),
      });

      const data = await response.json();

      console.log("RESPONSE STATUS:", response.status);
      console.log("Status code:", data.status_code);
      console.log("Status message:", data.status_message);

      const items = data?.tasks?.[0]?.result?.[0]?.items;
      const itemsCount = data?.tasks?.[0]?.result?.[0]?.items_count;
      const totalCount = data?.tasks?.[0]?.result?.[0]?.total_count;

      console.log("Items count:", itemsCount);
      console.log("Total count:", totalCount);
      console.log("Items is null:", items === null);
      console.log("Items is array:", Array.isArray(items));

      if (Array.isArray(items) && items.length > 0) {
        console.log(`Found ${items.length} keywords!`);
        console.log("First 3 keywords:", items.slice(0, 3).map((item: any) => ({
          keyword: item?.keyword_data?.keyword,
          position: item?.ranked_serp_element?.serp_item?.rank_absolute,
          url: item?.ranked_serp_element?.serp_item?.url,
        })));
      } else {
        console.log("NO ITEMS RETURNED!");
        console.log("Full result object:", JSON.stringify(data?.tasks?.[0]?.result?.[0], null, 2));
      }

      return {
        domain,
        itemsCount: Array.isArray(items) ? items.length : 0,
        isNull: items === null,
        totalCount,
      };
    };

    // Test both domains
    const allegro = await testDomain("allegro.pl");
    const detoks = await testDomain("detoksvip.pl");

    console.log("\n\n========== COMPARISON SUMMARY ==========");
    console.log("allegro.pl:", allegro);
    console.log("detoksvip.pl:", detoks);

    return {
      allegro,
      detoks,
      areResultsDifferent: allegro.itemsCount !== detoks.itemsCount,
    };
  },
});
