import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";

// ─── Logo Utility ─────────────────────────────────────────────────

async function svgToPngDataUri(svgPath: string, displayWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new (globalThis as any).Image() as HTMLImageElement;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Render at 3x display size for crisp PDF output
      const natW = img.naturalWidth || displayWidth;
      const natH = img.naturalHeight || Math.round(displayWidth / 3);
      const ratio = natH / natW;
      const w = displayWidth * 3;
      const h = Math.round(w * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load logo SVG"));
    img.src = svgPath;
  });
}

// ─── Font Registration ────────────────────────────────────────────
// Stack: Inter, Roboto (fallback), system sans-serif
// react-pdf only supports explicitly registered fonts — no system fonts

Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf",
      fontWeight: 600,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf",
      fontWeight: 700,
    },
  ],
});

Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuaabWmT.ttf",
      fontWeight: 700,
    },
  ],
});

// ─── Styles ─────────────────────────────────────────────────────

// Design system tokens from src/theme.css
const colors = {
  primary: "#181D27",      // text-primary (gray-900)
  secondary: "#414651",    // text-secondary (gray-700)
  tertiary: "#535862",     // text-tertiary (gray-600)
  quaternary: "#717680",   // text-quaternary (gray-500)
  brand: "#7F56D9",        // brand-600
  brandLight: "#F9F5FF",   // brand-50
  brand100: "#F4EBFF",     // brand-100
  brand500: "#9E77ED",     // brand-500
  success: "#079455",      // success-600
  successLight: "#ECFDF3", // success-50
  success500: "#17B26A",   // success-500
  warning: "#DC6803",      // warning-600
  warningLight: "#FFFAEB", // warning-50
  warning500: "#F79009",   // warning-500
  error: "#D92D20",        // error-600
  errorLight: "#FEF3F2",   // error-50
  error500: "#F04438",     // error-500
  border: "#D5D7DA",       // border-primary (gray-300)
  borderLight: "#E9EAEB",  // border-secondary (gray-200)
  bg: "#FFFFFF",           // white
  bgMuted: "#FAFAFA",      // bg-secondary (gray-50)
  bgTertiary: "#F5F5F5",   // bg-tertiary (gray-100)
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Inter",
    color: colors.primary,
    backgroundColor: colors.bg,
  },
  // Cover
  coverPage: {
    padding: 40,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: "Inter", fontWeight: 700,
    color: colors.brand,
    marginBottom: 12,
    textAlign: "center",
  },
  coverDomain: {
    fontSize: 20,
    fontFamily: "Inter", fontWeight: 700,
    color: colors.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  coverDate: {
    fontSize: 12,
    fontFamily: "Inter",
    color: colors.secondary,
    textAlign: "center",
  },
  coverScore: {
    fontSize: 64,
    fontFamily: "Inter", fontWeight: 700,
    marginTop: 40,
    textAlign: "center",
  },
  coverScoreLabel: {
    fontSize: 14,
    fontFamily: "Inter",
    color: colors.secondary,
    textAlign: "center",
    marginTop: 4,
  },
  // Sections
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter", fontWeight: 700,
    color: colors.brand,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: colors.brand,
  },
  subsectionTitle: {
    fontSize: 12,
    fontFamily: "Inter", fontWeight: 700,
    color: colors.primary,
    marginBottom: 6,
    marginTop: 10,
  },
  // Metrics
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  metricBox: {
    flex: 1,
    padding: 10,
    backgroundColor: colors.bgMuted,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricValue: {
    fontSize: 18,
    fontFamily: "Inter", fontWeight: 700,
    color: colors.primary,
  },
  metricLabel: {
    fontSize: 8,
    fontFamily: "Inter",
    color: colors.secondary,
    marginTop: 2,
  },
  // Table
  table: {
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.bgMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 6,
  },
  tableCell: {
    fontSize: 9,
    fontFamily: "Inter",
    color: colors.primary,
    lineHeight: 1.5,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Inter", fontWeight: 700,
    color: colors.secondary,
    textTransform: "uppercase",
  },
  // Bar chart
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  barLabel: {
    width: 80,
    fontSize: 9,
    fontFamily: "Inter",
    color: colors.secondary,
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: colors.bgMuted,
    borderRadius: 2,
  },
  barFill: {
    height: 12,
    borderRadius: 2,
  },
  barValue: {
    width: 40,
    fontSize: 9,
    fontFamily: "Inter",
    color: colors.primary,
    textAlign: "right",
  },
  // Recommendations
  recItem: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recPriority: {
    width: 50,
    fontSize: 8,
    fontFamily: "Inter", fontWeight: 700,
    textTransform: "uppercase",
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 2,
    textAlign: "center",
  },
  text: {
    fontSize: 10,
    fontFamily: "Inter",
    color: colors.primary,
    lineHeight: 1.5,
  },
  textBold: {
    fontSize: 10,
    fontFamily: "Inter", fontWeight: 700,
    color: colors.primary,
    lineHeight: 1.5,
  },
  textSmall: {
    fontSize: 9,
    fontFamily: "Inter",
    color: colors.secondary,
    lineHeight: 1.4,
  },
  textSmallBold: {
    fontSize: 9,
    fontFamily: "Inter", fontWeight: 600,
    color: colors.primary,
    lineHeight: 1.4,
  },
  label: {
    fontSize: 8,
    fontFamily: "Inter", fontWeight: 700,
    color: colors.tertiary,
    textTransform: "uppercase" as const,
  },
  labelBrand: {
    fontSize: 8,
    fontFamily: "Inter", fontWeight: 700,
    color: colors.brand,
  },
  caption: {
    fontSize: 8,
    fontFamily: "Inter",
    color: colors.secondary,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    fontFamily: "Inter",
    color: colors.tertiary,
    textAlign: "center",
  },
});

// ─── Helper Components ──────────────────────────────────────────

