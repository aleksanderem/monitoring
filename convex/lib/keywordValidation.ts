/**
 * Keyword phrase validation — rejects obviously bad phrases
 * before they reach DataForSEO API calls.
 */
export function isValidKeywordPhrase(phrase: string): { valid: boolean; reason?: string } {
  const trimmed = phrase.trim();

  if (trimmed.length < 2) {
    return { valid: false, reason: "Phrase too short (min 2 characters)" };
  }

  if (trimmed.length > 80) {
    return { valid: false, reason: "Phrase too long (max 80 characters)" };
  }

  // Pure URL
  if (/^https?:\/\//i.test(trimmed)) {
    return { valid: false, reason: "Phrase looks like a URL" };
  }

  // Domain-like string with no spaces (e.g. "example.com/page")
  if (/^[a-z0-9-]+\.[a-z]{2,}(\/\S*)?$/i.test(trimmed) && !trimmed.includes(" ")) {
    return { valid: false, reason: "Phrase looks like a domain/URL" };
  }

  // Pure numbers
  if (/^\d+$/.test(trimmed)) {
    return { valid: false, reason: "Phrase is just numbers" };
  }

  // Excessive special characters (>30% non-alphanumeric, excluding spaces)
  const nonAlphaNum = trimmed.replace(/[a-z0-9\s]/gi, "").length;
  const nonSpaceLength = trimmed.replace(/\s/g, "").length;
  if (nonSpaceLength > 0 && nonAlphaNum / nonSpaceLength > 0.3) {
    return { valid: false, reason: "Phrase has too many special characters" };
  }

  // Repeated single characters (like "a a a a a")
  const words = trimmed.split(/\s+/);
  if (words.length >= 3 && words.every((w) => w.length === 1)) {
    return { valid: false, reason: "Phrase is just single repeated characters" };
  }

  return { valid: true };
}
