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

// ─── Strategy PDF — Electra Consulting Theme ─────────────────────

const el = {
  coverBg: "#1B2838",
  teal: "#0D7377",
  tealLight: "#0E9AA7",
  tealBadge: "#CCFBF1",
  gold: "#D4A843",
  white: "#FFFFFF",
  offWhite: "#F9FAFB",
  lightGray: "#F5F7F9",
  textDark: "#1A2332",
  textBody: "#374151",
  textGray: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  success: "#10B981",
  successBg: "#D1FAE5",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  error: "#EF4444",
  errorBg: "#FEE2E2",
};

const catColorsEl: Record<string, string> = {
  content: el.teal,
  technical: el.warning,
  links: el.success,
  keywords: el.tealLight,
};

const timeframeMonths: Record<string, [number, number]> = {
  immediate: [0, 1],
  "short-term": [1, 3],
  "long-term": [3, 6],
};

const effortAdj: Record<string, number> = { low: -0.5, medium: 0, high: 0.5 };

const EL_SEVERITY: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: el.errorBg,   text: el.error,    label: "WYSOKI" },
  medium: { bg: el.warningBg, text: el.warning,   label: "ŚREDNI" },
  low:    { bg: el.lightGray, text: el.textMuted,  label: "NISKI" },
};

// ─── Electra Theme Components ────────────────────────────────────

function ElPageHeader({ domain, date }: { domain: string; date?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 24 }}>
      <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {domain.toUpperCase()} — Raport strategii SEO
      </Text>
      {date && <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textMuted }}>{date}</Text>}
    </View>
  );
}

function ElPageFooter() {
  return (
    <View style={{ position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 7, fontFamily: "Inter", color: el.textMuted }}>Przygotowane przez DOSEO.app</Text>
      <Text
        style={{ fontSize: 7, fontFamily: "Inter", color: el.textMuted }}
        render={({ pageNumber, totalPages }) => `Strona ${pageNumber} z ${totalPages}`}
      />
    </View>
  );
}

function ElSectionTitle({ number, children }: { number?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 22, fontFamily: "Inter", fontWeight: 700, color: el.teal, marginBottom: 8 }}>
        {number ? `${number} ` : ""}{children}
      </Text>
      <View style={{ height: 1, backgroundColor: el.border }} />
    </View>
  );
}

function ElSubTitle({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <Text style={{ fontSize: 15, fontFamily: "Inter", fontWeight: 700, color: color ?? el.teal, marginBottom: 8, marginTop: 14 }}>{children}</Text>
  );
}

/** Left-border callout box (Electra "insight" box) */
function ElCallout({ title, children, borderColor }: { title?: string; children: React.ReactNode; borderColor?: string }) {
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: borderColor ?? el.teal, backgroundColor: el.lightGray, padding: 14, marginBottom: 12, marginTop: 6 }}>
      {title && <Text style={{ fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: el.textDark, marginBottom: 4 }}>{title}</Text>}
      {children}
    </View>
  );
}

/** Metric card with top accent line (Electra dashboard card) */
function ElMetricCard({ value, label, description, accentColor, valueColor }: {
  value: string | number | null | undefined; label: string; description?: string; accentColor?: string; valueColor?: string;
}) {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: el.border, borderRadius: 4, overflow: "hidden" }}>
      <View style={{ height: 3, backgroundColor: accentColor ?? el.teal }} />
      <View style={{ padding: 10 }}>
        <Text style={{ fontSize: 18, fontFamily: "Inter", fontWeight: 700, color: valueColor ?? el.teal }}>{String(value ?? "—")}</Text>
        <Text style={{ fontSize: 7, fontFamily: "Inter", color: el.textGray, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{label}</Text>
        {description && <Text style={{ fontSize: 7, fontFamily: "Inter", color: el.textMuted, marginTop: 1 }}>{description}</Text>}
      </View>
    </View>
  );
}

/** Horizontal bar chart row (Electra bar chart) */
function ElHorizontalBar({ label, value, max, color, showLabel }: {
  label: string; value: number; max: number; color: string; showLabel?: string;
}) {
  const pct = max > 0 ? Math.min(((value ?? 0) / max) * 100, 100) : 0;
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textDark, marginBottom: 2 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ flex: 1, height: 18, backgroundColor: el.borderLight, borderRadius: 2 }}>
          <View style={{ height: 18, width: `${Math.max(pct, 5)}%`, backgroundColor: color, borderRadius: 2, justifyContent: "center", paddingLeft: 6 }}>
            <Text style={{ fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.white }}>{String(value ?? 0)}</Text>
          </View>
        </View>
        {showLabel && <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textMuted, width: 60, textAlign: "right" }}>{showLabel}</Text>}
      </View>
    </View>
  );
}

/** Status badge / pill (Electra style) */
function ElBadge({ text, color, bgColor }: { text: string; color?: string; bgColor?: string }) {
  return (
    <View style={{ backgroundColor: bgColor ?? el.tealBadge, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: "flex-start" }}>
      <Text style={{ fontSize: 7, fontFamily: "Inter", fontWeight: 700, color: color ?? el.teal, textTransform: "uppercase", letterSpacing: 0.3 }}>{text}</Text>
    </View>
  );
}

function ElTocEntry({ number, title }: { number: string; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: el.border }}>
      <Text style={{ fontSize: 12, fontFamily: "Inter", fontWeight: 700, color: el.teal, width: 36 }}>{number}</Text>
      <Text style={{ fontSize: 12, fontFamily: "Inter", color: el.textDark, flex: 1 }}>{title}</Text>
    </View>
  );
}

// ─── Electra Markdown & Table ────────────────────────────────────

