import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

export default getRequestConfig(async () => {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
    const locale: Locale =
        cookieLocale && locales.includes(cookieLocale as Locale)
            ? (cookieLocale as Locale)
            : defaultLocale;

    const namespaces = [
        "common",
        "auth",
        "nav",
        "keywords",
        "backlinks",
        "competitors",
        "onsite",
        "domains",
        "projects",
        "settings",
        "admin",
        "jobs",
        "share",
        "aiResearch",
        "strategy",
        "generators",
        "onboarding",
        "search",
        "agency",
    ];

    const messages: Record<string, any> = {};
    for (const ns of namespaces) {
        try {
            messages[ns] = (
                await import(`../messages/${locale}/${ns}.json`)
            ).default;
        } catch {
            // Namespace file doesn't exist yet, skip
        }
    }

    return {
        locale,
        messages,
    };
});
