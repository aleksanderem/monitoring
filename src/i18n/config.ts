export const locales = ["en", "pl", "de", "es", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
    en: "English",
    pl: "Polski",
    de: "Deutsch",
    es: "Español",
    fr: "Français",
};

export const localeFlags: Record<Locale, string> = {
    en: "GB",
    pl: "PL",
    de: "DE",
    es: "ES",
    fr: "FR",
};