function MetricBox({ value, label, valueColor }: { value: string | number | null | undefined; label: string; valueColor?: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={valueColor ? [styles.metricValue, { color: valueColor }] : styles.metricValue}>{String(value ?? "—")}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function HorizontalBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const safeValue = value ?? 0;
  const percentage = max > 0 ? Math.min((safeValue / max) * 100, 100) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{String(safeValue)}</Text>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const bgColor = priority === "high" ? colors.errorLight : priority === "medium" ? colors.warningLight : colors.bgMuted;
  const textColor = priority === "high" ? colors.error : priority === "medium" ? colors.warning : colors.secondary;
  return (
    <Text style={[styles.recPriority, { backgroundColor: bgColor, color: textColor }]}>
      {priority}
    </Text>
  );
}

function PageFooter() {
  return (
    <Text
      style={styles.footer}
      render={({ pageNumber, totalPages }) =>
        `Strona ${pageNumber} z ${totalPages} — Wygenerowane przez DOSEO.app | by Alex M.`
      }
    />
  );
}

function DseoLogo({ src }: { src?: string }) {
  if (!src) return null;
  return (
    <View style={{ alignItems: "center", marginBottom: 30 }}>
      <Image src={src} style={{ width: 160 }} />
    </View>
  );
}

function TocEntry({ number, title }: { number: string; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter", fontWeight: 700, color: colors.brand, width: 32 }}>{number}</Text>
      <Text style={{ fontSize: 13, fontFamily: "Inter", color: colors.primary, flex: 1 }}>{title}</Text>
    </View>
  );
}

// ─── Report Profiles ─────────────────────────────────────────────

import {
  type ReportProfile,
  type ReportConfig,
  SECTION_REGISTRY,
  PRESET_PROFILES,
  configFromPreset,
  resolveConfig,
} from "./reportSections";

export type { ReportProfile };

const TOC_LABELS: Record<string, string> = {
  executive: "Podsumowanie wykonawcze",
  keywords: "Słowa kluczowe",
  backlinks: "Linki zwrotne",
  contentGaps: "Luki w treści i konkurenci",
  onsite: "SEO on-site",
  linkBuilding: "Link building",
  recommendations: "Rekomendacje",
};

// ─── Report Document ────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function SEOReportDocument({ data, domainName, logoSrc, reportConfig }: { data: any; domainName: string; logoSrc?: string; reportConfig: ReportConfig }) {
  const reportDate = new Date(data.generatedAt).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const scoreColor = (data.healthScore?.total ?? 0) >= 70
    ? colors.success
    : (data.healthScore?.total ?? 0) >= 40
      ? colors.warning
      : colors.error;

  const { orderedSections, enabledSections, subElements } = resolveConfig(reportConfig);
  const sub = (section: string, element: string) => subElements[section]?.[element] !== false;

  return (
    <Document>
      {/* ── Cover Page ─────────────────────────────────────── */}
      <Page size="A4" style={styles.coverPage}>
        <DseoLogo src={logoSrc} />
        <Text style={styles.coverTitle}>Raport SEO</Text>
        <Text style={styles.coverDomain}>{domainName}</Text>
        <Text style={styles.coverDate}>{reportDate}</Text>
        {data.healthScore && (
          <>
            <Text style={[styles.coverScore, { color: scoreColor }]}>
              {data.healthScore.total}
            </Text>
            <Text style={styles.coverScoreLabel}>Wynik zdrowia / 100</Text>
          </>
        )}
      </Page>

      {/* ── Table of Contents ──────────────────────────────── */}
      {enabledSections.has("toc") && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spis treści</Text>
            {orderedSections.filter(id => enabledSections.has(id) && TOC_LABELS[id]).map((id, i) => (
              <TocEntry key={id} number={`${i + 1}.`} title={TOC_LABELS[id]} />
            ))}
          </View>
          <PageFooter />
        </Page>
      )}

      {/* ── Summary Page ───────────────────────────────────── */}
      {enabledSections.has("executive") && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Podsumowanie wykonawcze</Text>

            {sub("executive", "healthBreakdown") && data.healthScore?.breakdown && (
              <>
                <Text style={styles.subsectionTitle}>Rozkład wyniku zdrowia</Text>
                <View style={{ marginBottom: 10 }}>
                  <HorizontalBar label="Słowa kluczowe" value={data.healthScore.breakdown.keywords?.score ?? 0} max={30} color={colors.brand} />
                  <HorizontalBar label="Linki zwrotne" value={data.healthScore.breakdown.backlinks?.score ?? 0} max={30} color={colors.brand500} />
                  <HorizontalBar label="On-Site" value={data.healthScore.breakdown.onsite?.score ?? 0} max={20} color={colors.warning500} />
                  <HorizontalBar label="Treść" value={data.healthScore.breakdown.content?.score ?? 0} max={20} color={colors.success500} />
                </View>
              </>
            )}

            {sub("executive", "keyMetrics") && (
              <>
                <Text style={styles.subsectionTitle}>Kluczowe wskaźniki</Text>
                <View style={styles.metricsRow}>
                  <MetricBox value={data.keywords?.total ?? 0} label="Aktywne słowa kl." />
                  <MetricBox value={data.keywords?.avgPosition ?? "N/A"} label="Śr. pozycja" />
                  <MetricBox value={data.backlinks?.summary?.totalBacklinks ?? 0} label="Łączne linki zwrotne" />
                  <MetricBox value={data.backlinks?.summary?.totalDomains ?? 0} label="Domeny odsyłające" />
                </View>
                <View style={styles.metricsRow}>
                  <MetricBox value={data.contentGaps?.total ?? 0} label="Luki w treści" />
                  <MetricBox value={data.competitors?.active ?? 0} label="Aktywni konkurenci" />
                  <MetricBox value={data.linkBuilding?.activeProspects ?? 0} label="Perspektywy linkowe" />
                  <MetricBox value={data.keywords?.discoveredTotal ?? 0} label="Odkryte słowa kl." />
                </View>
              </>
            )}
          </View>

          <PageFooter />
        </Page>
      )}

      {/* ── Keywords Page ──────────────────────────────────── */}
      {enabledSections.has("keywords") && (
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Słowa kluczowe</Text>

          {sub("keywords", "positionDistribution") && (
            <>
              <Text style={styles.subsectionTitle}>Rozkład pozycji</Text>
              {data.keywords?.positionDistribution && (
                <View style={{ marginBottom: 10 }}>
                  <HorizontalBar label="Top 3" value={data.keywords.positionDistribution.top3} max={Math.max(data.keywords.total, 1)} color={colors.success} />
                  <HorizontalBar label="4-10" value={data.keywords.positionDistribution.pos4_10} max={Math.max(data.keywords.total, 1)} color={colors.success500} />
                  <HorizontalBar label="11-20" value={data.keywords.positionDistribution.pos11_20} max={Math.max(data.keywords.total, 1)} color={colors.warning} />
                  <HorizontalBar label="21-50" value={data.keywords.positionDistribution.pos21_50} max={Math.max(data.keywords.total, 1)} color={colors.warning500} />
                  <HorizontalBar label="51-100" value={data.keywords.positionDistribution.pos51_100} max={Math.max(data.keywords.total, 1)} color={colors.error} />
                </View>
              )}
            </>
          )}

          {sub("keywords", "movement") && data.keywords?.movement && (
            <>
              <Text style={styles.subsectionTitle}>Ruch 7-dniowy</Text>
              <View style={styles.metricsRow}>
                <MetricBox value={data.keywords.movement.gainers} label="Wzrosty" />
                <MetricBox value={data.keywords.movement.losers} label="Spadki" />
                <MetricBox value={data.keywords.movement.stable} label="Stabilne" />
              </View>
            </>
          )}

          {sub("keywords", "topGainers") && data.keywords?.topGainers?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Największe wzrosty</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Słowo kluczowe</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Stara</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Nowa</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Zmiana</Text>
                </View>
                {data.keywords.topGainers.slice(0, 10).map((kw: any, i: number) => (
                  <View style={styles.tableRow} key={i}>
                    <Text style={[styles.tableCell, { flex: 3 }]}>{kw.phrase}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{kw.oldPosition}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{kw.newPosition}</Text>
                    <Text style={[styles.tableCell, { flex: 1, color: colors.success }]}>+{kw.change}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {sub("keywords", "topLosers") && data.keywords?.topLosers?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Największe spadki</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Słowo kluczowe</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Stara</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Nowa</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Zmiana</Text>
                </View>
                {data.keywords.topLosers.slice(0, 10).map((kw: any, i: number) => (
                  <View style={styles.tableRow} key={i}>
                    <Text style={[styles.tableCell, { flex: 3 }]}>{kw.phrase}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{kw.oldPosition}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{kw.newPosition}</Text>
                    <Text style={[styles.tableCell, { flex: 1, color: colors.error }]}>{kw.change}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {sub("keywords", "nearPage1") && data.keywords?.nearPage1?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Blisko strony 1 (pozycje 11-20)</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Słowo kluczowe</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Pozycja</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Wolumen</Text>
                </View>
                {data.keywords.nearPage1.slice(0, 10).map((kw: any, i: number) => (
                  <View style={styles.tableRow} key={i}>
                    <Text style={[styles.tableCell, { flex: 3 }]}>{kw.phrase}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{kw.position}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{kw.searchVolume ?? "—"}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
        <PageFooter />
      </Page>
      )}

      {/* ── Backlinks Page ─────────────────────────────────── */}
      {enabledSections.has("backlinks") && (
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Linki zwrotne</Text>

          {sub("backlinks", "summary") && data.backlinks?.summary && (
            <>
              <Text style={styles.subsectionTitle}>Przegląd</Text>
              <View style={styles.metricsRow}>
                <MetricBox value={data.backlinks.summary.totalBacklinks ?? 0} label="Łączne linki zwrotne" />
                <MetricBox value={data.backlinks.summary.totalDomains ?? 0} label="Domeny odsyłające" />
                <MetricBox value={data.backlinks.summary.dofollow ?? 0} label="Dofollow" />
                <MetricBox value={data.backlinks.summary.nofollow ?? 0} label="Nofollow" />
              </View>
            </>
          )}

          {sub("backlinks", "anchorDistribution") && data.backlinks?.anchorDistribution && (
            <>
              <Text style={styles.subsectionTitle}>Rozkład anchor text</Text>
              <View style={{ marginBottom: 10 }}>
                {Object.entries(data.backlinks.anchorDistribution as Record<string, number>).map(([category, count]) => (
                  <HorizontalBar
                    key={category}
                    label={category.charAt(0).toUpperCase() + category.slice(1)}
                    value={count}
                    max={Math.max(...Object.values(data.backlinks.anchorDistribution as Record<string, number>), 1)}
                    color={category === "branded" ? colors.brand : category === "exact_url" ? colors.brand500 : category === "generic" ? colors.warning : colors.success500}
                  />
                ))}
              </View>
            </>
          )}

          {sub("backlinks", "toxicLinks") && data.backlinks?.toxicLinks?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Toksyczne linki ({data.backlinks.totalToxic} łącznie)</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Domena źródłowa</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Anchor</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Spam</Text>
                </View>
                {data.backlinks.toxicLinks.slice(0, 15).map((bl: any, i: number) => (
                  <View style={styles.tableRow} key={i}>
                    <Text style={[styles.tableCell, { flex: 3 }]}>{bl.domainFrom ?? "—"}</Text>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{bl.anchor ?? "—"}</Text>
                    <Text style={[styles.tableCell, { flex: 1, color: colors.error }]}>{bl.spamScore}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
        <PageFooter />
      </Page>
      )}

      {/* ── Content Gaps + Competitors Page ─────────────────── */}
      {enabledSections.has("contentGaps") && (
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Luki w treści i konkurenci</Text>

          {sub("contentGaps", "gapSummary") && (
            <>
              <Text style={styles.subsectionTitle}>Podsumowanie luk w treści</Text>
              <View style={styles.metricsRow}>
                <MetricBox value={data.contentGaps?.total ?? 0} label="Łączne luki" />
                <MetricBox value={data.contentGaps?.byPriority?.high ?? 0} label="Wysoki priorytet" />
                <MetricBox value={data.contentGaps?.byPriority?.medium ?? 0} label="Średni priorytet" />
                <MetricBox value={`$${Math.round((data.contentGaps?.totalEstimatedValue ?? 0) / 100) * 100}`} label="Szac. wartość ruchu" />
              </View>
            </>
          )}

          {sub("contentGaps", "topOpportunities") && data.contentGaps?.topGaps?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Najlepsze możliwości treściowe</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Słowo kluczowe</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Konkurent</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Wynik</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Wolumen</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Trudn.</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Konk. #</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Twoja #</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Priorytet</Text>
                </View>
                {data.contentGaps.topGaps.slice(0, 20).map((gap: any, i: number) => {
                  const score = isNaN(gap.opportunityScore) ? "—" : gap.opportunityScore;
                  const priorityColor = gap.priority === "high" ? colors.error : gap.priority === "medium" ? colors.warning : colors.secondary;
                  return (
                    <View style={styles.tableRow} key={i}>
                      <Text style={[styles.tableCell, { flex: 3 }]}>{gap.keyword}</Text>
                      <Text style={[styles.tableCell, { flex: 2 }]}>{gap.competitor}</Text>
                      <Text style={[styles.tableCell, { flex: 0.8, fontFamily: "Inter", fontWeight: 700 }]}>{score}</Text>
                      <Text style={[styles.tableCell, { flex: 0.8 }]}>{gap.searchVolume ?? "—"}</Text>
                      <Text style={[styles.tableCell, { flex: 0.7 }]}>{gap.difficulty != null ? gap.difficulty : "—"}</Text>
                      <Text style={[styles.tableCell, { flex: 0.7 }]}>{gap.competitorPosition ?? "—"}</Text>
                      <Text style={[styles.tableCell, { flex: 0.7 }]}>{gap.yourPosition ?? "—"}</Text>
                      <Text style={[styles.tableCell, { flex: 0.7, color: priorityColor, fontFamily: "Inter", fontWeight: 700, fontSize: 8 }]}>{(gap.priority ?? "low").toUpperCase()}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {sub("contentGaps", "competitorList") && data.competitors?.list?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Śledzeni konkurenci</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Domena</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Nazwa</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                </View>
                {data.competitors.list.map((comp: any, i: number) => (
                  <View style={styles.tableRow} key={i}>
                    <Text style={[styles.tableCell, { flex: 3 }]}>{comp.domain}</Text>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{comp.name}</Text>
                    <Text style={[styles.tableCell, { flex: 1, color: comp.status === "active" ? colors.success : colors.tertiary }]}>{comp.status}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
        <PageFooter />
      </Page>
      )}

      {/* ── On-Site Page ───────────────────────────────────── */}
      {enabledSections.has("onsite") && data.onSite && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SEO on-site</Text>

            {sub("onsite", "healthMetrics") && (
              <View style={styles.metricsRow}>
                <MetricBox value={`${data.onSite.healthScore}/100`} label="Wynik zdrowia" />
                <MetricBox value={data.onSite.totalPages} label="Łączne strony" />
                <MetricBox value={data.onSite.criticalIssues} label="Krytyczne problemy" />
                <MetricBox value={data.onSite.warnings} label="Ostrzeżenia" />
              </View>
            )}

            {sub("onsite", "issueDistribution") && data.onSite.issues && (
              <>
                <Text style={styles.subsectionTitle}>Rozkład problemów</Text>
                <View style={{ marginBottom: 10 }}>
                  {Object.entries(data.onSite.issues as Record<string, number>)
                    .filter(([, count]) => (count as number) > 0)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([issue, count]) => (
                      <HorizontalBar
                        key={issue}
                        label={issue.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                        value={count as number}
                        max={data.onSite.totalPages}
                        color={colors.error}
                      />
                    ))}
                </View>
              </>
            )}

            {sub("onsite", "coreWebVitals") && data.coreWebVitals?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Core Web Vitals</Text>
                <View style={styles.metricsRow}>
                  {data.coreWebVitals.map((cwv: any, i: number) => (
                    <View key={i} style={styles.metricBox}>
                      <Text style={[styles.caption, { marginBottom: 4 }]}>
                        {cwv.device.toUpperCase()}
                      </Text>
                      {cwv.lcp != null && <Text style={styles.textSmall}>LCP: {cwv.lcp}ms</Text>}
                      {cwv.fid != null && <Text style={styles.textSmall}>FID: {cwv.fid}ms</Text>}
                      {cwv.cls != null && <Text style={styles.textSmall}>CLS: {cwv.cls}</Text>}
                      {cwv.performanceScore != null && (
                        <Text style={[styles.textSmallBold, { marginTop: 4 }]}>
                          Wynik: {cwv.performanceScore}/100
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </>
            )}

            {sub("onsite", "criticalIssues") && data.onSite.criticalIssuesList?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Krytyczne problemy</Text>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Problem</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Strony</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Kategoria</Text>
                  </View>
                  {data.onSite.criticalIssuesList.map((issue: any, i: number) => (
                    <View style={styles.tableRow} key={i}>
                      <Text style={[styles.tableCell, { flex: 3 }]}>{issue.title}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{issue.affectedPages}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{issue.category}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
          <PageFooter />
        </Page>
      )}

      {/* ── Link Building Page ─────────────────────────────── */}
      {enabledSections.has("linkBuilding") && data.linkBuilding?.topProspects?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Link building</Text>

            {sub("linkBuilding", "prospectMetrics") && (
              <View style={styles.metricsRow}>
                <MetricBox value={data.linkBuilding.totalProspects} label="Łączne perspektywy" />
                <MetricBox value={data.linkBuilding.activeProspects} label="Aktywne perspektywy" />
              </View>
            )}

            {sub("linkBuilding", "byChannel") && data.linkBuilding.byChannel && (
              <>
                <Text style={styles.subsectionTitle}>Perspektywy wg kanału</Text>
                <View style={{ marginBottom: 10 }}>
                  {Object.entries(data.linkBuilding.byChannel as Record<string, number>)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([channel, count]) => (
                      <HorizontalBar
                        key={channel}
                        label={channel.replace(/_/g, " ")}
                        value={count as number}
                        max={data.linkBuilding.activeProspects || 1}
                        color={colors.brand}
                      />
                    ))}
                </View>
              </>
            )}

            {sub("linkBuilding", "topProspects") && (
              <>
                <Text style={styles.subsectionTitle}>Najlepsze perspektywy</Text>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Domena</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Ranga</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Wynik</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Trudność</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Kanał</Text>
                  </View>
                  {data.linkBuilding.topProspects.slice(0, 20).map((p: any, i: number) => (
                    <View style={styles.tableRow} key={i}>
                      <Text style={[styles.tableCell, { flex: 3 }]}>{p.referringDomain}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{p.domainRank}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{p.prospectScore}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{p.acquisitionDifficulty}</Text>
                      <Text style={[styles.tableCell, { flex: 2 }]}>{p.suggestedChannel.replace(/_/g, " ")}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
          <PageFooter />
        </Page>
      )}

      {/* ── Recommendations Page ───────────────────────────── */}
      {enabledSections.has("recommendations") && data.recommendations?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rekomendacje</Text>
            <Text style={styles.textSmall}>
              Priorytetowa lista działań w celu poprawy wyników SEO.
            </Text>
            <View style={{ marginTop: 10 }}>
              {data.recommendations.map((rec: any, i: number) => (
                <View style={styles.recItem} key={i}>
                  <PriorityBadge priority={rec.priority} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.textBold}>{rec.title}</Text>
                    <Text style={styles.textSmall}>{rec.description}</Text>
                    <Text style={{ fontSize: 8, fontFamily: "Inter", color: colors.tertiary, marginTop: 2 }}>
                      Kategoria: {rec.category}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <PageFooter />
        </Page>
      )}
    </Document>
  );
}

// ─── Strategy PDF Helpers ────────────────────────────────────────

const catColors: Record<string, string> = {
  content: colors.brand,
  technical: colors.warning500,
  links: colors.success500,
  keywords: colors.brand500,
};

const timeframeMonths: Record<string, [number, number]> = {
  immediate: [0, 1],
  "short-term": [1, 3],
  "long-term": [3, 6],
};

const effortAdj: Record<string, number> = { low: -0.5, medium: 0, high: 0.5 };

const SEVERITY_PDF: Record<string, { bg: string; text: string }> = {
  high:   { bg: colors.errorLight, text: colors.error },
  medium: { bg: colors.warningLight, text: colors.warning },
  low:    { bg: colors.bgMuted, text: colors.secondary },
};

/** Render markdown text as PDF Text nodes with bold support */
function PdfMarkdown({ text }: { text: string }) {
  // Split on **bold** markers
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <Text style={styles.text}>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <Text key={i} style={{ fontFamily: "Inter", fontWeight: 700 }}>{p.slice(2, -2)}</Text>;
        }
        return <Text key={i}>{p}</Text>;
      })}
    </Text>
  );
}

/** Parse markdown into structured blocks for PDF rendering */
type PdfMdBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string }
  | { type: "numbered"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; text: string }
  | { type: "blank" };

function parsePdfMarkdownBlocks(md: string): PdfMdBlock[] {
  const lines = md.split("\n");
  const blocks: PdfMdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) { blocks.push({ type: "blank" }); i++; continue; }

    // Blockquote / callout
    if (/^>\s/.test(trimmed)) {
      let text = trimmed.replace(/^>\s*/, "");
      i++;
      while (i < lines.length && /^>\s/.test(lines[i].trim())) {
        text += " " + lines[i].trim().replace(/^>\s*/, "");
        i++;
      }
      blocks.push({ type: "callout", text });
      continue;
    }

    // Table: line starts with |, next line is separator
    if (/^\|.+\|/.test(trimmed) && i + 1 < lines.length && /^\|[\s:?-]+(\|[\s:?-]+)+\|?\s*$/.test(lines[i + 1].trim())) {
      const headers = trimmed.split("|").slice(1, -1).map((c: string) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.+\|/.test(lines[i].trimEnd())) {
        rows.push(lines[i].split("|").slice(1, -1).map((c: string) => c.trim()));
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (trimmed.startsWith("## ")) { blocks.push({ type: "h2", text: trimmed.slice(3) }); i++; continue; }
    if (trimmed.startsWith("### ")) { blocks.push({ type: "h3", text: trimmed.slice(4) }); i++; continue; }
    if (/^[-*]\s/.test(trimmed)) { blocks.push({ type: "bullet", text: trimmed.replace(/^[-*]\s+/, "") }); i++; continue; }
    if (/^\d+\.\s/.test(trimmed)) { blocks.push({ type: "numbered", text: trimmed }); i++; continue; }

    blocks.push({ type: "paragraph", text: trimmed });
    i++;
  }
  return blocks;
}

/** Render a table block as PDF Views */
function PdfTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const colCount = headers.length;
  const colFlex = headers.map(() => 1);

  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 3, marginVertical: 4 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", backgroundColor: colors.bgMuted, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4, paddingHorizontal: 6 }}>
        {headers.map((h, hi) => (
          <Text key={hi} style={[styles.label, { flex: colFlex[hi], color: colors.secondary }]}>{h}</Text>
        ))}
      </View>
      {/* Rows */}
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", borderBottomWidth: ri < rows.length - 1 ? 1 : 0, borderBottomColor: colors.border, paddingVertical: 3, paddingHorizontal: 6, backgroundColor: ri % 2 === 1 ? colors.bgMuted : colors.bg }}>
          {row.slice(0, colCount).map((cell, ci) => (
            <Text key={ci} style={{ flex: colFlex[ci] ?? 1, fontSize: 8, color: ci === 0 ? colors.primary : colors.secondary, fontFamily: "Inter", fontWeight: ci === 0 ? 600 : 400 }}>{cell}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Render drill-down responses as PDF pages */
function DrillDownPages({ drillDowns, sectionKey }: { drillDowns: any[]; sectionKey: string }) {
  const items = drillDowns?.filter((d: any) => d.sectionKey === sectionKey) ?? [];
  if (items.length === 0) return null;

  return (
    <>
      {items.map((dd: any, i: number) => {
        const blocks = parsePdfMarkdownBlocks(dd.response);
        return (
          <Page key={`dd-${sectionKey}-${i}`} size="A4" style={styles.page}>
            <View style={styles.section}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <View style={{ width: 4, height: 16, backgroundColor: colors.brand, borderRadius: 2, marginRight: 8 }} />
                <Text style={[styles.subsectionTitle, { marginTop: 0, marginBottom: 0 }]}>
                  {dd.question ? `Pogłębiona analiza: ${dd.question}` : `Pogłębiona analiza`}
                </Text>
              </View>
              <Text style={{ fontSize: 8, fontFamily: "Inter", color: colors.tertiary, marginBottom: 8 }}>
                {new Date(dd.createdAt).toLocaleString()}
              </Text>
              {blocks.map((block: PdfMdBlock, bi: number) => {
                switch (block.type) {
                  case "blank": return <Text key={bi} style={{ height: 6 }}>{" "}</Text>;
                  case "h2": return <Text key={bi} style={[styles.subsectionTitle, { color: colors.brand, marginTop: 8 }]}>{block.text}</Text>;
                  case "h3": return <Text key={bi} style={[styles.subsectionTitle, { fontSize: 10 }]}>{block.text}</Text>;
                  case "bullet": return <PdfMarkdown key={bi} text={`  • ${block.text}`} />;
                  case "numbered": return <PdfMarkdown key={bi} text={`  ${block.text}`} />;
                  case "paragraph": return <PdfMarkdown key={bi} text={block.text} />;
                  case "callout":
                    return (
                      <View key={bi} style={{ backgroundColor: colors.brandLight, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, marginVertical: 4, borderWidth: 1, borderColor: colors.borderLight }}>
                        <PdfMarkdown text={block.text} />
                      </View>
                    );
                  case "table":
                    return <PdfTable key={bi} headers={block.headers} rows={block.rows} />;
                }
              })}
            </View>
            <PageFooter />
          </Page>
        );
      })}
    </>
  );
}

// ─── Strategy PDF Document ───────────────────────────────────────

interface StrategyPdfProps {
  strategy: any;
  domain: string;
  date: string;
  businessDescription?: string;
  targetCustomer?: string;
  dataSnapshot?: any;
  drillDowns?: any[];
  logoSrc?: string;
}

function StrategyPdfDocument({ strategy, domain, date, businessDescription, targetCustomer, dataSnapshot, drillDowns, logoSrc }: StrategyPdfProps) {
  const dd = drillDowns ?? [];
  // Dynamic section numbering — insert optional sections without breaking fixed numbering
  const hasBacklinkContent = strategy.backlinkContentExamples?.length > 0;
  const hasActionableSteps = strategy.actionableSteps?.length > 0;
  // Sections 1-5 fixed, then optional backlinkContent shifts everything after
  const sn = (base: number) => base + (hasBacklinkContent && base > 5 ? 1 : 0);
  const backlinkContentNum = 6; // always 6 when present (right after section 5)
  const lastSection = sn(10) + (hasActionableSteps ? 1 : 0);
  void lastSection; // used in TOC

  return (
    <Document>
      {/* ── Cover ─────────────────────────────────────────── */}
      <Page size="A4" style={styles.coverPage}>
        <DseoLogo src={logoSrc} />
        <Text style={styles.coverTitle}>Raport strategii SEO</Text>
        <Text style={styles.coverDomain}>{domain}</Text>
        <Text style={styles.coverDate}>{date}</Text>
        {businessDescription && (
          <View style={{ marginTop: 40, maxWidth: 400, alignItems: "center" }}>
            <Text style={{ fontSize: 10, fontFamily: "Inter", fontWeight: 600, color: colors.secondary, textAlign: "center", marginBottom: 4 }}>Firma</Text>
            <Text style={{ fontSize: 9, fontFamily: "Inter", color: colors.primary, textAlign: "center", lineHeight: 1.5 }}>{businessDescription}</Text>
          </View>
        )}
        {targetCustomer && (
          <View style={{ marginTop: 16, maxWidth: 400, alignItems: "center" }}>
            <Text style={{ fontSize: 10, fontFamily: "Inter", fontWeight: 600, color: colors.secondary, textAlign: "center", marginBottom: 4 }}>Klient docelowy</Text>
            <Text style={{ fontSize: 9, fontFamily: "Inter", color: colors.primary, textAlign: "center", lineHeight: 1.5 }}>{targetCustomer}</Text>
          </View>
        )}
        {dataSnapshot && (
          <View style={{ flexDirection: "row", gap: 20, marginTop: 30, justifyContent: "center" }}>
            {dataSnapshot.keywordCount != null && <Text style={{ fontSize: 9, fontFamily: "Inter", color: colors.tertiary }}>{dataSnapshot.keywordCount} słów kluczowych</Text>}
            {dataSnapshot.competitorCount != null && <Text style={{ fontSize: 9, fontFamily: "Inter", color: colors.tertiary }}>{dataSnapshot.competitorCount} konkurentów</Text>}
            {dataSnapshot.contentGapCount != null && <Text style={{ fontSize: 9, fontFamily: "Inter", color: colors.tertiary }}>{dataSnapshot.contentGapCount} luk w treści</Text>}
            {dataSnapshot.backlinkCount != null && <Text style={{ fontSize: 9, fontFamily: "Inter", color: colors.tertiary }}>{dataSnapshot.backlinkCount} linków zwrotnych</Text>}
          </View>
        )}
      </Page>

      {/* ── Table of Contents ──────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spis treści</Text>
          {(() => {
            const toc: Array<string> = [
              "Podsumowanie wykonawcze",
              "Szybkie korzyści",
              "Strategia treści",
              "Analiza konkurencji",
              "Strategia linkowa",
            ];
            if (strategy.backlinkContentExamples?.length > 0) toc.push("Pomysły na treści backlinkowe");
            toc.push("Techniczne SEO", "Ocena ryzyka", "Klastry słów kluczowych", "Prognoza ROI", "Plan działania");
            if (strategy.actionableSteps?.length > 0) toc.push("Kroki do wykonania");
            return toc.map((title, i) => (
              <TocEntry key={i} number={`${i + 1}.`} title={title} />
            ));
          })()}
        </View>
        <PageFooter />
      </Page>

      {/* ── 1. Executive Summary ───────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Podsumowanie wykonawcze</Text>

          {/* Summary text in a styled card */}
          <View style={{ backgroundColor: colors.bgMuted, padding: 14, borderRadius: 6, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight }}>
            {(() => {
              const blocks = parsePdfMarkdownBlocks(strategy.executiveSummary ?? "");
              return blocks.map((block: PdfMdBlock, bi: number) => {
                if (block.type === "blank") return <View key={bi} style={{ height: 6 }} />;
                if (block.type === "h2") return <Text key={bi} style={[styles.subsectionTitle, { marginTop: bi > 0 ? 8 : 0 }]}>{block.text}</Text>;
                if (block.type === "h3") return <Text key={bi} style={[styles.textBold, { marginTop: 6, marginBottom: 2 }]}>{block.text}</Text>;
                if (block.type === "bullet") return <View key={bi} style={{ flexDirection: "row", paddingLeft: 10, marginBottom: 2 }}><Text style={styles.text}>•  </Text><PdfMarkdown text={block.text} /></View>;
                if (block.type === "numbered") return <View key={bi} style={{ paddingLeft: 10, marginBottom: 2 }}><PdfMarkdown text={block.text} /></View>;
                if (block.type === "callout") return <View key={bi} style={{ backgroundColor: colors.brandLight, padding: 8, borderRadius: 6, marginBottom: 4, borderWidth: 1, borderColor: colors.borderLight }}><PdfMarkdown text={block.text} /></View>;
                if (block.type === "table") return <PdfTable key={bi} headers={block.headers} rows={block.rows} />;
                return <Text key={bi} style={{ fontSize: 10, fontFamily: "Inter", color: colors.primary, lineHeight: 1.7 }}>{block.text}</Text>;
              });
            })()}
          </View>

          {/* Key data metrics */}
          {dataSnapshot && (
            <>
              <Text style={styles.subsectionTitle}>Kluczowe dane</Text>
              <View style={styles.metricsRow}>
                {dataSnapshot.keywordCount != null && <MetricBox value={dataSnapshot.keywordCount} label="Słowa kluczowe" />}
                {dataSnapshot.competitorCount != null && <MetricBox value={dataSnapshot.competitorCount} label="Konkurenci" />}
                {dataSnapshot.contentGapCount != null && <MetricBox value={dataSnapshot.contentGapCount} label="Luki w treści" />}
                {dataSnapshot.backlinkCount != null && <MetricBox value={dataSnapshot.backlinkCount} label="Linki zwrotne" />}
              </View>
              {(dataSnapshot.avgPosition != null || dataSnapshot.topKeywordsCount != null) && (
                <View style={[styles.metricsRow, { marginTop: 6 }]}>
                  {dataSnapshot.avgPosition != null && <MetricBox value={dataSnapshot.avgPosition} label="Śr. pozycja" />}
                  {dataSnapshot.topKeywordsCount != null && <MetricBox value={dataSnapshot.topKeywordsCount} label="W TOP-10" />}
                  {dataSnapshot.healthScore != null && <MetricBox value={`${dataSnapshot.healthScore}/100`} label="Wynik zdrowia" />}
                  {dataSnapshot.totalTraffic != null && <MetricBox value={dataSnapshot.totalTraffic} label="Szac. ruch" />}
                </View>
              )}
            </>
          )}

          {/* Strategy scope overview */}
          <Text style={[styles.subsectionTitle, { marginTop: 14 }]}>Zakres strategii</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {strategy.quickWins?.length > 0 && (
              <View style={{ flex: 1, minWidth: "45%", backgroundColor: colors.successLight, padding: 10, borderRadius: 4 }}>
                <Text style={[styles.metricValue, { color: colors.success }]}>{strategy.quickWins.length}</Text>
                <Text style={[styles.metricLabel, { color: colors.success }]}>Szybkich korzyści</Text>
              </View>
            )}
            {strategy.contentStrategy?.length > 0 && (
              <View style={{ flex: 1, minWidth: "45%", backgroundColor: colors.brandLight, padding: 10, borderRadius: 4 }}>
                <Text style={[styles.metricValue, { color: colors.brand }]}>{strategy.contentStrategy.length}</Text>
                <Text style={[styles.metricLabel, { color: colors.brand }]}>Strategii treści</Text>
              </View>
            )}
            {strategy.competitorAnalysis?.length > 0 && (
              <View style={{ flex: 1, minWidth: "45%", backgroundColor: colors.warningLight, padding: 10, borderRadius: 4 }}>
                <Text style={[styles.metricValue, { color: colors.warning }]}>{strategy.competitorAnalysis.length}</Text>
                <Text style={[styles.metricLabel, { color: colors.warning }]}>Analiz konkurencji</Text>
              </View>
            )}
            {strategy.riskAssessment?.length > 0 && (
              <View style={{ flex: 1, minWidth: "45%", backgroundColor: colors.errorLight, padding: 10, borderRadius: 4 }}>
                <Text style={[styles.metricValue, { color: colors.error }]}>{strategy.riskAssessment.length}</Text>
                <Text style={[styles.metricLabel, { color: colors.error }]}>Ryzyk do oceny</Text>
              </View>
            )}
            {strategy.keywordClustering?.length > 0 && (
              <View style={{ flex: 1, minWidth: "45%", backgroundColor: colors.bgTertiary, padding: 10, borderRadius: 4 }}>
                <Text style={[styles.metricValue, { color: colors.secondary }]}>{strategy.keywordClustering.length}</Text>
                <Text style={styles.metricLabel}>Klastrów słów kluczowych</Text>
              </View>
            )}
            {strategy.actionPlan?.length > 0 && (
              <View style={{ flex: 1, minWidth: "45%", backgroundColor: colors.bgTertiary, padding: 10, borderRadius: 4 }}>
                <Text style={[styles.metricValue, { color: colors.secondary }]}>{strategy.actionPlan.length}</Text>
                <Text style={styles.metricLabel}>Działań w planie</Text>
              </View>
            )}
          </View>
        </View>
        <PageFooter />
      </Page>
      <DrillDownPages drillDowns={dd} sectionKey="executiveSummary" />

      {/* ── 2. Quick Wins ──────────────────────────────────── */}
      {strategy.quickWins?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Szybkie korzyści ({strategy.quickWins.length})</Text>
            {strategy.quickWins.map((qw: any, i: number) => {
              const diffColor = qw.difficulty >= 70 ? colors.error : qw.difficulty >= 40 ? colors.warning : colors.success;
              return (
                <View key={i} wrap={false} style={{ marginBottom: 8, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Text style={styles.textBold}>{qw.keyword}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.textSmall, { color: colors.primary }]}>#{qw.currentPosition}</Text>
                      <Text style={[styles.textSmall, { color: colors.tertiary }]}>→</Text>
                      <Text style={[styles.textSmallBold, { color: colors.success }]}>#{qw.targetPosition}</Text>
                    </View>
                  </View>
                  {qw.existingPage && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4, backgroundColor: "#EEF2FF", borderRadius: 4, padding: 4, paddingHorizontal: 6 }}>
                      <Text style={{ fontSize: 7, fontFamily: "Inter", color: colors.brand, fontWeight: 600 }}>ISTNIEJĄCA STRONA:</Text>
                      <Text style={{ fontSize: 7, fontFamily: "Inter", color: colors.brand }}>{qw.existingPage}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", gap: 16, marginBottom: qw.actionItems?.length > 0 ? 6 : 0 }}>
                    <Text style={styles.textSmall}>Trudność: <Text style={{ color: diffColor, fontFamily: "Inter", fontWeight: 600 }}>{qw.difficulty}</Text></Text>
                    <Text style={styles.textSmall}>Wolumen: {qw.searchVolume?.toLocaleString()}</Text>
                    {qw.estimatedTrafficGain && <Text style={styles.textSmall}>Wzrost: {qw.estimatedTrafficGain}</Text>}
                  </View>
                  {qw.actionItems?.length > 0 && (
                    <View style={{ backgroundColor: colors.bgMuted, padding: 8, borderRadius: 4 }}>
                      {qw.actionItems.map((a: string, j: number) => (
                        <View key={j} style={{ flexDirection: "row", gap: 6, marginBottom: j < qw.actionItems.length - 1 ? 3 : 0 }}>
                          <Text style={styles.text}>•</Text>
                          <Text style={[styles.text, { flex: 1 }]}>{a}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          <PageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="quickWins" />

      {/* ── 3. Content Strategy ─────────────────────────────── */}
      {strategy.contentStrategy?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Strategia treści ({strategy.contentStrategy.length})</Text>

            {/* Opportunity ranking chart */}
            {(() => {
              const sorted = [...strategy.contentStrategy].sort((a: any, b: any) => b.opportunityScore - a.opportunityScore);
              const maxScore = Math.max(...strategy.contentStrategy.map((d: any) => d.opportunityScore ?? 0), 1);
              return (
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.subsectionTitle}>Ranking możliwości</Text>
                  {sorted.map((cs: any, i: number) => {
                    const pct = ((cs.opportunityScore ?? 0) / maxScore) * 100;
                    const barColor = cs.opportunityScore >= 70 ? colors.success : cs.opportunityScore >= 40 ? colors.warning : colors.error;
                    return (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <Text style={[styles.textSmall, { width: 14, textAlign: "right", color: colors.tertiary }]}>{i + 1}</Text>
                        <Text style={[styles.textSmall, { width: 120, color: colors.primary }]}>{cs.targetKeyword}</Text>
                        <View style={{ flex: 1, height: 12, backgroundColor: colors.bgMuted, borderRadius: 2 }}>
                          <View style={{ width: `${pct}%`, height: 12, backgroundColor: barColor, borderRadius: 2 }} />
                        </View>
                        <Text style={[styles.textSmallBold, { width: 28, textAlign: "right" }]}>{cs.opportunityScore}</Text>
                        <Text style={[styles.textSmall, { width: 48, textAlign: "right", color: colors.tertiary }]}>{cs.searchVolume?.toLocaleString()}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* Content strategy cards */}
            {strategy.contentStrategy.map((cs: any, i: number) => {
              const scoreColor = cs.opportunityScore >= 70 ? colors.success : cs.opportunityScore >= 40 ? colors.warning : colors.error;
              return (
                <View key={i} wrap={false} style={{ marginBottom: 8, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Text style={styles.textBold}>{cs.targetKeyword}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[styles.recPriority, { backgroundColor: scoreColor, color: "#FFFFFF" }]}>{cs.opportunityScore}</Text>
                      <Text style={styles.caption}>{cs.suggestedContentType}</Text>
                    </View>
                  </View>
                  {cs.existingPage && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4, backgroundColor: "#EEF2FF", borderRadius: 4, padding: 4, paddingHorizontal: 6 }}>
                      <Text style={{ fontSize: 7, fontFamily: "Inter", color: colors.brand, fontWeight: 600 }}>ISTNIEJĄCA STRONA:</Text>
                      <Text style={{ fontSize: 7, fontFamily: "Inter", color: colors.brand }}>{cs.existingPage}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", gap: 16, marginBottom: 4 }}>
                    <Text style={styles.textSmall}>Wolumen: {cs.searchVolume?.toLocaleString()}</Text>
                  </View>
                  {cs.estimatedImpact && <Text style={[styles.text, { color: colors.secondary }]}>{cs.estimatedImpact}</Text>}
                </View>
              );
            })}
          </View>
          <PageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="contentStrategy" />

      {/* ── 4. Competitor Analysis ──────────────────────────── */}
      {strategy.competitorAnalysis?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Analiza konkurencji ({strategy.competitorAnalysis.length})</Text>
            {strategy.competitorAnalysis.map((comp: any, i: number) => (
              <View key={i} wrap={false} style={{ marginBottom: 14, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 6 }}>
                <Text style={[styles.subsectionTitle, { marginTop: 0, color: colors.brand }]}>{comp.domain}</Text>
                {/* SWOT 2x2 grid */}
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                  {comp.strengths?.length > 0 && (
                    <View style={{ flex: 1, backgroundColor: colors.successLight, padding: 8, borderRadius: 4 }}>
                      <Text style={[styles.label, { color: colors.success, marginBottom: 6 }]}>MOCNE STRONY</Text>
                      {comp.strengths.map((s: string, j: number) => <Text key={j} style={[styles.textSmall, { marginBottom: 3 }]}>• {s}</Text>)}
                    </View>
                  )}
                  {comp.weaknesses?.length > 0 && (
                    <View style={{ flex: 1, backgroundColor: colors.errorLight, padding: 8, borderRadius: 4 }}>
                      <Text style={[styles.label, { color: colors.error, marginBottom: 6 }]}>SŁABE STRONY</Text>
                      {comp.weaknesses.map((s: string, j: number) => <Text key={j} style={[styles.textSmall, { marginBottom: 3 }]}>• {s}</Text>)}
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {comp.threatsToUs?.length > 0 && (
                    <View style={{ flex: 1, backgroundColor: colors.warningLight, padding: 8, borderRadius: 4 }}>
                      <Text style={[styles.label, { color: colors.warning, marginBottom: 6 }]}>ZAGROŻENIA</Text>
                      {comp.threatsToUs.map((s: string, j: number) => <Text key={j} style={[styles.textSmall, { marginBottom: 3 }]}>• {s}</Text>)}
                    </View>
                  )}
                  {comp.opportunitiesAgainstThem?.length > 0 && (
                    <View style={{ flex: 1, backgroundColor: colors.brandLight, padding: 8, borderRadius: 4 }}>
                      <Text style={[styles.label, { color: colors.brand, marginBottom: 6 }]}>SZANSE</Text>
                      {comp.opportunitiesAgainstThem.map((s: string, j: number) => <Text key={j} style={[styles.textSmall, { marginBottom: 3 }]}>• {s}</Text>)}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
          <PageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="competitorAnalysis" />

      {/* ── 5. Backlink Strategy ────────────────────────────── */}
      {strategy.backlinkStrategy && (strategy.backlinkStrategy.profileAssessment || strategy.backlinkStrategy.toxicCleanup || strategy.backlinkStrategy.linkBuildingPriorities?.length > 0) && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Strategia linkowa</Text>
            <Text style={styles.subsectionTitle}>Ocena profilu</Text>
            <Text style={styles.text}>{strategy.backlinkStrategy.profileAssessment}</Text>

            {strategy.backlinkStrategy.toxicCleanup && (
              <View wrap={false} style={{ marginTop: 10, padding: 10, backgroundColor: colors.errorLight, borderRadius: 6 }}>
                <Text style={[styles.label, { color: colors.error, marginBottom: 2 }]}>
                  CZYSZCZENIE TOKSYCZNYCH — {strategy.backlinkStrategy.toxicCleanup.priority?.toUpperCase()} PRIORYTET ({strategy.backlinkStrategy.toxicCleanup.count} linków)
                </Text>
                <Text style={styles.textSmall}>{strategy.backlinkStrategy.toxicCleanup.description}</Text>
              </View>
            )}

            {strategy.backlinkStrategy.linkBuildingPriorities?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Priorytety link buildingu</Text>
                {strategy.backlinkStrategy.linkBuildingPriorities.map((p: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                    <Text style={[styles.text, { width: 16 }]}>{i + 1}.</Text>
                    <Text style={[styles.text, { flex: 1 }]}>{p}</Text>
                  </View>
                ))}
              </>
            )}

            {strategy.backlinkStrategy.prospectRecommendations && (
              <>
                <Text style={styles.subsectionTitle}>Rekomendacje prospektów</Text>
                <Text style={styles.text}>{strategy.backlinkStrategy.prospectRecommendations}</Text>
              </>
            )}

            {strategy.backlinkStrategy.topProspects?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Luki backlinkowe</Text>
                <Text style={[styles.textSmall, { color: colors.tertiary, marginBottom: 6 }]}>Domeny linkujące do konkurencji, ale nie do Ciebie</Text>
                {strategy.backlinkStrategy.topProspects.map((p: any, i: number) => {
                  const scoreColor = p.score >= 70 ? colors.success : p.score >= 40 ? colors.warning : colors.error;
                  return (
                    <View key={i} wrap={false} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 6 }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <Text style={styles.textBold}>{p.domain}</Text>
                          <Text style={[styles.caption, { backgroundColor: colors.bgMuted, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }]}>DR {p.domainRank}</Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Text style={styles.textSmall}>Linki do konkurencji: {p.linksToCompetitors}</Text>
                          <Text style={[styles.textSmall, { color: colors.tertiary }]}>{p.competitors?.slice(0, 3).join(", ")}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "center", gap: 2 }}>
                        <Text style={[styles.caption, { color: colors.tertiary }]}>{p.channel}</Text>
                        <Text style={[styles.textSmallBold, { color: scoreColor }]}>{p.score}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>
          <PageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="backlinkStrategy" />

      {/* ── Backlink Content Examples (optional) ──────────── */}
      {hasBacklinkContent && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{backlinkContentNum}. Pomysły na treści backlinkowe ({strategy.backlinkContentExamples.length})</Text>
            <Text style={[styles.textSmall, { color: colors.tertiary, marginBottom: 10 }]}>Gotowe pomysły na treści, które pomogą w pozyskiwaniu linków zwrotnych</Text>
            {strategy.backlinkContentExamples.map((ex: any, i: number) => (
              <View key={i} wrap={false} style={{ marginBottom: 10, padding: 10, backgroundColor: colors.bgTertiary, borderRadius: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Text style={[styles.label, { color: colors.brand }]}>{ex.type?.toUpperCase()}</Text>
                  {ex.category && <Text style={[styles.caption, { color: colors.tertiary }]}>· {ex.category}</Text>}
                </View>
                <Text style={[styles.textBold, { marginBottom: 3 }]}>{ex.title}</Text>
                <Text style={[styles.textSmall, { marginBottom: 6 }]}>{ex.description}</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {ex.targetSites && (
                    <View style={{ flex: 1, minWidth: "30%" }}>
                      <Text style={[styles.caption, { color: colors.tertiary, marginBottom: 1 }]}>DOCELOWE STRONY</Text>
                      <Text style={styles.textSmall}>{ex.targetSites}</Text>
                    </View>
                  )}
                  {ex.suggestedAnchorText && (
                    <View style={{ flex: 1, minWidth: "30%" }}>
                      <Text style={[styles.caption, { color: colors.tertiary, marginBottom: 1 }]}>TEKST KOTWICY</Text>
                      <Text style={styles.textSmall}>{ex.suggestedAnchorText}</Text>
                    </View>
                  )}
                  {ex.emailSubject && (
                    <View style={{ flex: 1, minWidth: "30%" }}>
                      <Text style={[styles.caption, { color: colors.tertiary, marginBottom: 1 }]}>TEMAT E-MAILA</Text>
                      <Text style={styles.textSmall}>{ex.emailSubject}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
          <PageFooter />
        </Page>
      )}

      {/* ── Technical SEO ────────────────────────────────── */}
      {strategy.technicalSEO && (strategy.technicalSEO.healthScore != null || strategy.technicalSEO.criticalFixes?.length > 0 || strategy.technicalSEO.warnings?.length > 0 || strategy.technicalSEO.improvementSteps?.length > 0) && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{sn(6)}. Techniczne SEO</Text>
            <View style={styles.metricsRow}>
              <MetricBox value={`${strategy.technicalSEO.healthScore}/100`} label="Aktualny wynik" />
              <MetricBox value={`${strategy.technicalSEO.healthScoreTarget}/100`} label="Docelowy wynik" />
              <MetricBox value={strategy.technicalSEO.criticalFixes?.length ?? 0} label="Krytyczne naprawy" valueColor={(strategy.technicalSEO.criticalFixes?.length ?? 0) > 0 ? colors.error : undefined} />
              <MetricBox value={strategy.technicalSEO.warnings?.length ?? 0} label="Ostrzeżenia" valueColor={(strategy.technicalSEO.warnings?.length ?? 0) > 0 ? colors.warning : undefined} />
            </View>

            {strategy.technicalSEO.criticalFixes?.length > 0 && (
              <>
                <Text style={[styles.subsectionTitle, { color: colors.error }]}>Krytyczne naprawy</Text>
                {strategy.technicalSEO.criticalFixes.map((f: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                    <Text style={{ fontSize: 9, color: colors.error }}>●</Text>
                    <Text style={[styles.text, { flex: 1 }]}>{f}</Text>
                  </View>
                ))}
              </>
            )}

            {strategy.technicalSEO.warnings?.length > 0 && (
              <>
                <Text style={[styles.subsectionTitle, { color: colors.warning }]}>Ostrzeżenia</Text>
                {strategy.technicalSEO.warnings.map((w: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                    <Text style={{ fontSize: 9, color: colors.warning }}>▲</Text>
                    <Text style={[styles.text, { flex: 1 }]}>{w}</Text>
                  </View>
                ))}
              </>
            )}

            {strategy.technicalSEO.improvementSteps?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Kroki ulepszenia</Text>
                {strategy.technicalSEO.improvementSteps.map((s: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                    <Text style={[styles.text, { width: 16 }]}>{i + 1}.</Text>
                    <Text style={[styles.text, { flex: 1 }]}>{s}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
          <PageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="technicalSEO" />

      {/* ── 7. Risk Assessment ──────────────────────────────── */}
      {strategy.riskAssessment?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{sn(7)}. Ocena ryzyka ({strategy.riskAssessment.length})</Text>

            {/* Severity distribution summary */}
            {(() => {
              const counts = { high: 0, medium: 0, low: 0 };
              strategy.riskAssessment.forEach((r: any) => { if (counts[r.severity as keyof typeof counts] !== undefined) counts[r.severity as keyof typeof counts]++; });
              const total = strategy.riskAssessment.length;
              return (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.subsectionTitle}>Rozkład ważności</Text>
                  {/* Stacked bar */}
                  <View style={{ flexDirection: "row", height: 16, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                    {counts.high > 0 && <View style={{ width: `${(counts.high / total) * 100}%`, backgroundColor: colors.error, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 8, color: "#fff", fontFamily: "Inter", fontWeight: 700 }}>{counts.high}</Text></View>}
                    {counts.medium > 0 && <View style={{ width: `${(counts.medium / total) * 100}%`, backgroundColor: colors.warning, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 8, color: "#fff", fontFamily: "Inter", fontWeight: 700 }}>{counts.medium}</Text></View>}
                    {counts.low > 0 && <View style={{ width: `${(counts.low / total) * 100}%`, backgroundColor: colors.tertiary, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 8, color: "#fff", fontFamily: "Inter", fontWeight: 700 }}>{counts.low}</Text></View>}
                  </View>
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ width: 8, height: 8, backgroundColor: colors.error, borderRadius: 1 }} />
                      <Text style={styles.caption}>Wysoki: {counts.high}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ width: 8, height: 8, backgroundColor: colors.warning, borderRadius: 1 }} />
                      <Text style={styles.caption}>Średni: {counts.medium}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ width: 8, height: 8, backgroundColor: colors.tertiary, borderRadius: 1 }} />
                      <Text style={styles.caption}>Niski: {counts.low}</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {strategy.riskAssessment.map((r: any, i: number) => {
              const sev = SEVERITY_PDF[r.severity] ?? SEVERITY_PDF.medium;
              return (
                <View key={i} wrap={false} style={{ marginBottom: 8, backgroundColor: sev.bg, padding: 12, borderRadius: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Text style={[styles.recPriority, { backgroundColor: sev.text, color: "#FFFFFF" }]}>{r.severity?.toUpperCase()}</Text>
                    <Text style={[styles.textBold, { flex: 1 }]}>{r.risk}</Text>
                  </View>
                  <View style={{ backgroundColor: "#FFFFFF", padding: 8, borderRadius: 4, marginBottom: 4 }}>
                    <Text style={[styles.label, { marginBottom: 2 }]}>Wpływ</Text>
                    <Text style={styles.textSmall}>{r.impact}</Text>
                  </View>
                  <View style={{ backgroundColor: "#FFFFFF", padding: 8, borderRadius: 4 }}>
                    <Text style={[styles.label, { color: colors.success, marginBottom: 2 }]}>Mitygacja</Text>
                    <Text style={styles.textSmall}>{r.mitigation}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <PageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="riskAssessment" />

      {/* ── 8. Keyword Clustering ──────────────────────────── */}
      {strategy.keywordClustering?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{sn(8)}. Klastry słów kluczowych ({strategy.keywordClustering.length})</Text>

            {/* Cluster comparison chart */}
            {(() => {
              const maxVol = Math.max(...strategy.keywordClustering.map((c: any) => c.totalSearchVolume ?? 0), 1);
              const sorted = [...strategy.keywordClustering].sort((a: any, b: any) => (b.totalSearchVolume ?? 0) - (a.totalSearchVolume ?? 0));
              return (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.subsectionTitle}>Porównanie wolumenu i trudności</Text>
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Klaster</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 4 }]}>Wolumen wyszukiwań</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Trudn.</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Słowa kl.</Text>
                    </View>
                    {sorted.map((c: any, i: number) => {
                      const volPct = ((c.totalSearchVolume ?? 0) / maxVol) * 100;
                      const diffColor = c.avgDifficulty >= 70 ? colors.error : c.avgDifficulty >= 40 ? colors.warning : colors.success;
                      return (
                        <View key={i} style={[styles.tableRow, { alignItems: "center" }]}>
                          <Text style={[styles.tableCell, { flex: 2.5, fontFamily: "Inter", fontWeight: 600 }]}>{c.clusterName}</Text>
                          <View style={{ flex: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <View style={{ flex: 1, height: 10, backgroundColor: colors.bgMuted, borderRadius: 2 }}>
                              <View style={{ width: `${volPct}%`, height: 10, backgroundColor: colors.brand, borderRadius: 2 }} />
                            </View>
                            <Text style={{ fontSize: 8, fontFamily: "Inter", color: colors.primary, width: 40, textAlign: "right" }}>{(c.totalSearchVolume ?? 0).toLocaleString()}</Text>
                          </View>
                          <Text style={[styles.tableCell, { flex: 1, color: diffColor, fontFamily: "Inter", fontWeight: 700 }]}>{c.avgDifficulty}</Text>
                          <Text style={[styles.tableCell, { flex: 1 }]}>{c.keywords?.length ?? 0}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {strategy.keywordClustering.map((c: any, i: number) => (
              <View key={i} style={{ marginBottom: 10, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={styles.textBold}>{c.clusterName}</Text>
                  <Text style={styles.textSmall}>Wol.: {c.totalSearchVolume?.toLocaleString()} | Trudn.: {c.avgDifficulty}</Text>
                </View>
                <Text style={[styles.textSmall, { marginBottom: 4 }]}>Temat: {c.theme}</Text>
                <Text style={[styles.textSmall, { marginBottom: 4 }]}>Słowa kluczowe: {c.keywords?.join(", ")}</Text>
                <Text style={styles.textSmallBold}>→ {c.suggestedContentPiece}</Text>
              </View>
            ))}
          </View>
          <PageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="keywordClustering" />

      {/* ── 9. ROI Forecast ─────────────────────────────────── */}
      {strategy.roiForecast && (strategy.roiForecast.currentEstimatedTraffic != null || strategy.roiForecast.projectedTraffic30d != null || strategy.roiForecast.keyDrivers?.length > 0) && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{sn(9)}. Prognoza ROI</Text>
            <View style={styles.metricsRow}>
              <MetricBox value={strategy.roiForecast.currentEstimatedTraffic?.toLocaleString()} label="Aktualny ruch" />
              <MetricBox value={strategy.roiForecast.projectedTraffic30d?.toLocaleString()} label="Prognoza 30 dni" />
              <MetricBox value={strategy.roiForecast.projectedTraffic90d?.toLocaleString()} label="Prognoza 90 dni" />
            </View>

            {/* Traffic growth bar */}
            <View style={{ marginBottom: 10 }}>
              <HorizontalBar label="Aktualny" value={strategy.roiForecast.currentEstimatedTraffic ?? 0} max={Math.max(strategy.roiForecast.projectedTraffic90d ?? 1, 1)} color={colors.tertiary} />
              <HorizontalBar label="30 dni" value={strategy.roiForecast.projectedTraffic30d ?? 0} max={Math.max(strategy.roiForecast.projectedTraffic90d ?? 1, 1)} color={colors.warning} />
              <HorizontalBar label="90 dni" value={strategy.roiForecast.projectedTraffic90d ?? 0} max={Math.max(strategy.roiForecast.projectedTraffic90d ?? 1, 1)} color={colors.success} />
            </View>

            {strategy.roiForecast.keyDrivers?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Kluczowe czynniki</Text>
                {strategy.roiForecast.keyDrivers.map((d: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
                    <Text style={styles.text}>•</Text>
                    <Text style={[styles.text, { flex: 1 }]}>{d}</Text>
                  </View>
                ))}
              </>
            )}
            {strategy.roiForecast.assumptions?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Założenia</Text>
                {strategy.roiForecast.assumptions.map((a: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
                    <Text style={styles.text}>•</Text>
                    <Text style={[styles.text, { flex: 1 }]}>{a}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
          <PageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="roiForecast" />

      {/* ── 10. Action Plan + Gantt ─────────────────────────── */}
      {strategy.actionPlan?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{sn(10)}. Plan działania ({strategy.actionPlan.length})</Text>

            {/* Gantt Timeline */}
            <Text style={styles.subsectionTitle}>Oś czasu</Text>
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 4, marginBottom: 12 }}>
              {/* Gantt header */}
              <View style={{ flexDirection: "row", backgroundColor: colors.bgMuted, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ width: "40%", padding: 4 }}>
                  <Text style={[styles.tableHeaderCell]}>Działanie</Text>
                </View>
                {["M1", "M2", "M3", "M4", "M5", "M6"].map((m) => (
                  <View key={m} style={{ flex: 1, padding: 4, borderLeftWidth: 1, borderLeftColor: colors.border, alignItems: "center" }}>
                    <Text style={styles.tableHeaderCell}>{m}</Text>
                  </View>
                ))}
              </View>
              {/* Gantt rows */}
              {[...strategy.actionPlan].sort((a: any, b: any) => a.priority - b.priority).map((item: any, i: number) => {
                const [start, end] = timeframeMonths[item.timeframe] ?? [0, 2];
                const adj = effortAdj[item.effort] ?? 0;
                const barStart = Math.max(0, start);
                const barEnd = Math.min(6, end + adj);
                const leftPct = (barStart / 6) * 100;
                const widthPct = Math.max(((barEnd - barStart) / 6) * 100, 8);
                const barColor = catColors[item.category] ?? colors.brand;

                return (
                  <View key={i} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 22 }}>
                    <View style={{ width: "40%", padding: 4, justifyContent: "center" }}>
                      <Text style={{ fontSize: 8, fontFamily: "Inter", color: colors.primary }}>{item.priority}. {item.action}</Text>
                    </View>
                    <View style={{ flex: 1, position: "relative", justifyContent: "center" }}>
                      {/* Grid lines */}
                      {[0, 1, 2, 3, 4, 5].map((mi) => (
                        <View key={mi} style={{ position: "absolute", left: `${(mi / 6) * 100}%`, top: 0, bottom: 0, width: 1, backgroundColor: colors.border }} />
                      ))}
                      {/* Bar */}
                      <View style={{
                        position: "absolute",
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: 10,
                        backgroundColor: barColor,
                        borderRadius: 2,
                        top: 6,
                      }} />
                    </View>
                  </View>
                );
              })}
              {/* Legend */}
              <View style={{ flexDirection: "row", padding: 4, gap: 12 }}>
                {Object.entries(catColors).map(([cat, col]) => (
                  <View key={cat} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <View style={{ width: 8, height: 8, backgroundColor: col, borderRadius: 1 }} />
                    <Text style={{ fontSize: 8, fontFamily: "Inter", color: colors.tertiary }}>{cat}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Detailed list */}
            <Text style={styles.subsectionTitle}>Szczegółowe działania</Text>
            {[...strategy.actionPlan].sort((a: any, b: any) => a.priority - b.priority).map((item: any, i: number) => (
              <View key={i} wrap={false} style={styles.recItem}>
                <Text style={[styles.recPriority, {
                  backgroundColor: item.effort === "high" ? colors.errorLight : item.effort === "medium" ? colors.warningLight : colors.bgMuted,
                  color: item.effort === "high" ? colors.error : item.effort === "medium" ? colors.warning : colors.secondary,
                }]}>
                  P{item.priority}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.textBold}>{item.action}</Text>
                  <Text style={styles.textSmall}>
                    {item.category} · {item.effort} effort · {item.timeframe}
                  </Text>
                  {item.expectedImpact && <Text style={styles.textSmall}>{item.expectedImpact}</Text>}
                </View>
              </View>
            ))}
          </View>
          <PageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="actionPlan" />

      {/* ── Actionable Steps (optional) ───────────────────── */}
      {hasActionableSteps && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{sn(10) + 1}. Kroki do wykonania ({strategy.actionableSteps.length})</Text>
            <Text style={[styles.textSmall, { color: colors.tertiary, marginBottom: 10 }]}>Szczegółowe briefy wdrożeniowe z konkretną specyfikacją</Text>
            {strategy.actionableSteps.map((step: any, i: number) => (
              <View key={i} wrap={false} style={{ marginBottom: 12, borderRadius: 6, overflow: "hidden" }}>
                {/* Step header */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.bgTertiary, padding: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: colors.brand, justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 9, fontFamily: "Inter", fontWeight: 700 }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.textBold}>{step.title}</Text>
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                      <Text style={[styles.caption, { color: colors.brand }]}>{step.type?.toUpperCase()}</Text>
                      {step.goal && <Text style={[styles.caption, { color: colors.tertiary }]}>{step.goal}</Text>}
                    </View>
                  </View>
                </View>
                {/* Specs */}
                {step.specs && Object.keys(step.specs).length > 0 && (
                  <View style={{ padding: 10, gap: 4 }}>
                    {Object.entries(step.specs).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && (v as any[]).length === 0)).map(([key, value]: [string, any]) => (
                      <View key={key} style={{ flexDirection: "row", gap: 4 }}>
                        <Text style={[styles.caption, { color: colors.tertiary, width: 90, textTransform: "uppercase" }]}>{key.replace(/([A-Z])/g, " $1").trim()}</Text>
                        <Text style={[styles.textSmall, { flex: 1 }]}>{Array.isArray(value) ? value.join(", ") : String(value)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {/* Notes */}
                {step.notes && (
                  <View style={{ padding: 10, paddingTop: 0 }}>
                    <Text style={[styles.textSmall, { color: colors.tertiary }]}>{step.notes}</Text>
                  </View>
                )}
                {/* Mockup — visual wireframe in PDF */}
                {step.mockup && Array.isArray(step.mockup) && step.mockup.length > 0 && (
                  <View style={{ margin: 10, marginTop: 0, borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
                    <Text style={[styles.caption, { color: colors.tertiary, padding: 6, paddingBottom: 2, textTransform: "uppercase" }]}>MOCKUP TREŚCI</Text>
                    {step.mockup.map((sec: any, si: number) => {
                      const bgColors: Record<string, string> = {
                        hero: "#EEF2FF", features: "#EFF6FF", content: "#F9FAFB", faq: "#FFFBEB",
                        cta: "#ECFDF5", testimonials: "#FAF5FF", stats: "#EEF2FF", comparison: "#FDF2F8",
                        steps: "#F0FDFA", gallery: "#FFF1F2",
                      };
                      return (
                        <View key={si} style={{ backgroundColor: bgColors[sec.type] ?? "#F9FAFB", padding: 8, borderBottomWidth: si < step.mockup.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                          <Text style={[styles.caption, { color: colors.tertiary, marginBottom: 1 }]}>{sec.type?.toUpperCase()}</Text>
                          <Text style={[si === 0 ? styles.textBold : styles.text, { fontSize: si === 0 ? 10 : 9 }]}>{sec.heading}</Text>
                          {sec.content && <Text style={[styles.caption, { color: colors.secondary, marginTop: 1 }]}>{sec.content}</Text>}
                          {sec.items?.length > 0 && (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                              {sec.items.map((item: string, j: number) => (
                                <Text key={j} style={{ fontSize: 7, fontFamily: "Inter", color: colors.secondary, backgroundColor: "#F3F4F6", borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 }}>
                                  {sec.type === "faq" ? `${j + 1}. ${item}` : item}
                                </Text>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </View>
          <PageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="actionableSteps" />
    </Document>
  );
}

// ─── Logo Loader ─────────────────────────────────────────────────

let _logoPngCache: string | null = null;

async function getLogoPng(): Promise<string | undefined> {
  if (_logoPngCache) return _logoPngCache;
  try {
    // Convert SVG logo to PNG via canvas (react-pdf Image only supports raster)
    const png = await svgToPngDataUri("/logo-dark.svg", 320);
    _logoPngCache = png;
    return png;
  } catch {
    console.warn("Could not load logo for PDF");
    return undefined;
  }
}

// ─── Export: Generate PDF Blob ───────────────────────────────────

export async function generateDomainReportPdf(
  reportData: any,
  domainName: string,
  profile?: ReportProfile,
  reportConfig?: ReportConfig
): Promise<Blob> {
  const logoSrc = await getLogoPng();
  const resolvedConfig = profile === "custom" && reportConfig
    ? reportConfig
    : configFromPreset((profile ?? "full") as Exclude<ReportProfile, "custom">);
  const doc = <SEOReportDocument data={reportData} domainName={domainName} logoSrc={logoSrc} reportConfig={resolvedConfig} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}

export async function generateStrategyPdf(
  strategy: any,
  domain: string,
  date: string,
  options?: {
    businessDescription?: string;
    targetCustomer?: string;
    dataSnapshot?: any;
    drillDowns?: any[];
  }
): Promise<Blob> {
  const logoSrc = await getLogoPng();
  const doc = (
    <StrategyPdfDocument
      strategy={strategy}
      domain={domain}
      date={date}
      businessDescription={options?.businessDescription}
      targetCustomer={options?.targetCustomer}
      dataSnapshot={options?.dataSnapshot}
      drillDowns={options?.drillDowns}
      logoSrc={logoSrc}
    />
  );
  const blob = await pdf(doc).toBlob();
  return blob;
}
