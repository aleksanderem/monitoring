import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { auth } from "./auth";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SubScore {
  id: string;
  label: string;
  score: number;
  weight: number;
  status: "good" | "warning" | "critical" | "no_data";
  explanation: string;
}

interface AxisResult {
  score: number;
  subScores: SubScore[];
  coverage: number; // 0-1
}

interface PageScoreResult {
  composite: number;
  grade: string;
  technical: { score: number; subScores: SubScore[] };
  content: { score: number; subScores: SubScore[] };
  seoPerformance: { score: number; subScores: SubScore[] };
  strategic: { score: number; subScores: SubScore[] };
  scoredAt: number;
  dataCompleteness: number;
}

interface KeywordWithPosition {
  phrase: string;
  intent?: "commercial" | "informational" | "navigational" | "transactional";
  searchVolume?: number;
  difficulty?: number;
  position: number | null;
  url?: string;
}

type PageData = Doc<"domainOnsitePages">;
type BacklinkData = Doc<"domainBacklinks">;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const COMPOSITE_WEIGHTS = {
  technical: 0.10,
  content: 0.35,
  seoPerformance: 0.35,
  strategic: 0.20,
};

const BATCH_SIZE = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function status(score: number, hasData: boolean): SubScore["status"] {
  if (!hasData) return "no_data";
  if (score >= 70) return "good";
  if (score >= 40) return "warning";
  return "critical";
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function weightedAverage(items: { value: number; weight: number }[]): number {
  if (items.length === 0) return 0;
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  if (totalWeight === 0) return 0;
  return items.reduce((s, i) => s + i.value * i.weight, 0) / totalWeight;
}

function computeAxisScore(subScores: SubScore[]): { score: number; coverage: number } {
  const available = subScores.filter((s) => s.status !== "no_data");
  if (available.length === 0) return { score: 0, coverage: 0 };

  const totalAvailableWeight = available.reduce((s, ss) => s + ss.weight, 0);
  const totalWeight = subScores.reduce((s, ss) => s + ss.weight, 0);
  const coverageRatio = totalAvailableWeight / totalWeight;

  // Weighted average of available sub-scores (redistribute weights)
  const raw = available.reduce((s, ss) => s + ss.score * ss.weight, 0) / totalAvailableWeight;

  // Coverage penalty: score * (0.5 + 0.5 * coverageRatio)
  const penalized = raw * (0.5 + 0.5 * coverageRatio);

  return { score: clamp(penalized), coverage: coverageRatio };
}

export function normalizeUrlForMatching(url: string): string {
  let n = url.toLowerCase().trim();
  n = n.replace(/^https?:\/\//, "");
  n = n.replace(/^www\./, "");
  n = n.replace(/\/$/, "");
  n = n.replace(/#.*$/, "");
  return n;
}

function scoreToGrade(composite: number): string {
  if (composite >= 90) return "A";
  if (composite >= 80) return "B";
  if (composite >= 70) return "C";
  if (composite >= 50) return "D";
  return "F";
}

// ─────────────────────────────────────────────────────────────────────────────
// Axis 1: Technical Health
// ─────────────────────────────────────────────────────────────────────────────

function scoreCWVVital(metric: string, value: number): number {
  switch (metric) {
    case "lcp": return value <= 2500 ? 100 : value <= 4000 ? 50 : 0;
    case "cls": return value <= 0.1 ? 100 : value <= 0.25 ? 50 : 0;
    case "fid": return value <= 100 ? 100 : value <= 300 ? 50 : 0;
    case "tti": return value <= 3800 ? 100 : value <= 7300 ? 50 : 0;
    default: return 50;
  }
}

export function scoreTechnicalHealth(page: PageData): AxisResult {
  const subScores: SubScore[] = [];

  // T1: Lighthouse Performance (30%)
  const perfScore = page.lighthouseScores?.performance;
  subScores.push({
    id: "T1", label: "Lighthouse Performance", weight: 0.30,
    score: perfScore ?? 0,
    status: status(perfScore ?? 0, perfScore != null),
    explanation: perfScore != null
      ? `Performance score: ${perfScore}/100`
      : "No PageSpeed Insights data available",
  });

  // T2: Core Web Vitals (25%)
  const cwv = page.coreWebVitals;
  let cwvScore = 0;
  let cwvExplanation = "No Core Web Vitals data";
  let cwvHasData = false;
  if (cwv) {
    cwvHasData = true;
    const vitals: { name: string; metric: string; value: number }[] = [];
    if (cwv.largestContentfulPaint != null) vitals.push({ name: "LCP", metric: "lcp", value: cwv.largestContentfulPaint });
    if (cwv.firstInputDelay != null) vitals.push({ name: "FID", metric: "fid", value: cwv.firstInputDelay });
    if (cwv.timeToInteractive != null) vitals.push({ name: "TTI", metric: "tti", value: cwv.timeToInteractive });
    if (cwv.cumulativeLayoutShift != null) vitals.push({ name: "CLS", metric: "cls", value: cwv.cumulativeLayoutShift });

    if (vitals.length > 0) {
      const scores = vitals.map((v) => scoreCWVVital(v.metric, v.value));
      cwvScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const labels = vitals.map((v, i) => `${v.name}: ${scores[i] >= 70 ? "good" : scores[i] >= 40 ? "needs improvement" : "poor"}`);
      cwvExplanation = labels.join(", ");
    }
  }
  subScores.push({
    id: "T2", label: "Core Web Vitals", weight: 0.25,
    score: cwvScore, status: status(cwvScore, cwvHasData),
    explanation: cwvExplanation,
  });

  // T3: Lighthouse SEO (15%)
  const seoScore = page.lighthouseScores?.seo;
  subScores.push({
    id: "T3", label: "Lighthouse SEO", weight: 0.15,
    score: seoScore ?? 0,
    status: status(seoScore ?? 0, seoScore != null),
    explanation: seoScore != null ? `SEO score: ${seoScore}/100` : "No PSI data",
  });

  // T4: Lighthouse Accessibility (10%)
  const a11yScore = page.lighthouseScores?.accessibility;
  subScores.push({
    id: "T4", label: "Accessibility", weight: 0.10,
    score: a11yScore ?? 0,
    status: status(a11yScore ?? 0, a11yScore != null),
    explanation: a11yScore != null ? `Accessibility score: ${a11yScore}/100` : "No PSI data",
  });

  // T5: Lighthouse Best Practices (5%)
  const bpScore = page.lighthouseScores?.bestPractices;
  subScores.push({
    id: "T5", label: "Best Practices", weight: 0.05,
    score: bpScore ?? 0,
    status: status(bpScore ?? 0, bpScore != null),
    explanation: bpScore != null ? `Best practices: ${bpScore}/100` : "No PSI data",
  });

  // T6: Page Security (5%)
  const isHttps = page.url.startsWith("https");
  subScores.push({
    id: "T6", label: "Page Security", weight: 0.05,
    score: isHttps ? 100 : 0,
    status: isHttps ? "good" : "critical",
    explanation: isHttps ? "HTTPS enabled" : "Not using HTTPS",
  });

  // T7: Resource Health (5%)
  const re = page.resourceErrors;
  let resourceScore = 70;
  let resourceExplanation = "No resource error data";
  let resourceHasData = false;
  if (re) {
    resourceHasData = true;
    resourceScore = clamp(100 - re.errorCount * 20 - re.warningCount * 5);
    resourceExplanation = re.errorCount === 0 && re.warningCount === 0
      ? "No resource errors"
      : `${re.errorCount} errors, ${re.warningCount} warnings`;
  }
  subScores.push({
    id: "T7", label: "Resource Health", weight: 0.05,
    score: resourceScore, status: status(resourceScore, resourceHasData),
    explanation: resourceExplanation,
  });

  // T8: Cache Efficiency (5%)
  const cc = page.cacheControl;
  let cacheScore = 50;
  let cacheExplanation = "No cache data";
  let cacheHasData = false;
  if (cc) {
    cacheHasData = true;
    if (cc.cachable && cc.ttl >= 3600) {
      cacheScore = 100;
      cacheExplanation = `Cacheable, TTL ${Math.round(cc.ttl / 60)}min`;
    } else if (cc.cachable) {
      cacheScore = 50;
      cacheExplanation = `Cacheable but short TTL (${cc.ttl}s)`;
    } else {
      cacheScore = 20;
      cacheExplanation = "Not cacheable";
    }
  }
  subScores.push({
    id: "T8", label: "Cache Efficiency", weight: 0.05,
    score: cacheScore, status: status(cacheScore, cacheHasData),
    explanation: cacheExplanation,
  });

  const { score, coverage } = computeAxisScore(subScores);
  return { score, subScores, coverage };
}

// ─────────────────────────────────────────────────────────────────────────────
// Axis 2: Content Quality
// ─────────────────────────────────────────────────────────────────────────────

function scoreContentDepth(wordCount: number): { score: number; explanation: string } {
  if (wordCount < 100) return { score: 10, explanation: `${wordCount} words (stub/thin page)` };
  if (wordCount < 300) return { score: 25, explanation: `${wordCount} words (thin content)` };
  if (wordCount < 600) return { score: 45, explanation: `${wordCount} words (below average)` };
  if (wordCount < 1000) return { score: 65, explanation: `${wordCount} words (adequate)` };
  if (wordCount < 1500) return { score: 80, explanation: `${wordCount} words (good depth)` };
  if (wordCount < 2500) return { score: 90, explanation: `${wordCount} words (comprehensive)` };
  return { score: 100, explanation: `${wordCount} words (deep content)` };
}

function scoreMetaTitle(title: string | undefined, keywords: KeywordWithPosition[]): { score: number; explanation: string } {
  if (!title) return { score: 0, explanation: "Missing page title" };
  const len = title.length;
  let base: number;
  let desc: string;
  if (len < 10) { base = 20; desc = `${len} chars (too short)`; }
  else if (len <= 30) { base = 60; desc = `${len} chars (short)`; }
  else if (len <= 60) { base = 100; desc = `${len} chars (optimal)`; }
  else if (len <= 70) { base = 80; desc = `${len} chars (slightly long)`; }
  else { base = 50; desc = `${len} chars (will truncate)`; }

  const titleLower = title.toLowerCase();
  const hasKeyword = keywords.some((kw) => titleLower.includes(kw.phrase.toLowerCase()));
  if (hasKeyword) {
    base = Math.min(100, base + 10);
    desc += " + contains keyword";
  }
  return { score: base, explanation: desc };
}

function scoreHeadingStructure(htags: PageData["htags"], keywords: KeywordWithPosition[]): { score: number; explanation: string } {
  if (!htags) return { score: 0, explanation: "No heading data available" };

  let base = 0;
  const parts: string[] = [];

  const h1Count = htags.h1?.length ?? 0;
  if (h1Count === 1) { base += 40; parts.push("1 H1"); }
  else if (h1Count > 1) { base += 25; parts.push(`${h1Count} H1s (multiple)`); }
  else { parts.push("no H1"); }

  const h2Count = htags.h2?.length ?? 0;
  if (h2Count >= 2) { base += 30; parts.push(`${h2Count} H2s`); }
  else if (h2Count === 1) { base += 15; parts.push("1 H2"); }
  else { parts.push("no H2"); }

  const h3Count = htags.h3?.length ?? 0;
  if (h3Count > 0) { base += 20; parts.push(`${h3Count} H3s`); }
  else { base += 10; }

  // H1 keyword bonus
  if (h1Count > 0 && keywords.length > 0) {
    const h1Lower = htags.h1[0].toLowerCase();
    const hasKw = keywords.some((kw) => h1Lower.includes(kw.phrase.toLowerCase()));
    if (hasKw) {
      base = Math.min(100, base + 10);
      parts.push("H1 contains keyword");
    }
  }

  return { score: clamp(base), explanation: parts.join(", ") };
}

function scoreMetaDescription(desc: string | undefined): { score: number; explanation: string } {
  if (!desc) return { score: 0, explanation: "Missing meta description" };
  const len = desc.length;
  if (len < 50) return { score: 30, explanation: `${len} chars (too short)` };
  if (len <= 120) return { score: 80, explanation: `${len} chars (acceptable)` };
  if (len <= 160) return { score: 100, explanation: `${len} chars (optimal)` };
  if (len <= 200) return { score: 70, explanation: `${len} chars (slightly long)` };
  return { score: 40, explanation: `${len} chars (will truncate)` };
}

function scoreReadability(readability: PageData["readabilityScores"]): { score: number; explanation: string; hasData: boolean } {
  if (!readability) return { score: 50, explanation: "No readability data", hasData: false };
  const fk = readability.fleschKincaidIndex;
  let score: number;
  let level: string;
  if (fk <= 6) { score = 70; level = "very simple"; }
  else if (fk <= 9) { score = 100; level = "ideal for web"; }
  else if (fk <= 12) { score = 85; level = "acceptable"; }
  else if (fk <= 16) { score = 60; level = "academic level"; }
  else { score = 40; level = "too complex"; }
  return { score, explanation: `Flesch-Kincaid grade ${fk.toFixed(1)} (${level})`, hasData: true };
}

function scoreContentConsistency(cc: PageData["contentConsistency"]): { score: number; explanation: string; hasData: boolean } {
  if (!cc) return { score: 50, explanation: "No consistency data", hasData: false };
  const avg = (cc.titleToContent + cc.descriptionToContent) / 2;
  const score = clamp(Math.round(avg * 100));
  return {
    score,
    explanation: `Title match: ${(cc.titleToContent * 100).toFixed(0)}%, Description match: ${(cc.descriptionToContent * 100).toFixed(0)}%`,
    hasData: true,
  };
}

function scoreImageOptimization(page: PageData): { score: number; explanation: string } {
  const count = page.imagesCount ?? 0;
  if (count === 0) return { score: 60, explanation: "No images on page" };

  const missing = page.imagesMissingAlt ?? 0;
  const withAlt = count - missing;
  const altCoverage = withAlt / count;
  const baseScore = Math.round(altCoverage * 80);

  let bonus = 0;
  if (page.imageAlts) {
    const kwAlts = page.imageAlts.filter((img) => img.containsKeyword).length;
    bonus = Math.round((kwAlts / count) * 20);
  }

  const score = Math.min(100, baseScore + bonus);
  const parts = [`${withAlt}/${count} images have alt text`];
  if (bonus > 0) parts.push(`keyword in ${page.imageAlts!.filter((i) => i.containsKeyword).length} alts`);
  if (missing > 0) parts.push(`${missing} missing`);
  return { score, explanation: parts.join(", ") };
}

export function scoreContentQuality(page: PageData, keywords: KeywordWithPosition[]): AxisResult {
  const subScores: SubScore[] = [];

  // C1: Content Depth (25%)
  const c1 = scoreContentDepth(page.wordCount);
  subScores.push({
    id: "C1", label: "Content Depth", weight: 0.25,
    score: c1.score, status: status(c1.score, true),
    explanation: c1.explanation,
  });

  // C2: Meta Title Optimization (20%)
  const c2 = scoreMetaTitle(page.title, keywords);
  subScores.push({
    id: "C2", label: "Meta Title", weight: 0.20,
    score: c2.score, status: status(c2.score, true),
    explanation: c2.explanation,
  });

  // C3: Heading Structure (15%)
  const c3 = scoreHeadingStructure(page.htags, keywords);
  subScores.push({
    id: "C3", label: "Heading Structure", weight: 0.15,
    score: c3.score, status: status(c3.score, page.htags != null),
    explanation: c3.explanation,
  });

  // C4: Meta Description (10%)
  const c4 = scoreMetaDescription(page.metaDescription);
  subScores.push({
    id: "C4", label: "Meta Description", weight: 0.10,
    score: c4.score, status: status(c4.score, true),
    explanation: c4.explanation,
  });

  // C5: Readability (10%)
  const c5 = scoreReadability(page.readabilityScores);
  subScores.push({
    id: "C5", label: "Readability", weight: 0.10,
    score: c5.score, status: status(c5.score, c5.hasData),
    explanation: c5.explanation,
  });

  // C6: Content Consistency (10%)
  const c6 = scoreContentConsistency(page.contentConsistency);
  subScores.push({
    id: "C6", label: "Content Consistency", weight: 0.10,
    score: c6.score, status: status(c6.score, c6.hasData),
    explanation: c6.explanation,
  });

  // C7: Image Optimization (10%)
  const c7 = scoreImageOptimization(page);
  subScores.push({
    id: "C7", label: "Image Optimization", weight: 0.10,
    score: c7.score, status: status(c7.score, true),
    explanation: c7.explanation,
  });

  const { score, coverage } = computeAxisScore(subScores);
  return { score, subScores, coverage };
}

// ─────────────────────────────────────────────────────────────────────────────
// Axis 3: SEO Performance
// ─────────────────────────────────────────────────────────────────────────────

function positionScore(position: number | null): number {
  if (position == null || position <= 0) return 0;
  if (position === 1) return 100;
  if (position === 2) return 92;
  if (position === 3) return 85;
  if (position <= 5) return 70;
  if (position <= 10) return 55;
  if (position <= 15) return 35;
  if (position <= 20) return 25;
  if (position <= 50) return 15;
  if (position <= 100) return 5;
  return 0;
}

function volumeMultiplier(searchVolume: number | undefined): number {
  const vol = searchVolume ?? 0;
  if (vol <= 50) return 0.3;
  if (vol <= 200) return 0.5;
  if (vol <= 500) return 0.7;
  if (vol <= 1000) return 0.85;
  if (vol <= 5000) return 1.0;
  if (vol <= 10000) return 1.15;
  return 1.3;
}

function estimatedCTR(position: number | null): number {
  if (position == null || position <= 0) return 0;
  if (position === 1) return 0.276;
  if (position === 2) return 0.158;
  if (position === 3) return 0.110;
  if (position === 4) return 0.084;
  if (position === 5) return 0.063;
  if (position === 6) return 0.045;
  if (position === 7) return 0.035;
  if (position === 8) return 0.028;
  if (position === 9) return 0.024;
  if (position === 10) return 0.020;
  if (position <= 20) return 0.010;
  if (position <= 50) return 0.003;
  return 0.001;
}

function backlinkQuality(bl: BacklinkData): number {
  let base = 10;

  const dr = bl.domainFromRank ?? 0;
  if (dr >= 70) base += 40;
  else if (dr >= 50) base += 30;
  else if (dr >= 30) base += 20;
  else if (dr >= 10) base += 10;

  if (bl.dofollow) base *= 1.5;

  const spam = bl.backlink_spam_score ?? 0;
  if (spam >= 70) base *= 0.1;
  else if (spam >= 50) base *= 0.3;
  else if (spam >= 30) base *= 0.7;

  if (bl.semanticLocation && ["article", "main_content"].includes(bl.semanticLocation)) {
    base *= 1.2;
  }

  return Math.min(100, Math.round(base));
}

export function scoreSEOPerformance(
  page: PageData,
  keywords: KeywordWithPosition[],
  backlinks: BacklinkData[],
): AxisResult {
  const subScores: SubScore[] = [];

  // S1: Keyword Rankings (30%)
  let s1Score = 0;
  let s1Explanation = "No keywords ranking for this URL";
  if (keywords.length > 0) {
    const kwScores = keywords
      .map((kw) => positionScore(kw.position) * volumeMultiplier(kw.searchVolume))
      .sort((a, b) => b - a);
    const top5 = kwScores.slice(0, 5);
    s1Score = clamp(Math.round(top5.reduce((a, b) => a + b, 0) / Math.max(top5.length, 1)));
    const bestKw = keywords.sort((a, b) =>
      (positionScore(b.position) * volumeMultiplier(b.searchVolume)) -
      (positionScore(a.position) * volumeMultiplier(a.searchVolume))
    )[0];
    s1Explanation = `${keywords.length} keyword${keywords.length > 1 ? "s" : ""} ranking. Best: "${bestKw.phrase}" at #${bestKw.position ?? "N/A"}`;
  }
  subScores.push({
    id: "S1", label: "Keyword Rankings", weight: 0.30,
    score: s1Score, status: status(s1Score, true),
    explanation: s1Explanation,
  });

  // S2: Traffic Potential (20%)
  let estimatedTraffic = 0;
  for (const kw of keywords) {
    estimatedTraffic += (kw.searchVolume ?? 0) * estimatedCTR(kw.position);
  }
  const s2Score = estimatedTraffic <= 0
    ? 0
    : clamp(Math.round(20 * Math.log10(estimatedTraffic + 1)));
  const s2Explanation = estimatedTraffic > 0
    ? `Est. ${Math.round(estimatedTraffic)} monthly organic visits`
    : "No estimated traffic";
  subScores.push({
    id: "S2", label: "Traffic Potential", weight: 0.20,
    score: s2Score, status: status(s2Score, true),
    explanation: s2Explanation,
  });

  // S3: Backlink Authority (35%)
  let s3Score = 0;
  let s3Explanation = "No backlinks to this URL";
  if (backlinks.length > 0) {
    const blScores = backlinks.map((bl) => backlinkQuality(bl));
    const uniqueDomains = new Set(backlinks.map((bl) => bl.domainFrom).filter(Boolean)).size;
    const avgQuality = blScores.reduce((a, b) => a + b, 0) / blScores.length;
    const diversityBonus = Math.min(30, uniqueDomains * 3);
    s3Score = clamp(Math.round(avgQuality * 0.7 + diversityBonus));

    const dofollowCount = backlinks.filter((bl) => bl.dofollow).length;
    s3Explanation = `${backlinks.length} backlinks from ${uniqueDomains} domains (${dofollowCount} dofollow)`;
  }
  subScores.push({
    id: "S3", label: "Backlink Authority", weight: 0.35,
    score: s3Score, status: status(s3Score, true),
    explanation: s3Explanation,
  });

  // S4: Internal Link Equity (15%)
  const inbound = page.inboundLinksCount ?? 0;
  let s4Score: number;
  if (inbound === 0) s4Score = 5;
  else if (inbound <= 2) s4Score = 30;
  else if (inbound <= 5) s4Score = 50;
  else if (inbound <= 10) s4Score = 70;
  else if (inbound <= 20) s4Score = 85;
  else s4Score = 100;
  subScores.push({
    id: "S4", label: "Internal Link Equity", weight: 0.15,
    score: s4Score, status: status(s4Score, true),
    explanation: inbound === 0 ? "Orphan page (no internal links)" : `${inbound} internal links pointing here`,
  });

  const { score, coverage } = computeAxisScore(subScores);
  return { score, subScores, coverage };
}

// ─────────────────────────────────────────────────────────────────────────────
// Axis 4: Strategic Value
// ─────────────────────────────────────────────────────────────────────────────

function intentValue(intent: string | undefined): number {
  switch (intent) {
    case "transactional": return 100;
    case "commercial": return 85;
    case "informational": return 55;
    case "navigational": return 30;
    default: return 40;
  }
}

function competitiveScore(position: number | null, difficulty: number): number {
  if (position == null || position <= 0) return 20;

  if (difficulty <= 30) {
    if (position <= 10) return 100;
    if (position <= 30) return 80;
    if (position <= 50) return 60;
    return 40;
  }
  if (difficulty <= 60) {
    if (position <= 10) return 95;
    if (position <= 20) return 75;
    if (position <= 50) return 50;
    return 25;
  }
  // difficulty > 60
  if (position <= 10) return 100;
  if (position <= 20) return 70;
  if (position <= 50) return 40;
  return 15;
}

export function scoreStrategicValue(
  page: PageData,
  keywords: KeywordWithPosition[],
): AxisResult {
  const subScores: SubScore[] = [];

  // V1: Intent Alignment (40%)
  let v1Score = 30;
  let v1Explanation = "No keywords — strategic value unknown";
  if (keywords.length > 0) {
    v1Score = Math.round(weightedAverage(
      keywords.map((kw) => ({
        value: intentValue(kw.intent),
        weight: Math.max(kw.searchVolume ?? 0, 10),
      }))
    ));
    const intents = keywords.map((kw) => kw.intent).filter(Boolean);
    const primaryIntent = intents.length > 0
      ? [...intents].sort((a, b) =>
          intents.filter((i) => i === b).length - intents.filter((i) => i === a).length
        )[0]
      : "mixed";

    // Topical authority bonus for informational pages linking to commercial content
    if (primaryIntent === "informational" && (page.internalLinksCount ?? 0) >= 3) {
      v1Score = Math.min(100, v1Score + 15);
      v1Explanation = `Primary intent: ${primaryIntent} (topical authority builder, links to ${page.internalLinksCount} internal pages)`;
    } else {
      v1Explanation = `Primary intent: ${primaryIntent} (${keywords.length} keywords)`;
    }
  }
  subScores.push({
    id: "V1", label: "Intent Alignment", weight: 0.40,
    score: v1Score, status: status(v1Score, true),
    explanation: v1Explanation,
  });

  // V2: Search Volume Value (25%)
  const totalVolume = keywords.reduce((s, kw) => s + (kw.searchVolume ?? 0), 0);
  const v2Score = totalVolume <= 0
    ? 0
    : clamp(Math.round(20 * Math.log10(totalVolume + 1)));
  subScores.push({
    id: "V2", label: "Search Volume Value", weight: 0.25,
    score: v2Score, status: status(v2Score, true),
    explanation: totalVolume > 0
      ? `${totalVolume.toLocaleString()} total monthly search volume`
      : "No search volume data",
  });

  // V3: Competitive Position (20%)
  let v3Score = 20;
  let v3Explanation = "No keywords to assess competitive position";
  if (keywords.length > 0) {
    v3Score = Math.round(
      keywords.reduce((s, kw) => s + competitiveScore(kw.position, kw.difficulty ?? 50), 0) / keywords.length
    );
    const avgDifficulty = Math.round(keywords.reduce((s, kw) => s + (kw.difficulty ?? 50), 0) / keywords.length);
    v3Explanation = `Avg keyword difficulty: ${avgDifficulty}/100, position competitiveness score: ${v3Score}`;
  }
  subScores.push({
    id: "V3", label: "Competitive Position", weight: 0.20,
    score: v3Score, status: status(v3Score, true),
    explanation: v3Explanation,
  });

  // V4: Internal Hub Value (15%)
  const outgoing = page.internalLinksCount ?? 0;
  const incoming = page.inboundLinksCount ?? 0;
  const total = outgoing + incoming;
  let v4Score: number;
  if (total === 0) v4Score = 5;
  else if (total <= 5) v4Score = 25;
  else if (total <= 15) v4Score = 50;
  else if (total <= 30) v4Score = 75;
  else if (total <= 50) v4Score = 90;
  else v4Score = 100;
  subScores.push({
    id: "V4", label: "Internal Hub Value", weight: 0.15,
    score: v4Score, status: status(v4Score, true),
    explanation: `${incoming} inbound + ${outgoing} outbound internal links`,
  });

  const { score, coverage } = computeAxisScore(subScores);
  return { score, subScores, coverage };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Score Computation (pure, no DB)
// ─────────────────────────────────────────────────────────────────────────────

export function computeFullPageScore(
  page: PageData,
  keywords: KeywordWithPosition[],
  backlinks: BacklinkData[],
): PageScoreResult {
  // Edge case: error pages
  if (page.statusCode >= 400) {
    const emptyAxis = { score: 0, subScores: [] };
    return {
      composite: 0, grade: "F",
      technical: emptyAxis, content: emptyAxis,
      seoPerformance: emptyAxis, strategic: emptyAxis,
      scoredAt: Date.now(), dataCompleteness: 0,
    };
  }
  if (page.statusCode >= 300 && page.statusCode < 400) {
    const emptyAxis = { score: 0, subScores: [] };
    return {
      composite: 10, grade: "F",
      technical: emptyAxis, content: emptyAxis,
      seoPerformance: emptyAxis, strategic: emptyAxis,
      scoredAt: Date.now(), dataCompleteness: 0,
    };
  }

  const technical = scoreTechnicalHealth(page);
  const content = scoreContentQuality(page, keywords);
  const seo = scoreSEOPerformance(page, keywords, backlinks);
  const strategic = scoreStrategicValue(page, keywords);

  const composite = clamp(Math.round(
    COMPOSITE_WEIGHTS.technical * technical.score +
    COMPOSITE_WEIGHTS.content * content.score +
    COMPOSITE_WEIGHTS.seoPerformance * seo.score +
    COMPOSITE_WEIGHTS.strategic * strategic.score
  ));

  const avgCoverage = (
    technical.coverage * COMPOSITE_WEIGHTS.technical +
    content.coverage * COMPOSITE_WEIGHTS.content +
    seo.coverage * COMPOSITE_WEIGHTS.seoPerformance +
    strategic.coverage * COMPOSITE_WEIGHTS.strategic
  );

  return {
    composite,
    grade: scoreToGrade(composite),
    technical: { score: technical.score, subScores: technical.subScores },
    content: { score: content.score, subScores: content.subScores },
    seoPerformance: { score: seo.score, subScores: seo.subScores },
    strategic: { score: strategic.score, subScores: strategic.subScores },
    scoredAt: Date.now(),
    dataCompleteness: Math.round(avgCoverage * 100) / 100,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Computation Mutation (chunked scheduler)
// ─────────────────────────────────────────────────────────────────────────────

export const computePageScores = internalMutation({
  args: {
    domainId: v.id("domains"),
    offset: v.number(),
  },
  handler: async (ctx, args) => {
    const { domainId, offset } = args;

    // 1. Load pages batch
    const allPages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    const batch = allPages.slice(offset, offset + BATCH_SIZE);
    if (batch.length === 0) {
      // Last batch done — update aggregates
      await updateAggregates(ctx, domainId, allPages);
      return;
    }

    // 2. Load monitored keywords + discovered keywords (for intent data)
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    const discoveredKeywords = await ctx.db
      .query("discoveredKeywords")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    // Build intent lookup from discovered keywords (phrase → intent)
    const intentLookup = new Map<string, "commercial" | "informational" | "navigational" | "transactional">();
    for (const dk of discoveredKeywords) {
      if (dk.intent) {
        intentLookup.set(dk.keyword.toLowerCase(), dk.intent);
      }
    }

    // 3. Build keyword→URL map from denormalized data (zero per-keyword DB queries)
    const kwPositionMap = new Map<string, KeywordWithPosition[]>();

    for (const kw of keywords) {
      const url = kw.currentUrl;
      if (url) {
        const normUrl = normalizeUrlForMatching(url);
        const entry: KeywordWithPosition = {
          phrase: kw.phrase,
          intent: intentLookup.get(kw.phrase.toLowerCase()),
          searchVolume: kw.searchVolume,
          difficulty: kw.difficulty,
          position: kw.currentPosition ?? null,
          url,
        };
        const existing = kwPositionMap.get(normUrl) ?? [];
        existing.push(entry);
        kwPositionMap.set(normUrl, existing);
      }
    }

    // Also add discovered keywords that have URL data (broader coverage)
    for (const dk of discoveredKeywords) {
      if (dk.url) {
        const normUrl = normalizeUrlForMatching(dk.url);
        // Skip if already covered by a monitored keyword for same phrase+url
        const existing = kwPositionMap.get(normUrl) ?? [];
        if (!existing.some((e) => e.phrase.toLowerCase() === dk.keyword.toLowerCase())) {
          existing.push({
            phrase: dk.keyword,
            intent: dk.intent,
            searchVolume: dk.searchVolume,
            difficulty: dk.difficulty,
            position: dk.bestPosition,
            url: dk.url,
          });
          kwPositionMap.set(normUrl, existing);
        }
      }
    }

    // 4. Load all backlinks for domain
    const backlinks = await ctx.db
      .query("domainBacklinks")
      .withIndex("by_domain", (q) => q.eq("domainId", domainId))
      .collect();

    // Build backlink URL map
    const blMap = new Map<string, BacklinkData[]>();
    for (const bl of backlinks) {
      const normUrl = normalizeUrlForMatching(bl.urlTo);
      const existing = blMap.get(normUrl) ?? [];
      existing.push(bl);
      blMap.set(normUrl, existing);
    }

    // 5. Score each page in batch
    for (const page of batch) {
      const normUrl = normalizeUrlForMatching(page.url);
      const pageKeywords = kwPositionMap.get(normUrl) ?? [];
      const pageBacklinks = blMap.get(normUrl) ?? [];

      const result = computeFullPageScore(page, pageKeywords, pageBacklinks);

      await ctx.db.patch(page._id, { pageScore: result });
    }

    // 6. Schedule next batch if more pages remain
    if (offset + BATCH_SIZE < allPages.length) {
      await ctx.scheduler.runAfter(0, internal.pageScoring.computePageScores, {
        domainId,
        offset: offset + BATCH_SIZE,
      });
    } else {
      // Last batch — update aggregates
      // Re-fetch to get updated scores
      const scoredPages = await ctx.db
        .query("domainOnsitePages")
        .withIndex("by_domain", (q) => q.eq("domainId", domainId))
        .collect();
      await updateAggregates(ctx, domainId, scoredPages);
    }
  },
});

async function updateAggregates(
  ctx: any,
  domainId: Id<"domains">,
  pages: PageData[],
) {
  const scored = pages.filter((p) => p.pageScore != null);
  if (scored.length === 0) return;

  const composites = scored.map((p) => p.pageScore!.composite);
  const avg = Math.round(composites.reduce((a, b) => a + b, 0) / composites.length);

  const gradeDistribution = {
    A: scored.filter((p) => p.pageScore!.composite >= 90).length,
    B: scored.filter((p) => p.pageScore!.composite >= 80 && p.pageScore!.composite < 90).length,
    C: scored.filter((p) => p.pageScore!.composite >= 70 && p.pageScore!.composite < 80).length,
    D: scored.filter((p) => p.pageScore!.composite >= 50 && p.pageScore!.composite < 70).length,
    F: scored.filter((p) => p.pageScore!.composite < 50).length,
  };

  // Store on latest analysis record
  const latestAnalysis = await ctx.db
    .query("domainOnsiteAnalysis")
    .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
    .order("desc")
    .first();

  // Per-axis averages
  const axisAvg = (axis: "technical" | "content" | "seoPerformance" | "strategic") => {
    const vals = scored.map((p) => p.pageScore![axis]?.score).filter((v): v is number => v != null);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };
  const pageScoreAxes = {
    technical: axisAvg("technical"),
    content: axisAvg("content"),
    seoPerformance: axisAvg("seoPerformance"),
    strategic: axisAvg("strategic"),
  };

  if (latestAnalysis) {
    await ctx.db.patch(latestAnalysis._id, {
      avgPageScore: avg,
      pageScoreDistribution: gradeDistribution,
      pageScoreAxes,
      pageScoreScoredAt: Date.now(),
    });
  }

  console.log(`[PAGE_SCORING] Domain ${domainId}: scored ${scored.length} pages, avg=${avg}, axes=`, pageScoreAxes, `distribution=`, gradeDistribution);
}

// ─────────────────────────────────────────────────────────────────────────────
// Recompute aggregates only (no re-scoring) — for backfilling pageScoreAxes
// ─────────────────────────────────────────────────────────────────────────────

export const recomputeAggregatesOnly = internalMutation({
  args: { domainId: v.id("domains"), fixIssues: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("domainOnsitePages")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    await updateAggregates(ctx, args.domainId, pages);

    // Optionally recalculate issue counts and totalPages on the analysis record
    if (args.fixIssues) {
      const latestAnalysis = await ctx.db
        .query("domainOnsiteAnalysis")
        .withIndex("by_domain", (q: any) => q.eq("domainId", args.domainId))
        .order("desc")
        .first();
      if (latestAnalysis) {
        let criticalCount = 0;
        let warningCount = 0;
        let recommendationCount = 0;
        let totalScore = 0;
        let scoredPages = 0;
        let totalLoadTime = 0;
        let loadTimePages = 0;
        let totalWordCount = 0;
        let wordCountPages = 0;

        const issuesByCategory: Record<string, number> = {};
        for (const page of pages) {
          if (page.onpageScore != null) { totalScore += page.onpageScore; scoredPages++; }
          for (const issue of (page.issues || [])) {
            if (issue.type === "critical") criticalCount++;
            else if (issue.type === "warning") warningCount++;
            else recommendationCount++;
            issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
          }
          if (page.loadTime && page.loadTime > 0) { totalLoadTime += page.loadTime; loadTimePages++; }
          if (page.wordCount > 0) { totalWordCount += page.wordCount; wordCountPages++; }
        }

        const avgScore = scoredPages > 0 ? Math.round(totalScore / scoredPages) : latestAnalysis.healthScore;
        let grade: string;
        if (avgScore >= 90) grade = "A";
        else if (avgScore >= 80) grade = "B";
        else if (avgScore >= 70) grade = "C";
        else if (avgScore >= 50) grade = "D";
        else grade = "F";

        await ctx.db.patch(latestAnalysis._id, {
          totalPages: pages.length,
          pagesAnalyzed: pages.length,
          criticalIssues: criticalCount,
          warnings: warningCount,
          recommendations: recommendationCount,
          healthScore: avgScore,
          grade,
          avgLoadTime: loadTimePages > 0 ? Math.round((totalLoadTime / loadTimePages) * 100) / 100 : undefined,
          avgWordCount: wordCountPages > 0 ? Math.round(totalWordCount / wordCountPages) : undefined,
          issues: {
            missingTitles: issuesByCategory["meta_tags"] || 0,
            missingMetaDescriptions: issuesByCategory["meta_description"] || 0,
            duplicateContent: issuesByCategory["duplicate"] || 0,
            brokenLinks: issuesByCategory["links"] || 0,
            slowPages: issuesByCategory["performance"] || 0,
            suboptimalTitles: 0,
            thinContent: issuesByCategory["content"] || 0,
            missingH1: issuesByCategory["headings"] || 0,
            largeImages: issuesByCategory["images"] || 0,
            missingAltText: issuesByCategory["alt_text"] || 0,
            missingHttps: issuesByCategory["security"] || 0,
            missingCanonical: issuesByCategory["canonical"] || 0,
            missingRobotsMeta: issuesByCategory["robots"] || 0,
            notMobileFriendly: issuesByCategory["mobile"] || 0,
            lowTextToCodeRatio: issuesByCategory["text_ratio"] || 0,
            largeDomSize: issuesByCategory["dom_size"] || 0,
            tooManyElements: issuesByCategory["dom_elements"] || 0,
            highElementSimilarity: issuesByCategory["similarity"] || 0,
            missingStructuredData: issuesByCategory["structured_data"] || 0,
          },
        });

        console.log(`[RECOMPUTE] Domain ${args.domainId}: fixed issues: critical=${criticalCount}, warnings=${warningCount}, recs=${recommendationCount}, totalPages=${pages.length}, healthScore=${avgScore}, grade=${grade}`);
      }
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Manual rescore trigger (user-facing)
// ─────────────────────────────────────────────────────────────────────────────

export const triggerRescore = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.scheduler.runAfter(0, internal.pageScoring.computePageScores, {
      domainId: args.domainId,
      offset: 0,
    });

    return { success: true };
  },
});