/** Render markdown text with bold, italic, link stripping, and cleanup */
/** Strip markdown formatting + emoji from plain text (for table cells, headers, etc.) */
function cleanMdPlain(text: string): string {
  if (!text) return "";
  let s = text;
  // Strip markdown links: [text](url) → text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Strip inline code backticks: `code` → code
  s = s.replace(/`([^`]+)`/g, "$1");
  // Strip bold/italic markers
  s = s.replace(/\*{1,3}/g, "");
  // Strip emoji that react-pdf can't render (supplementary plane + common emoji)
  // eslint-disable-next-line no-misleading-character-class
  s = s.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "");
  // Replace common text-emoji with readable alternatives
  s = s.replace(/⬆️?/g, "^").replace(/⬇️?/g, "v").replace(/⚠️?/g, "(!)")
    .replace(/✅/g, "[OK]").replace(/❌/g, "[X]").replace(/🔴/g, "(!)").replace(/🟡/g, "(~)").replace(/🟢/g, "(+)")
    .replace(/➡️?/g, "->").replace(/📈/g, "^").replace(/📉/g, "v");
  // Collapse whitespace
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

function PdfMarkdown({ text, style }: { text: string; style?: any }) {
  if (!text) return null;
  // 1. Strip markdown links: [text](url) → text
  let cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // 2. Strip inline code backticks: `code` → code
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");
  // 3. Strip emoji
  // eslint-disable-next-line no-misleading-character-class
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "");
  cleaned = cleaned.replace(/⬆️?/g, "^").replace(/⬇️?/g, "v").replace(/⚠️?/g, "(!)")
    .replace(/✅/g, "[OK]").replace(/❌/g, "[X]").replace(/🔴/g, "(!)").replace(/🟡/g, "(~)").replace(/🟢/g, "(+)")
    .replace(/➡️?/g, "->").replace(/📈/g, "^").replace(/📉/g, "v");

  // 3. Parse bold (**text**) — strip single-asterisk italic markers (no italic font registered)
  const tokens: { text: string; bold: boolean }[] = [];
  const boldParts = cleaned.split(/(\*\*[^*]+\*\*)/g);
  for (const bp of boldParts) {
    if (bp.startsWith("**") && bp.endsWith("**")) {
      tokens.push({ text: bp.slice(2, -2), bold: true });
    } else {
      // Strip any remaining asterisks (italic markers, stray)
      const plain = bp.replace(/\*/g, "");
      if (plain) tokens.push({ text: plain, bold: false });
    }
  }

  return (
    <Text style={[{ fontSize: 10, fontFamily: "Inter", color: el.textBody, lineHeight: 1.6 }, style]}>
      {tokens.map((t, i) => {
        if (t.bold) return <Text key={i} style={{ fontFamily: "Inter", fontWeight: 700, color: el.textDark }}>{t.text}</Text>;
        return <Text key={i}>{t.text}</Text>;
      })}
    </Text>
  );
}

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
  if (!md) return [];
  const lines = md.split("\n");
  const blocks: PdfMdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) { blocks.push({ type: "blank" }); i++; continue; }

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

    if (trimmed.startsWith("## ")) { blocks.push({ type: "h2", text: cleanMdPlain(trimmed.slice(3)) }); i++; continue; }
    if (trimmed.startsWith("### ")) { blocks.push({ type: "h3", text: cleanMdPlain(trimmed.slice(4)) }); i++; continue; }
    if (/^[-*]\s/.test(trimmed)) { blocks.push({ type: "bullet", text: trimmed.replace(/^[-*]\s+/, "") }); i++; continue; }
    // Match numbered lists: "1. text", "**1.** text", "**1**. text"
    if (/^\d+\.\s/.test(trimmed) || /^\*\*\d+\.?\*\*\.?\s/.test(trimmed)) {
      const cleanedNum = trimmed.replace(/^\*\*(\d+\.?)\*\*\.?\s*/, "$1 ");
      blocks.push({ type: "numbered", text: cleanedNum });
      i++;
      continue;
    }

    blocks.push({ type: "paragraph", text: trimmed });
    i++;
  }
  return blocks;
}

/** Electra-style table: teal header, alternating white/offWhite rows */
function PdfTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const colCount = headers.length;
  // Small tables (≤6 rows) keep together; larger tables allow page breaks
  const shouldWrap = rows.length > 6;
  return (
    <View wrap={shouldWrap} style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, marginVertical: 6, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", backgroundColor: el.teal, paddingVertical: 6, paddingHorizontal: 8 }}>
        {headers.map((h, hi) => (
          <Text key={hi} style={{ flex: 1, fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.white, paddingRight: 10 }}>{cleanMdPlain(h)}</Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} wrap={false} style={{ flexDirection: "row", borderBottomWidth: ri < rows.length - 1 ? 1 : 0, borderBottomColor: el.borderLight, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: ri % 2 === 1 ? el.offWhite : el.white }}>
          {row.slice(0, colCount).map((cell, ci) => (
            <Text key={ci} style={{ flex: 1, fontSize: 9, fontFamily: "Inter", fontWeight: ci === 0 ? 600 : 400, color: ci === 0 ? el.textDark : el.textBody, paddingRight: 10 }}>{cleanMdPlain(cell)}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Drill-down pages in Electra style */
function DrillDownPages({ drillDowns, sectionKey, domain, date }: { drillDowns: any[]; sectionKey: string; domain: string; date?: string }) {
  const items = drillDowns?.filter((d: any) => d.sectionKey === sectionKey) ?? [];
  if (items.length === 0) return null;

  return (
    <>
      {items.map((ddItem: any, i: number) => {
        const blocks = parsePdfMarkdownBlocks(ddItem.response);
        return (
          <Page key={`dd-${sectionKey}-${i}`} size="A4" style={elPage}>
            <ElPageHeader domain={domain} date={date} />
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <View style={{ width: 3, height: 16, backgroundColor: el.teal, marginRight: 8 }} />
                <Text style={{ fontSize: 13, fontFamily: "Inter", fontWeight: 700, color: el.teal }}>
                  {ddItem.question ? `Pogłębiona analiza: ${ddItem.question}` : `Pogłębiona analiza`}
                </Text>
              </View>
              <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textMuted, marginBottom: 10 }}>
                {new Date(ddItem.createdAt).toLocaleString()}
              </Text>
              {blocks.map((block: PdfMdBlock, bi: number) => {
                switch (block.type) {
                  case "blank": return <Text key={bi} style={{ height: 6 }}>{" "}</Text>;
                  case "h2": return <Text key={bi} style={{ fontSize: 13, fontFamily: "Inter", fontWeight: 700, color: el.teal, marginTop: 8 }}>{block.text}</Text>;
                  case "h3": return <Text key={bi} style={{ fontSize: 11, fontFamily: "Inter", fontWeight: 700, color: el.textDark, marginTop: 6 }}>{block.text}</Text>;
                  case "bullet": return <PdfMarkdown key={bi} text={`  • ${block.text}`} />;
                  case "numbered": return <PdfMarkdown key={bi} text={`  ${block.text}`} />;
                  case "paragraph": return <PdfMarkdown key={bi} text={block.text} />;
                  case "callout":
                    return <ElCallout key={bi}><PdfMarkdown text={block.text} /></ElCallout>;
                  case "table":
                    return <PdfTable key={bi} headers={block.headers} rows={block.rows} />;
                }
              })}
            </View>
            <ElPageFooter />
          </Page>
        );
      })}
    </>
  );
}

// ─── Strategy PDF Document (Electra Theme) ───────────────────────

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

const elPage = { padding: 40, fontSize: 10, fontFamily: "Inter" as const, color: el.textBody, backgroundColor: el.white };

function StrategyPdfDocument({ strategy, domain, date, businessDescription, targetCustomer, dataSnapshot, drillDowns, logoSrc }: StrategyPdfProps) {
  const dd = drillDowns ?? [];
  const hasBacklinkContent = strategy.backlinkContentExamples?.length > 0;
  const hasActionableSteps = strategy.actionableSteps?.length > 0;
  const sn = (base: number) => base + (hasBacklinkContent && base > 5 ? 1 : 0);
  const backlinkContentNum = 6;

  return (
    <Document>
      {/* ── Cover Page (Dark, Electra-style) ──────────────── */}
      <Page size="A4" style={{ padding: 0, backgroundColor: el.coverBg }}>
        {/* Right-edge vertical gold→teal gradient line */}
        <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 6 }}>
          <View style={{ flex: 1, backgroundColor: el.gold }} />
          <View style={{ flex: 1, backgroundColor: "#8EAA3B" }} />
          <View style={{ flex: 2, backgroundColor: el.teal }} />
        </View>

        <View style={{ paddingTop: 180, paddingHorizontal: 60, paddingBottom: 60, flex: 1 }}>
          {logoSrc && <Image src={logoSrc} style={{ width: 140, marginBottom: 40 }} />}

          <Text style={{ fontSize: 36, fontFamily: "Inter", fontWeight: 700, color: el.white, marginBottom: 8, lineHeight: 1.2 }}>Raport strategii SEO</Text>
          <Text style={{ fontSize: 16, fontFamily: "Inter", color: "#9CA3AF", marginBottom: 16 }}>{domain} — Kompleksowa strategia pozycjonowania</Text>

          {/* Gold accent line */}
          <View style={{ width: 80, height: 4, backgroundColor: el.gold, marginBottom: 24 }} />

          {businessDescription && (
            <Text style={{ fontSize: 10, fontFamily: "Inter", color: "#9CA3AF", lineHeight: 1.6, marginBottom: 20, maxWidth: 420 }}>{businessDescription}</Text>
          )}

          {/* Metadata table */}
          <View style={{ marginTop: "auto" }}>
            <View style={{ height: 1, backgroundColor: "#374151", marginBottom: 16 }} />
            {[
              ["Data opracowania", date],
              ["Przygotowane przez", "DOSEO.app"],
              ["Domena", domain],
              ["Typ dokumentu", "Raport strategii SEO"],
              ...(targetCustomer ? [["Klient docelowy", targetCustomer]] : []),
            ].map(([label, value], i) => (
              <View key={i} style={{ flexDirection: "row", marginBottom: 6 }}>
                <Text style={{ width: 150, fontSize: 9, fontFamily: "Inter", color: "#9CA3AF" }}>{label}</Text>
                <Text style={{ fontSize: 9, fontFamily: "Inter", fontWeight: 600, color: el.white }}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>

      {/* ── Table of Contents (White page) ────────────────── */}
      <Page size="A4" style={elPage}>
        <ElPageHeader domain={domain} date={date} />
        <View style={{ marginTop: 20, marginBottom: 20 }}>
          <ElSectionTitle>Spis treści</ElSectionTitle>
          {(() => {
            const toc: string[] = [
              "Podsumowanie wykonawcze",
              "Szybkie korzyści",
              "Strategia treści",
              "Analiza konkurencji",
              "Strategia linkowa",
            ];
            if (strategy.backlinkContentExamples?.length > 0) toc.push("Pomysły na treści backlinkowe");
            toc.push("Techniczne SEO", "Ocena ryzyka", "Klastry słów kluczowych", "Prognoza ROI", "Plan działania");
            if (strategy.actionableSteps?.length > 0) toc.push("Kroki do wykonania");
            return toc.map((title, i) => <ElTocEntry key={i} number={`${i + 1}.`} title={title} />);
          })()}
        </View>
        <ElPageFooter />
      </Page>

      {/* ── 1. Executive Summary ───────────────────────────── */}
      <Page size="A4" style={elPage}>
        <ElPageHeader domain={domain} date={date} />
        <View style={{ marginBottom: 20 }}>
          <ElSectionTitle number="1.">Podsumowanie wykonawcze</ElSectionTitle>

          {(() => {
            const blocks = parsePdfMarkdownBlocks(strategy.executiveSummary ?? "");
            return blocks.map((block: PdfMdBlock, bi: number) => {
              if (block.type === "blank") return <View key={bi} style={{ height: 6 }} />;
              if (block.type === "h2") return <Text key={bi} style={{ fontSize: 13, fontFamily: "Inter", fontWeight: 700, color: el.teal, marginTop: bi > 0 ? 10 : 0 }}>{block.text}</Text>;
              if (block.type === "h3") return <Text key={bi} style={{ fontSize: 11, fontFamily: "Inter", fontWeight: 700, color: el.textDark, marginTop: 8, marginBottom: 2 }}>{block.text}</Text>;
              if (block.type === "bullet") return <View key={bi} style={{ flexDirection: "row", paddingLeft: 10, marginBottom: 2 }}><Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody }}>•  </Text><PdfMarkdown text={block.text} /></View>;
              if (block.type === "numbered") return <View key={bi} style={{ paddingLeft: 10, marginBottom: 2 }}><PdfMarkdown text={block.text} /></View>;
              if (block.type === "callout") return <ElCallout key={bi}><PdfMarkdown text={block.text} /></ElCallout>;
              if (block.type === "table") return <PdfTable key={bi} headers={block.headers} rows={block.rows} />;
              return <Text key={bi} style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody, lineHeight: 1.6, marginBottom: 4, textAlign: "justify" }}>{block.text}</Text>;
            });
          })()}

          {dataSnapshot && (
            <>
              <ElSubTitle>Kluczowe dane</ElSubTitle>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                {dataSnapshot.keywordCount != null && <ElMetricCard value={dataSnapshot.keywordCount} label="Słowa kluczowe" />}
                {dataSnapshot.competitorCount != null && <ElMetricCard value={dataSnapshot.competitorCount} label="Konkurenci" />}
                {dataSnapshot.contentGapCount != null && <ElMetricCard value={dataSnapshot.contentGapCount} label="Luki w treści" />}
                {dataSnapshot.backlinkCount != null && <ElMetricCard value={dataSnapshot.backlinkCount} label="Linki zwrotne" />}
              </View>
              {(dataSnapshot.avgPosition != null || dataSnapshot.topKeywordsCount != null) && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  {dataSnapshot.avgPosition != null && <ElMetricCard value={dataSnapshot.avgPosition} label="Śr. pozycja" />}
                  {dataSnapshot.topKeywordsCount != null && <ElMetricCard value={dataSnapshot.topKeywordsCount} label="W TOP-10" />}
                  {dataSnapshot.healthScore != null && <ElMetricCard value={`${dataSnapshot.healthScore}/100`} label="Wynik zdrowia" />}
                  {dataSnapshot.totalTraffic != null && <ElMetricCard value={dataSnapshot.totalTraffic} label="Szac. ruch" />}
                </View>
              )}
            </>
          )}

          <ElSubTitle>Zakres strategii</ElSubTitle>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {strategy.quickWins?.length > 0 && <ElMetricCard value={strategy.quickWins.length} label="Szybkich korzyści" accentColor={el.success} valueColor={el.success} />}
            {strategy.contentStrategy?.length > 0 && <ElMetricCard value={strategy.contentStrategy.length} label="Strategii treści" accentColor={el.teal} />}
            {strategy.competitorAnalysis?.length > 0 && <ElMetricCard value={strategy.competitorAnalysis.length} label="Analiz konkurencji" accentColor={el.warning} valueColor={el.warning} />}
            {strategy.riskAssessment?.length > 0 && <ElMetricCard value={strategy.riskAssessment.length} label="Ryzyk do oceny" accentColor={el.error} valueColor={el.error} />}
            {strategy.keywordClustering?.length > 0 && <ElMetricCard value={strategy.keywordClustering.length} label="Klastrów słów kluczowych" accentColor={el.textMuted} valueColor={el.textGray} />}
            {strategy.actionPlan?.length > 0 && <ElMetricCard value={strategy.actionPlan.length} label="Działań w planie" accentColor={el.textMuted} valueColor={el.textGray} />}
          </View>
        </View>
        <ElPageFooter />
      </Page>
      <DrillDownPages drillDowns={dd} sectionKey="executiveSummary" domain={domain} date={date} />

      {/* ── 2. Quick Wins ──────────────────────────────────── */}
      {strategy.quickWins?.length > 0 && (
        <Page size="A4" style={elPage}>
          <ElPageHeader domain={domain} date={date} />
          <View style={{ marginBottom: 20 }}>
            <ElSectionTitle number="2.">Szybkie korzyści ({strategy.quickWins.length})</ElSectionTitle>
            {strategy.quickWins.map((qw: any, i: number) => {
              const diffColor = qw.difficulty >= 70 ? el.error : qw.difficulty >= 40 ? el.warning : el.success;
              const diffBg = qw.difficulty >= 70 ? el.errorBg : qw.difficulty >= 40 ? el.warningBg : el.successBg;
              return (
                <View key={i} wrap={false} style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, marginBottom: 10, overflow: "hidden" }}>
                  <View style={{ height: 3, backgroundColor: el.teal }} />
                  <View style={{ padding: 12 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter", fontWeight: 700, color: el.textDark }}>{qw.keyword}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textGray }}>#{qw.currentPosition}</Text>
                        <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textMuted }}>→</Text>
                        <Text style={{ fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: el.success }}>#{qw.targetPosition}</Text>
                      </View>
                    </View>
                    {qw.existingPage && (
                      <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.teal, marginBottom: 4 }}>Strona: {qw.existingPage}</Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 12, marginBottom: qw.actionItems?.length > 0 ? 8 : 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textGray }}>Trudność:</Text>
                        <ElBadge text={String(qw.difficulty)} color={diffColor} bgColor={diffBg} />
                      </View>
                      <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textGray }}>Wolumen: {qw.searchVolume?.toLocaleString()}</Text>
                      {qw.estimatedTrafficGain && <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textGray }}>Wzrost: {qw.estimatedTrafficGain}</Text>}
                    </View>
                    {qw.actionItems?.length > 0 && (
                      <ElCallout title="Działania do podjęcia">
                        {qw.actionItems.map((a: string, j: number) => (
                          <View key={j} style={{ flexDirection: "row", gap: 6, marginBottom: j < qw.actionItems.length - 1 ? 3 : 0 }}>
                            <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody }}>•</Text>
                            <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody, flex: 1, lineHeight: 1.5 }}>{a}</Text>
                          </View>
                        ))}
                      </ElCallout>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          <ElPageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="quickWins" domain={domain} date={date} />

      {/* ── 3. Content Strategy ─────────────────────────────── */}
      {strategy.contentStrategy?.length > 0 && (
        <Page size="A4" style={elPage}>
          <ElPageHeader domain={domain} date={date} />
          <View style={{ marginBottom: 20 }}>
            <ElSectionTitle number="3.">Strategia treści ({strategy.contentStrategy.length})</ElSectionTitle>

            {(() => {
              const sorted = [...strategy.contentStrategy].sort((a: any, b: any) => b.opportunityScore - a.opportunityScore);
              const maxScore = Math.max(...strategy.contentStrategy.map((d: any) => d.opportunityScore ?? 0), 1);
              return (
                <View style={{ marginBottom: 14 }}>
                  <ElSubTitle>Ranking możliwości</ElSubTitle>
                  {sorted.map((cs: any, i: number) => {
                    const barColor = cs.opportunityScore >= 70 ? el.success : cs.opportunityScore >= 40 ? el.warning : el.error;
                    return (
                      <ElHorizontalBar key={i} label={cs.targetKeyword} value={cs.opportunityScore} max={maxScore} color={barColor} showLabel={`Vol: ${cs.searchVolume?.toLocaleString()}`} />
                    );
                  })}
                </View>
              );
            })()}

            {strategy.contentStrategy.map((cs: any, i: number) => {
              const scoreColor = cs.opportunityScore >= 70 ? el.success : cs.opportunityScore >= 40 ? el.warning : el.error;
              const scoreBg = cs.opportunityScore >= 70 ? el.successBg : cs.opportunityScore >= 40 ? el.warningBg : el.errorBg;
              return (
                <View key={i} wrap={false} style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, marginBottom: 10, overflow: "hidden" }}>
                  <View style={{ height: 3, backgroundColor: el.teal }} />
                  <View style={{ padding: 12 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter", fontWeight: 700, color: el.textDark }}>{cs.targetKeyword}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <ElBadge text={String(cs.opportunityScore)} color={scoreColor} bgColor={scoreBg} />
                        <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textMuted }}>{cs.suggestedContentType}</Text>
                      </View>
                    </View>
                    {cs.existingPage && (
                      <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.teal, marginBottom: 4 }}>Strona: {cs.existingPage}</Text>
                    )}
                    <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textGray, marginBottom: 4 }}>Wolumen: {cs.searchVolume?.toLocaleString()}</Text>
                    {cs.estimatedImpact && <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody, lineHeight: 1.5 }}>{cs.estimatedImpact}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
          <ElPageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="contentStrategy" domain={domain} date={date} />

      {/* ── 4. Competitor Analysis ──────────────────────────── */}
      {strategy.competitorAnalysis?.length > 0 && (
        <Page size="A4" style={elPage}>
          <ElPageHeader domain={domain} date={date} />
          <View style={{ marginBottom: 20 }}>
            <ElSectionTitle number="4.">Analiza konkurencji ({strategy.competitorAnalysis.length})</ElSectionTitle>
            {strategy.competitorAnalysis.map((comp: any, i: number) => (
              <View key={i} wrap={false} style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, marginBottom: 12, overflow: "hidden" }}>
                <View style={{ height: 3, backgroundColor: el.teal }} />
                <View style={{ padding: 14 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter", fontWeight: 700, color: el.teal, marginBottom: 10 }}>{comp.domain}</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                    {comp.strengths?.length > 0 && (
                      <View style={{ flex: 1, backgroundColor: el.successBg, padding: 10, borderRadius: 4 }}>
                        <Text style={{ fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.success, textTransform: "uppercase", marginBottom: 6 }}>MOCNE STRONY</Text>
                        {comp.strengths.map((s: string, j: number) => <Text key={j} style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, marginBottom: 3, lineHeight: 1.4 }}>• {s}</Text>)}
                      </View>
                    )}
                    {comp.weaknesses?.length > 0 && (
                      <View style={{ flex: 1, backgroundColor: el.errorBg, padding: 10, borderRadius: 4 }}>
                        <Text style={{ fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.error, textTransform: "uppercase", marginBottom: 6 }}>SŁABE STRONY</Text>
                        {comp.weaknesses.map((s: string, j: number) => <Text key={j} style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, marginBottom: 3, lineHeight: 1.4 }}>• {s}</Text>)}
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {comp.threatsToUs?.length > 0 && (
                      <View style={{ flex: 1, backgroundColor: el.warningBg, padding: 10, borderRadius: 4 }}>
                        <Text style={{ fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.warning, textTransform: "uppercase", marginBottom: 6 }}>ZAGROŻENIA</Text>
                        {comp.threatsToUs.map((s: string, j: number) => <Text key={j} style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, marginBottom: 3, lineHeight: 1.4 }}>• {s}</Text>)}
                      </View>
                    )}
                    {comp.opportunitiesAgainstThem?.length > 0 && (
                      <View style={{ flex: 1, backgroundColor: el.tealBadge, padding: 10, borderRadius: 4 }}>
                        <Text style={{ fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.teal, textTransform: "uppercase", marginBottom: 6 }}>SZANSE</Text>
                        {comp.opportunitiesAgainstThem.map((s: string, j: number) => <Text key={j} style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, marginBottom: 3, lineHeight: 1.4 }}>• {s}</Text>)}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
          <ElPageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="competitorAnalysis" domain={domain} date={date} />

      {/* ── 5. Backlink Strategy ────────────────────────────── */}
      {strategy.backlinkStrategy && (strategy.backlinkStrategy.profileAssessment || strategy.backlinkStrategy.toxicCleanup || strategy.backlinkStrategy.linkBuildingPriorities?.length > 0) && (
        <Page size="A4" style={elPage}>
          <ElPageHeader domain={domain} date={date} />
          <View style={{ marginBottom: 20 }}>
            <ElSectionTitle number="5.">Strategia linkowa</ElSectionTitle>
            <ElSubTitle>Ocena profilu</ElSubTitle>
            <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody, lineHeight: 1.6, textAlign: "justify" }}>{strategy.backlinkStrategy.profileAssessment}</Text>

            {strategy.backlinkStrategy.toxicCleanup && (
              <ElCallout title={`Czyszczenie toksycznych — ${strategy.backlinkStrategy.toxicCleanup.priority?.toUpperCase()} priorytet (${strategy.backlinkStrategy.toxicCleanup.count} linków)`} borderColor={el.error}>
                <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, lineHeight: 1.5 }}>{strategy.backlinkStrategy.toxicCleanup.description}</Text>
              </ElCallout>
            )}

            {strategy.backlinkStrategy.linkBuildingPriorities?.length > 0 && (
              <>
                <ElSubTitle>Priorytety link buildingu</ElSubTitle>
                {strategy.backlinkStrategy.linkBuildingPriorities.map((p: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: el.teal, width: 16 }}>{i + 1}.</Text>
                    <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody, flex: 1, lineHeight: 1.5 }}>{p}</Text>
                  </View>
                ))}
              </>
            )}

            {strategy.backlinkStrategy.prospectRecommendations && (
              <>
                <ElSubTitle>Rekomendacje prospektów</ElSubTitle>
                <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody, lineHeight: 1.6, textAlign: "justify" }}>{strategy.backlinkStrategy.prospectRecommendations}</Text>
              </>
            )}

            {strategy.backlinkStrategy.topProspects?.length > 0 && (
              <>
                <ElSubTitle>Luki backlinkowe</ElSubTitle>
                <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textMuted, marginBottom: 8 }}>Domeny linkujące do konkurencji, ale nie do Ciebie</Text>
                {strategy.backlinkStrategy.topProspects.map((p: any, i: number) => {
                  const scoreColor = p.score >= 70 ? el.success : p.score >= 40 ? el.warning : el.error;
                  const scoreBg = p.score >= 70 ? el.successBg : p.score >= 40 ? el.warningBg : el.errorBg;
                  return (
                    <View key={i} wrap={false} style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, marginBottom: 8, padding: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <Text style={{ fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: el.textDark }}>{p.domain}</Text>
                            <ElBadge text={`DR ${p.domainRank}`} />
                          </View>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textGray }}>Linki do konkurencji: {p.linksToCompetitors}</Text>
                            <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textMuted }}>{p.competitors?.slice(0, 3).join(", ")}</Text>
                          </View>
                        </View>
                        <View style={{ alignItems: "center", gap: 2 }}>
                          <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textMuted }}>{p.channel}</Text>
                          <ElBadge text={String(p.score)} color={scoreColor} bgColor={scoreBg} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>
          <ElPageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="backlinkStrategy" domain={domain} date={date} />

      {/* ── Backlink Content Examples (optional) ──────────── */}
      {hasBacklinkContent && (
        <Page size="A4" style={elPage}>
          <ElPageHeader domain={domain} date={date} />
          <View style={{ marginBottom: 20 }}>
            <ElSectionTitle number={`${backlinkContentNum}.`}>Pomysły na treści backlinkowe ({strategy.backlinkContentExamples.length})</ElSectionTitle>
            {strategy.backlinkContentExamples.map((ex: any, i: number) => (
              <View key={i} wrap={false} style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, marginBottom: 10, overflow: "hidden" }}>
                <View style={{ height: 3, backgroundColor: el.teal }} />
                <View style={{ padding: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <ElBadge text={ex.type?.toUpperCase() ?? "TREŚĆ"} />
                    {ex.category && <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textMuted }}>· {ex.category}</Text>}
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: "Inter", fontWeight: 700, color: el.textDark, marginBottom: 4 }}>{ex.title}</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, marginBottom: 8, lineHeight: 1.5 }}>{ex.description}</Text>
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {ex.targetSites && (
                      <View style={{ flex: 1, minWidth: "30%" }}>
                        <Text style={{ fontSize: 7, fontFamily: "Inter", fontWeight: 700, color: el.textMuted, textTransform: "uppercase", marginBottom: 1 }}>DOCELOWE STRONY</Text>
                        <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, lineHeight: 1.4 }}>{ex.targetSites}</Text>
                      </View>
                    )}
                    {ex.suggestedAnchorText && (
                      <View style={{ flex: 1, minWidth: "30%" }}>
                        <Text style={{ fontSize: 7, fontFamily: "Inter", fontWeight: 700, color: el.textMuted, textTransform: "uppercase", marginBottom: 1 }}>TEKST KOTWICY</Text>
                        <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, lineHeight: 1.4 }}>{ex.suggestedAnchorText}</Text>
                      </View>
                    )}
                    {ex.emailSubject && (
                      <View style={{ flex: 1, minWidth: "30%" }}>
                        <Text style={{ fontSize: 7, fontFamily: "Inter", fontWeight: 700, color: el.textMuted, textTransform: "uppercase", marginBottom: 1 }}>TEMAT E-MAILA</Text>
                        <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, lineHeight: 1.4 }}>{ex.emailSubject}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
          <ElPageFooter />
        </Page>
      )}

      {/* ── Technical SEO ────────────────────────────────── */}
      {strategy.technicalSEO && (strategy.technicalSEO.healthScore != null || strategy.technicalSEO.criticalFixes?.length > 0 || strategy.technicalSEO.warnings?.length > 0 || strategy.technicalSEO.improvementSteps?.length > 0) && (
        <Page size="A4" style={elPage}>
          <ElPageHeader domain={domain} date={date} />
          <View style={{ marginBottom: 20 }}>
            <ElSectionTitle number={`${sn(6)}.`}>Techniczne SEO</ElSectionTitle>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <ElMetricCard value={`${strategy.technicalSEO.healthScore}/100`} label="Aktualny wynik" />
              <ElMetricCard value={`${strategy.technicalSEO.healthScoreTarget}/100`} label="Docelowy wynik" accentColor={el.success} valueColor={el.success} />
              <ElMetricCard value={strategy.technicalSEO.criticalFixes?.length ?? 0} label="Krytyczne naprawy" accentColor={el.error} valueColor={(strategy.technicalSEO.criticalFixes?.length ?? 0) > 0 ? el.error : undefined} />
              <ElMetricCard value={strategy.technicalSEO.warnings?.length ?? 0} label="Ostrzeżenia" accentColor={el.warning} valueColor={(strategy.technicalSEO.warnings?.length ?? 0) > 0 ? el.warning : undefined} />
            </View>

            {strategy.technicalSEO.criticalFixes?.length > 0 && (
              <>
                <ElSubTitle color={el.error}>Krytyczne naprawy</ElSubTitle>
                {strategy.technicalSEO.criticalFixes.map((f: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                    <Text style={{ fontSize: 9, color: el.error }}>●</Text>
                    <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody, flex: 1, lineHeight: 1.5 }}>{f}</Text>
                  </View>
                ))}
              </>
            )}

            {strategy.technicalSEO.warnings?.length > 0 && (
              <>
                <ElSubTitle color={el.warning}>Ostrzeżenia</ElSubTitle>
                {strategy.technicalSEO.warnings.map((w: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                    <Text style={{ fontSize: 9, color: el.warning }}>▲</Text>
                    <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody, flex: 1, lineHeight: 1.5 }}>{w}</Text>
                  </View>
                ))}
              </>
            )}

            {strategy.technicalSEO.improvementSteps?.length > 0 && (
              <>
                <ElSubTitle>Kroki ulepszenia</ElSubTitle>
                {strategy.technicalSEO.improvementSteps.map((s: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: el.teal, width: 16 }}>{i + 1}.</Text>
                    <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody, flex: 1, lineHeight: 1.5 }}>{s}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
          <ElPageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="technicalSEO" domain={domain} date={date} />

      {/* ── Risk Assessment ──────────────────────────────── */}
      {strategy.riskAssessment?.length > 0 && (
        <Page size="A4" style={elPage}>
          <ElPageHeader domain={domain} date={date} />
          <View style={{ marginBottom: 20 }}>
            <ElSectionTitle number={`${sn(7)}.`}>Ocena ryzyka ({strategy.riskAssessment.length})</ElSectionTitle>

            {(() => {
              const counts = { high: 0, medium: 0, low: 0 };
              strategy.riskAssessment.forEach((r: any) => { if (counts[r.severity as keyof typeof counts] !== undefined) counts[r.severity as keyof typeof counts]++; });
              const total = strategy.riskAssessment.length;
              return (
                <View style={{ marginBottom: 12 }}>
                  <ElSubTitle>Rozkład ważności</ElSubTitle>
                  <View style={{ flexDirection: "row", height: 20, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                    {counts.high > 0 && <View style={{ width: `${(counts.high / total) * 100}%`, backgroundColor: el.error, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 9, color: el.white, fontFamily: "Inter", fontWeight: 700 }}>{counts.high}</Text></View>}
                    {counts.medium > 0 && <View style={{ width: `${(counts.medium / total) * 100}%`, backgroundColor: el.warning, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 9, color: el.white, fontFamily: "Inter", fontWeight: 700 }}>{counts.medium}</Text></View>}
                    {counts.low > 0 && <View style={{ width: `${(counts.low / total) * 100}%`, backgroundColor: el.textMuted, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 9, color: el.white, fontFamily: "Inter", fontWeight: 700 }}>{counts.low}</Text></View>}
                  </View>
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 10, height: 10, backgroundColor: el.error, borderRadius: 2 }} /><Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textGray }}>Wysoki: {counts.high}</Text></View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 10, height: 10, backgroundColor: el.warning, borderRadius: 2 }} /><Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textGray }}>Średni: {counts.medium}</Text></View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 10, height: 10, backgroundColor: el.textMuted, borderRadius: 2 }} /><Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textGray }}>Niski: {counts.low}</Text></View>
                  </View>
                </View>
              );
            })()}

            {strategy.riskAssessment.map((r: any, i: number) => {
              const sev = EL_SEVERITY[r.severity] ?? EL_SEVERITY.medium;
              return (
                <View key={i} wrap={false} style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, marginBottom: 10, overflow: "hidden" }}>
                  <View style={{ height: 3, backgroundColor: sev.text }} />
                  <View style={{ padding: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <ElBadge text={sev.label} color={sev.text} bgColor={sev.bg} />
                      <Text style={{ fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: el.textDark, flex: 1 }}>{r.risk}</Text>
                    </View>
                    <ElCallout title="Wpływ">
                      <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, lineHeight: 1.5 }}>{r.impact}</Text>
                    </ElCallout>
                    <ElCallout title="Mitygacja" borderColor={el.success}>
                      <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, lineHeight: 1.5 }}>{r.mitigation}</Text>
                    </ElCallout>
                  </View>
                </View>
              );
            })}
          </View>
          <ElPageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="riskAssessment" domain={domain} date={date} />

      {/* ── Keyword Clustering ──────────────────────────── */}
      {strategy.keywordClustering?.length > 0 && (
        <Page size="A4" style={elPage}>
          <ElPageHeader domain={domain} date={date} />
          <View style={{ marginBottom: 20 }}>
            <ElSectionTitle number={`${sn(8)}.`}>Klastry słów kluczowych ({strategy.keywordClustering.length})</ElSectionTitle>

            {(() => {
              const maxVol = Math.max(...strategy.keywordClustering.map((c: any) => c.totalSearchVolume ?? 0), 1);
              const sorted = [...strategy.keywordClustering].sort((a: any, b: any) => (b.totalSearchVolume ?? 0) - (a.totalSearchVolume ?? 0));
              return (
                <View style={{ marginBottom: 14 }}>
                  <ElSubTitle>Porównanie wolumenu i trudności</ElSubTitle>
                  <View style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", backgroundColor: el.teal, paddingVertical: 6, paddingHorizontal: 8 }}>
                      <Text style={{ flex: 2.5, fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.white }}>Klaster</Text>
                      <Text style={{ flex: 4, fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.white }}>Wolumen wyszukiwań</Text>
                      <Text style={{ flex: 1, fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.white }}>Trudn.</Text>
                      <Text style={{ flex: 1, fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.white }}>Słowa</Text>
                    </View>
                    {sorted.map((c: any, i: number) => {
                      const volPct = ((c.totalSearchVolume ?? 0) / maxVol) * 100;
                      const diffColor = c.avgDifficulty >= 70 ? el.error : c.avgDifficulty >= 40 ? el.warning : el.success;
                      return (
                        <View key={i} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: el.borderLight, paddingVertical: 7, paddingHorizontal: 8, backgroundColor: i % 2 === 1 ? el.offWhite : el.white }}>
                          <Text style={{ flex: 2.5, fontSize: 9, fontFamily: "Inter", fontWeight: 600, color: el.textDark }}>{c.clusterName}</Text>
                          <View style={{ flex: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <View style={{ flex: 1, height: 12, backgroundColor: el.borderLight, borderRadius: 2 }}>
                              <View style={{ width: `${volPct}%`, height: 12, backgroundColor: el.teal, borderRadius: 2 }} />
                            </View>
                            <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textDark, width: 40, textAlign: "right" }}>{(c.totalSearchVolume ?? 0).toLocaleString()}</Text>
                          </View>
                          <Text style={{ flex: 1, fontSize: 9, fontFamily: "Inter", fontWeight: 700, color: diffColor }}>{c.avgDifficulty}</Text>
                          <Text style={{ flex: 1, fontSize: 9, fontFamily: "Inter", color: el.textGray }}>{c.keywords?.length ?? 0}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {strategy.keywordClustering.map((c: any, i: number) => (
              <View key={i} wrap={false} style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, marginBottom: 10, overflow: "hidden" }}>
                <View style={{ height: 3, backgroundColor: el.teal }} />
                <View style={{ padding: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter", fontWeight: 700, color: el.textDark }}>{c.clusterName}</Text>
                    <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textGray }}>Wol.: {c.totalSearchVolume?.toLocaleString()} | Trudn.: {c.avgDifficulty}</Text>
                  </View>
                  <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, marginBottom: 4, lineHeight: 1.4 }}>Temat: {c.theme}</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, marginBottom: 4, lineHeight: 1.4 }}>Słowa kluczowe: {c.keywords?.join(", ")}</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Inter", fontWeight: 600, color: el.teal }}>→ {c.suggestedContentPiece}</Text>
                </View>
              </View>
            ))}
          </View>
          <ElPageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="keywordClustering" domain={domain} date={date} />

      {/* ── ROI Forecast ─────────────────────────────────── */}
      {strategy.roiForecast && (strategy.roiForecast.currentEstimatedTraffic != null || strategy.roiForecast.projectedTraffic30d != null || strategy.roiForecast.keyDrivers?.length > 0) && (
        <Page size="A4" style={elPage}>
          <ElPageHeader domain={domain} date={date} />
          <View style={{ marginBottom: 20 }}>
            <ElSectionTitle number={`${sn(9)}.`}>Prognoza ROI</ElSectionTitle>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <ElMetricCard value={strategy.roiForecast.currentEstimatedTraffic?.toLocaleString()} label="Aktualny ruch" accentColor={el.textMuted} valueColor={el.textGray} />
              <ElMetricCard value={strategy.roiForecast.projectedTraffic30d?.toLocaleString()} label="Prognoza 30 dni" accentColor={el.warning} valueColor={el.warning} />
              <ElMetricCard value={strategy.roiForecast.projectedTraffic90d?.toLocaleString()} label="Prognoza 90 dni" accentColor={el.success} valueColor={el.success} />
            </View>

            <View style={{ marginBottom: 12 }}>
              <ElHorizontalBar label="Aktualny" value={strategy.roiForecast.currentEstimatedTraffic ?? 0} max={Math.max(strategy.roiForecast.projectedTraffic90d ?? 1, 1)} color={el.textMuted} />
              <ElHorizontalBar label="30 dni" value={strategy.roiForecast.projectedTraffic30d ?? 0} max={Math.max(strategy.roiForecast.projectedTraffic90d ?? 1, 1)} color={el.warning} />
              <ElHorizontalBar label="90 dni" value={strategy.roiForecast.projectedTraffic90d ?? 0} max={Math.max(strategy.roiForecast.projectedTraffic90d ?? 1, 1)} color={el.teal} />
            </View>

            {strategy.roiForecast.keyDrivers?.length > 0 && (
              <>
                <ElSubTitle>Kluczowe czynniki</ElSubTitle>
                {strategy.roiForecast.keyDrivers.map((d: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody }}>•</Text>
                    <Text style={{ fontSize: 10, fontFamily: "Inter", color: el.textBody, flex: 1, lineHeight: 1.5 }}>{d}</Text>
                  </View>
                ))}
              </>
            )}
            {strategy.roiForecast.assumptions?.length > 0 && (
              <ElCallout title="Założenia">
                {strategy.roiForecast.assumptions.map((a: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 3 }}>
                    <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody }}>•</Text>
                    <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, flex: 1, lineHeight: 1.4 }}>{a}</Text>
                  </View>
                ))}
              </ElCallout>
            )}
          </View>
          <ElPageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="roiForecast" domain={domain} date={date} />

      {/* ── Action Plan + Gantt ─────────────────────────── */}
      {strategy.actionPlan?.length > 0 && (
        <Page size="A4" style={elPage}>
          <ElPageHeader domain={domain} date={date} />
          <View style={{ marginBottom: 20 }}>
            <ElSectionTitle number={`${sn(10)}.`}>Plan działania ({strategy.actionPlan.length})</ElSectionTitle>

            <ElSubTitle>Oś czasu</ElSubTitle>
            <View style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, marginBottom: 14, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", backgroundColor: el.teal }}>
                <View style={{ width: "40%", padding: 4 }}>
                  <Text style={{ fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.white }}>Działanie</Text>
                </View>
                {["M1", "M2", "M3", "M4", "M5", "M6"].map((m) => (
                  <View key={m} style={{ flex: 1, padding: 4, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.2)", alignItems: "center" }}>
                    <Text style={{ fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.white }}>{m}</Text>
                  </View>
                ))}
              </View>
              {[...strategy.actionPlan].sort((a: any, b: any) => a.priority - b.priority).map((item: any, i: number) => {
                const [start, end] = timeframeMonths[item.timeframe] ?? [0, 2];
                const adj = effortAdj[item.effort] ?? 0;
                const barStart = Math.max(0, start);
                const barEnd = Math.min(6, end + adj);
                const leftPct = (barStart / 6) * 100;
                const widthPct = Math.max(((barEnd - barStart) / 6) * 100, 8);
                const barColor = catColorsEl[item.category] ?? el.teal;

                return (
                  <View key={i} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: el.borderLight, minHeight: 24, backgroundColor: i % 2 === 0 ? el.white : el.offWhite }}>
                    <View style={{ width: "40%", padding: 4, justifyContent: "center" }}>
                      <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textDark }}>{item.priority}. {item.action}</Text>
                    </View>
                    <View style={{ flex: 1, position: "relative", justifyContent: "center" }}>
                      {[0, 1, 2, 3, 4, 5].map((mi) => (
                        <View key={mi} style={{ position: "absolute", left: `${(mi / 6) * 100}%`, top: 0, bottom: 0, width: 1, backgroundColor: el.borderLight }} />
                      ))}
                      <View style={{
                        position: "absolute",
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: 12,
                        backgroundColor: barColor,
                        borderRadius: 2,
                        top: 6,
                      }} />
                    </View>
                  </View>
                );
              })}
              <View style={{ flexDirection: "row", padding: 6, gap: 12, backgroundColor: el.lightGray }}>
                {Object.entries(catColorsEl).map(([cat, col]) => (
                  <View key={cat} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <View style={{ width: 8, height: 8, backgroundColor: col, borderRadius: 2 }} />
                    <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textGray }}>{cat}</Text>
                  </View>
                ))}
              </View>
            </View>

            <ElSubTitle>Szczegółowe działania</ElSubTitle>
            {[...strategy.actionPlan].sort((a: any, b: any) => a.priority - b.priority).map((item: any, i: number) => {
              const effortColor = item.effort === "high" ? el.error : item.effort === "medium" ? el.warning : el.success;
              const effortBg = item.effort === "high" ? el.errorBg : item.effort === "medium" ? el.warningBg : el.successBg;
              return (
                <View key={i} wrap={false} style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, marginBottom: 8, padding: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ElBadge text={`P${item.priority}`} color={effortColor} bgColor={effortBg} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: el.textDark }}>{item.action}</Text>
                      <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textGray }}>
                        {item.category} · {item.effort} effort · {item.timeframe}
                      </Text>
                      {item.expectedImpact && <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, lineHeight: 1.4 }}>{item.expectedImpact}</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          <ElPageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="actionPlan" domain={domain} date={date} />

      {/* ── Actionable Steps (optional) ───────────────────── */}
      {hasActionableSteps && (
        <Page size="A4" style={elPage}>
          <ElPageHeader domain={domain} date={date} />
          <View style={{ marginBottom: 20 }}>
            <ElSectionTitle number={`${sn(10) + 1}.`}>Kroki do wykonania ({strategy.actionableSteps.length})</ElSectionTitle>
            <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textMuted, marginBottom: 12 }}>Szczegółowe briefy wdrożeniowe z konkretną specyfikacją</Text>
            {strategy.actionableSteps.map((step: any, i: number) => (
              <View key={i} wrap={false} style={{ borderWidth: 1, borderColor: el.border, borderRadius: 4, marginBottom: 10, overflow: "hidden" }}>
                <View style={{ height: 3, backgroundColor: el.teal }} />
                <View style={{ padding: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: el.teal, justifyContent: "center", alignItems: "center" }}>
                      <Text style={{ color: el.white, fontSize: 10, fontFamily: "Inter", fontWeight: 700 }}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter", fontWeight: 700, color: el.textDark }}>{step.title}</Text>
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                        <ElBadge text={step.type?.toUpperCase() ?? "KROK"} />
                        {step.goal && <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textMuted }}>{step.goal}</Text>}
                      </View>
                    </View>
                  </View>
                  {step.specs && Object.keys(step.specs).length > 0 && (
                    <View style={{ gap: 4 }}>
                      {Object.entries(step.specs).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && (v as any[]).length === 0)).map(([key, value]: [string, any]) => (
                        <View key={key} style={{ flexDirection: "row", gap: 4 }}>
                          <Text style={{ fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.textMuted, width: 90, textTransform: "uppercase" }}>{key.replace(/([A-Z])/g, " $1").trim()}</Text>
                          <Text style={{ flex: 1, fontSize: 9, fontFamily: "Inter", color: el.textBody, lineHeight: 1.4 }}>{Array.isArray(value) ? value.join(", ") : String(value)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {step.notes && (
                    <ElCallout>
                      <Text style={{ fontSize: 9, fontFamily: "Inter", color: el.textBody, lineHeight: 1.4 }}>{step.notes}</Text>
                    </ElCallout>
                  )}
                  {step.mockup && Array.isArray(step.mockup) && step.mockup.length > 0 && (
                    <View style={{ marginTop: 8, borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: el.border }}>
                      <View style={{ backgroundColor: el.teal, padding: 6 }}>
                        <Text style={{ fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: el.white, textTransform: "uppercase" }}>MOCKUP TREŚCI</Text>
                      </View>
                      {step.mockup.map((sec: any, si: number) => (
                        <View key={si} style={{ backgroundColor: si % 2 === 0 ? el.white : el.offWhite, padding: 8, borderBottomWidth: si < step.mockup.length - 1 ? 1 : 0, borderBottomColor: el.borderLight }}>
                          <Text style={{ fontSize: 7, fontFamily: "Inter", fontWeight: 700, color: el.teal, textTransform: "uppercase", marginBottom: 1 }}>{sec.type?.toUpperCase()}</Text>
                          <Text style={si === 0 ? { fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: el.textDark } : { fontSize: 9, fontFamily: "Inter", color: el.textDark }}>{sec.heading}</Text>
                          {sec.content && <Text style={{ fontSize: 8, fontFamily: "Inter", color: el.textGray, marginTop: 1 }}>{sec.content}</Text>}
                          {sec.items?.length > 0 && (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                              {sec.items.map((item: string, j: number) => (
                                <Text key={j} style={{ fontSize: 7, fontFamily: "Inter", color: el.textBody, backgroundColor: el.lightGray, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 }}>
                                  {sec.type === "faq" ? `${j + 1}. ${item}` : item}
                                </Text>
                              ))}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
          <ElPageFooter />
        </Page>
      )}
      <DrillDownPages drillDowns={dd} sectionKey="actionableSteps" domain={domain} date={date} />
    </Document>
  );
}


// ─── Logo Loader ─────────────────────────────────────────────────

let _logoPngCache: string | null = null;
let _logoWhitePngCache: string | null = null;

async function getLogoPng(): Promise<string | undefined> {
  if (_logoPngCache) return _logoPngCache;
  try {
    const png = await svgToPngDataUri("/logo-dark.svg", 320);
    _logoPngCache = png;
    return png;
  } catch {
    console.warn("Could not load logo for PDF");
    return undefined;
  }
}

async function getLogoWhitePng(): Promise<string | undefined> {
  if (_logoWhitePngCache) return _logoWhitePngCache;
  try {
    const png = await svgToPngDataUri("/logo-white.svg", 320);
    _logoWhitePngCache = png;
    return png;
  } catch {
    console.warn("Could not load white logo for PDF");
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
  let logoSrc: string | undefined;
  try {
    logoSrc = await getLogoWhitePng();
  } catch (err) {
    console.warn("[StrategyPdf] White logo failed, trying dark logo", err);
    try { logoSrc = await getLogoPng(); } catch { /* proceed without logo */ }
  }
  console.log("[StrategyPdf] logo loaded:", !!logoSrc, "strategy keys:", Object.keys(strategy ?? {}));
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
