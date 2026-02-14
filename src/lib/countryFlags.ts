/**
 * Maps country location names (as stored in domain.settings.location) to ISO 3166-1 alpha-2 codes.
 * Used to render flag emojis via regional indicator symbols.
 */
const COUNTRY_ISO: Record<string, string> = {
  "Poland": "PL",
  "United States": "US",
  "United Kingdom": "GB",
  "Germany": "DE",
  "France": "FR",
  "Spain": "ES",
  "Italy": "IT",
  "Netherlands": "NL",
  "Canada": "CA",
  "Australia": "AU",
  "Brazil": "BR",
  "Japan": "JP",
  "India": "IN",
  "Mexico": "MX",
  "Sweden": "SE",
  "Norway": "NO",
  "Denmark": "DK",
  "Finland": "FI",
  "Czech Republic": "CZ",
  "Austria": "AT",
  "Switzerland": "CH",
  "Belgium": "BE",
  "Portugal": "PT",
  "Ireland": "IE",
  "Romania": "RO",
  "Hungary": "HU",
  "Turkey": "TR",
  "South Korea": "KR",
  "Argentina": "AR",
  "Chile": "CL",
  "Colombia": "CO",
  "Ukraine": "UA",
  "Thailand": "TH",
  "Indonesia": "ID",
  "Philippines": "PH",
  "Vietnam": "VN",
  "Malaysia": "MY",
  "Singapore": "SG",
  "New Zealand": "NZ",
  "South Africa": "ZA",
  "Israel": "IL",
  "United Arab Emirates": "AE",
  "Saudi Arabia": "SA",
  "Greece": "GR",
  "Croatia": "HR",
  "Slovakia": "SK",
  "Bulgaria": "BG",
  "Lithuania": "LT",
  "Latvia": "LV",
  "Estonia": "EE",
  "Slovenia": "SI",
};

/**
 * Maps language codes to a representative country ISO code for flag display.
 */
const LANGUAGE_FLAG: Record<string, string> = {
  "pl": "PL",
  "en": "GB",
  "de": "DE",
  "fr": "FR",
  "es": "ES",
  "it": "IT",
  "nl": "NL",
  "pt": "PT",
  "ja": "JP",
  "ko": "KR",
  "zh": "CN",
  "ru": "RU",
  "uk": "UA",
  "cs": "CZ",
  "sk": "SK",
  "hu": "HU",
  "ro": "RO",
  "bg": "BG",
  "hr": "HR",
  "sl": "SI",
  "lt": "LT",
  "lv": "LV",
  "et": "EE",
  "fi": "FI",
  "sv": "SE",
  "no": "NO",
  "da": "DK",
  "el": "GR",
  "tr": "TR",
  "ar": "SA",
  "he": "IL",
  "hi": "IN",
  "th": "TH",
  "id": "ID",
  "ms": "MY",
  "vi": "VN",
  "tl": "PH",
};

/** Convert an ISO 3166-1 alpha-2 code to a flag emoji using regional indicator symbols. */
function isoToFlag(iso: string): string {
  return [...iso.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
}

/** Get flag emoji for a country location name (e.g. "Poland" → "🇵🇱"). */
export function getCountryFlag(locationName: string): string {
  const iso = COUNTRY_ISO[locationName];
  return iso ? isoToFlag(iso) : "";
}

/** Get flag emoji for a language code (e.g. "pl" → "🇵🇱", "en" → "🇬🇧"). */
export function getLanguageFlag(languageCode: string): string {
  const iso = LANGUAGE_FLAG[languageCode];
  return iso ? isoToFlag(iso) : "";
}
