/**
 * Test fixtures for backlink-related data.
 * Shapes match api.backlinks.* and api.backlinkVelocity.* return types.
 */

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

// api.backlinks.getBacklinkSummary
export const BACKLINK_SUMMARY = {
  _id: "bl_summary_1" as any,
  domainId: "domain_active_1" as any,
  totalBacklinks: 1247,
  totalDomains: 89,
  totalIps: 76,
  totalSubnets: 52,
  dofollow: 987,
  nofollow: 260,
  fetchedAt: now - 2 * day,
};

export const BACKLINK_SUMMARY_EMPTY = null;

// api.backlinks.getBacklinkDistributions
export const BACKLINK_DISTRIBUTIONS = {
  tldDistribution: { ".com": 452, ".org": 89, ".net": 34, ".io": 67, ".co.uk": 23 },
  platformTypes: { blog: 312, news: 145, forum: 89, social: 67, directory: 52 },
  countries: { US: 389, UK: 156, DE: 98, FR: 67, PL: 45 },
  linkTypes: { text: 876, image: 234, redirect: 89, canonical: 48 },
  linkAttributes: { dofollow: 987, nofollow: 260 },
  semanticLocations: { article: 534, sidebar: 267, footer: 189, header: 123, nav: 134 },
};

// api.backlinkVelocity.getVelocityHistory
export const VELOCITY_HISTORY = Array.from({ length: 30 }, (_, i) => ({
  _id: `vel_${i}` as any,
  domainId: "domain_active_1" as any,
  date: new Date(now - (29 - i) * day).toISOString().split("T")[0],
  newBacklinks: Math.floor(Math.random() * 15) + 2,
  lostBacklinks: Math.floor(Math.random() * 5),
  netChange: Math.floor(Math.random() * 12) - 2,
  totalBacklinks: 1200 + i * 3,
  createdAt: now - (29 - i) * day,
}));

// api.backlinkVelocity.getVelocityStats
export const VELOCITY_STATS = {
  avgNewPerDay: 8.3,
  avgLostPerDay: 2.1,
  avgNetChange: 6.2,
  totalNew: 249,
  totalLost: 63,
  netChange: 186,
  daysTracked: 30,
};

// Individual backlinks for table
export const BACKLINKS_LIST = [
  {
    _id: "bl_1" as any,
    domainId: "domain_active_1" as any,
    sourceUrl: "https://blog.techsite.com/best-seo-tools-2025",
    sourceDomain: "techsite.com",
    targetUrl: "https://example.com/seo-tools",
    anchorText: "best seo tools",
    linkType: "text",
    isDofollow: true,
    firstSeen: now - 15 * day,
    lastSeen: now - 1 * day,
    domainRank: 72,
    pageRank: 45,
  },
  {
    _id: "bl_2" as any,
    domainId: "domain_active_1" as any,
    sourceUrl: "https://forum.seoexperts.org/threads/tools-review",
    sourceDomain: "seoexperts.org",
    targetUrl: "https://example.com/",
    anchorText: "example.com",
    linkType: "text",
    isDofollow: false,
    firstSeen: now - 30 * day,
    lastSeen: now - 3 * day,
    domainRank: 58,
    pageRank: 32,
  },
  {
    _id: "bl_3" as any,
    domainId: "domain_active_1" as any,
    sourceUrl: "https://news.marketing.co.uk/digital-roundup",
    sourceDomain: "marketing.co.uk",
    targetUrl: "https://example.com/seo-tools",
    anchorText: "",
    linkType: "image",
    isDofollow: true,
    firstSeen: now - 5 * day,
    lastSeen: now - 1 * day,
    domainRank: 65,
    pageRank: 38,
  },
];

// Stale data indicator
export const BACKLINK_SUMMARY_STALE = {
  ...BACKLINK_SUMMARY,
  fetchedAt: now - 31 * day,
};
