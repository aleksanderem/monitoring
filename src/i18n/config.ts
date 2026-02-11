export const locales = ["en", "pl"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
    en: "English",
    pl: "Polski",
};

export const localeFlags: Record<Locale, string> = {
    en: "GB",
    pl: "PL",
};
