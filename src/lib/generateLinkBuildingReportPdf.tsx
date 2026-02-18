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

// ─── Font Registration ────────────────────────────────────────────
// Same as domain report — Inter + Roboto fallback

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

// ─── Logo Utility ─────────────────────────────────────────────────

async function svgToPngDataUri(svgPath: string, displayWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new (globalThis as any).Image() as HTMLImageElement;
    img.crossOrigin = "anonymous";
    img.onload = () => {
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

// ─── Colors ─────────────────────────────────────────────────────

const colors = {
  primary: "#181D27",
  secondary: "#414651",
  tertiary: "#535862",
  quaternary: "#717680",
  brand: "#7F56D9",
  brandLight: "#F9F5FF",
  brand100: "#F4EBFF",
  brand500: "#9E77ED",
  success: "#079455",
  successLight: "#ECFDF3",
  success500: "#17B26A",
  warning: "#DC6803",
  warningLight: "#FFFAEB",
  warning500: "#F79009",
  error: "#D92D20",
  errorLight: "#FEF3F2",
  error500: "#F04438",
  border: "#D5D7DA",
  borderLight: "#E9EAEB",
  bg: "#FFFFFF",
  bgMuted: "#FAFAFA",
  bgTertiary: "#F5F5F5",
  indigo: "#4F46E5",
  indigoLight: "#EEF2FF",
};

// ─── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Inter",
    color: colors.primary,
    backgroundColor: colors.bg,
  },
  coverPage: {
    padding: 40,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Inter",
    fontWeight: 700,
    color: colors.indigo,
    marginBottom: 8,
    textAlign: "center",
  },
  coverSubtitle: {
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: 600,
    color: colors.brand,
    marginBottom: 24,
    textAlign: "center",
  },
  coverDomain: {
    fontSize: 20,
    fontFamily: "Inter",
    fontWeight: 700,
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
  coverStatRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 40,
  },
  coverStatBox: {
    width: 110,
    padding: 12,
    backgroundColor: colors.indigoLight,
    borderRadius: 8,
    alignItems: "center",
  },
  coverStatValue: {
    fontSize: 24,
    fontFamily: "Inter",
    fontWeight: 700,
    color: colors.indigo,
  },
  coverStatLabel: {
    fontSize: 8,
    fontFamily: "Inter",
    color: colors.secondary,
    marginTop: 2,
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: 700,
    color: colors.indigo,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: colors.indigo,
  },
  subsectionTitle: {
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: 700,
    color: colors.primary,
    marginBottom: 6,
    marginTop: 10,
  },
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
    borderColor: colors.borderLight,
  },
  metricValue: {
    fontSize: 18,
    fontFamily: "Inter",
    fontWeight: 700,
    color: colors.primary,
  },
  metricLabel: {
    fontSize: 8,
    fontFamily: "Inter",
    color: colors.secondary,
    marginTop: 2,
  },
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
    gap: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
    backgroundColor: colors.bgMuted,
  },
  tableCell: {
    fontSize: 8,
    fontFamily: "Inter",
    color: colors.primary,
    lineHeight: 1.5,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: "Inter",
    fontWeight: 700,
    color: colors.secondary,
    textTransform: "uppercase",
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  barLabel: {
    width: 100,
    fontSize: 9,
    fontFamily: "Inter",
    color: colors.secondary,
  },
  barTrack: {
    flex: 1,
    height: 14,
    backgroundColor: colors.bgTertiary,
    borderRadius: 3,
  },
  barFill: {
    height: 14,
    borderRadius: 3,
  },
  barValue: {
    width: 50,
    fontSize: 9,
    fontFamily: "Inter",
    color: colors.primary,
    textAlign: "right",
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    fontSize: 7,
    fontFamily: "Inter",
    fontWeight: 600,
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
  text: {
    fontSize: 10,
    fontFamily: "Inter",
    color: colors.primary,
    lineHeight: 1.5,
  },
  textSmall: {
    fontSize: 9,
    fontFamily: "Inter",
    color: colors.secondary,
    lineHeight: 1.4,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────

function MetricBox({ value, label, valueColor }: { value: string | number | null | undefined; label: string; valueColor?: string }) {
  return (
    <View style={s.metricBox}>
      <Text style={valueColor ? [s.metricValue, { color: valueColor }] : s.metricValue}>{String(value ?? "—")}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function HorizontalBar({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.barValue}>{value}{suffix ?? ""}</Text>
    </View>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const bg = difficulty === "easy" ? colors.successLight : difficulty === "medium" ? colors.warningLight : colors.errorLight;
  const fg = difficulty === "easy" ? colors.success : difficulty === "medium" ? colors.warning : colors.error;
  const label = difficulty === "easy" ? "Łatwe" : difficulty === "medium" ? "Średnie" : "Trudne";
  return <Text style={[s.badge, { backgroundColor: bg, color: fg }]}>{label}</Text>;
}

function ChannelBadge({ channel }: { channel: string }) {
  const labels: Record<string, string> = {
    broken_link: "Broken Link",
    guest_post: "Guest Post",
    resource_page: "Resource Page",
    outreach: "Outreach",
    content_mention: "Content Mention",
    skyscraper: "Skyscraper",
  };
  return (
    <Text style={[s.badge, { backgroundColor: colors.brandLight, color: colors.brand }]}>
      {labels[channel] || channel}
    </Text>
  );
}

function PageFooter() {
  return (
    <Text
      style={s.footer}
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

// ─── Types ──────────────────────────────────────────────────────

interface Prospect {
  referringDomain: string;
  prospectScore: number;
  suggestedChannel: string;
  acquisitionDifficulty: string;
  estimatedImpact: number;
  domainRank: number;
  linksToCompetitors: number;
  competitors: string[];
  status: string;
}

interface ProspectStats {
  totalProspects: number;
  activeProspects: number;
  reviewingCount: number;
  dismissedCount: number;
  avgScore: number;
  avgImpact: number;
  byDifficulty: { easy: number; medium: number; hard: number };
  generatedAt: number | null;
}

interface ChannelData {
  channel: string;
  count: number;
  avgScore: number;
  avgImpact: number;
}

interface LinkBuildingReportData {
  stats: ProspectStats;
  prospects: Prospect[];
  channels: ChannelData[];
  domainName: string;
}

// ─── Document ───────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function LinkBuildingReportDocument({ data, logoSrc }: { data: LinkBuildingReportData; logoSrc?: string }) {
  const { stats, prospects, channels, domainName } = data;
  const reportDate = new Date().toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const maxChannelCount = Math.max(...channels.map((c) => c.count), 1);
  const totalByDifficulty = stats.byDifficulty.easy + stats.byDifficulty.medium + stats.byDifficulty.hard;
  const maxDifficulty = Math.max(stats.byDifficulty.easy, stats.byDifficulty.medium, stats.byDifficulty.hard, 1);

  // Top 30 prospects for the table
  const topProspects = prospects.slice(0, 30);

  return (
    <Document>
      {/* ── Cover ──────────────────────────────────────────── */}
      <Page size="A4" style={s.coverPage}>
        <DseoLogo src={logoSrc} />
        <Text style={s.coverTitle}>Raport Link Building</Text>
        <Text style={s.coverSubtitle}>Analiza prospektów i szans linkowych</Text>
        <Text style={s.coverDomain}>{domainName}</Text>
        <Text style={s.coverDate}>{reportDate}</Text>
        <View style={s.coverStatRow}>
          <View style={s.coverStatBox}>
            <Text style={s.coverStatValue}>{stats.activeProspects}</Text>
            <Text style={s.coverStatLabel}>Aktywne prospekty</Text>
          </View>
          <View style={s.coverStatBox}>
            <Text style={s.coverStatValue}>{stats.avgScore}</Text>
            <Text style={s.coverStatLabel}>Śr. wynik</Text>
          </View>
          <View style={s.coverStatBox}>
            <Text style={s.coverStatValue}>{stats.avgImpact}</Text>
            <Text style={s.coverStatLabel}>Śr. wpływ</Text>
          </View>
          <View style={s.coverStatBox}>
            <Text style={s.coverStatValue}>{stats.byDifficulty.easy}</Text>
            <Text style={s.coverStatLabel}>Łatwe wygrane</Text>
          </View>
        </View>
      </Page>

      {/* ── Summary + Distributions ──────────────────────── */}
      <Page size="A4" style={s.page}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Podsumowanie</Text>

          <View style={s.metricsRow}>
            <MetricBox value={stats.activeProspects} label="Aktywne prospekty" />
            <MetricBox value={stats.reviewingCount} label="W przeglądzie" />
            <MetricBox value={stats.avgScore} label="Śr. wynik" valueColor={stats.avgScore >= 70 ? colors.success : stats.avgScore >= 40 ? colors.warning : colors.error} />
            <MetricBox value={stats.avgImpact} label="Śr. wpływ" />
          </View>

          <View style={s.metricsRow}>
            <MetricBox value={stats.byDifficulty.easy} label="Łatwe" valueColor={colors.success} />
            <MetricBox value={stats.byDifficulty.medium} label="Średnie" valueColor={colors.warning} />
            <MetricBox value={stats.byDifficulty.hard} label="Trudne" valueColor={colors.error} />
            <MetricBox value={stats.totalProspects} label="Łączne prospekty" />
          </View>
        </View>

        {/* Channel Distribution */}
        <View style={s.section}>
          <Text style={s.subsectionTitle}>Rozkład kanałów pozyskiwania</Text>
          {channels.map((ch) => {
            const channelLabels: Record<string, string> = {
              broken_link: "Broken Link",
              guest_post: "Guest Post",
              resource_page: "Resource Page",
              outreach: "Outreach",
              content_mention: "Content Mention",
              skyscraper: "Skyscraper",
            };
            return (
              <HorizontalBar
                key={ch.channel}
                label={channelLabels[ch.channel] || ch.channel}
                value={ch.count}
                max={maxChannelCount}
                color={colors.indigo}
                suffix={` (śr. ${ch.avgScore})`}
              />
            );
          })}
        </View>

        {/* Difficulty Distribution */}
        <View style={s.section}>
          <Text style={s.subsectionTitle}>Rozkład trudności ({totalByDifficulty} prospektów)</Text>
          <HorizontalBar label="Łatwe" value={stats.byDifficulty.easy} max={maxDifficulty} color={colors.success} />
          <HorizontalBar label="Średnie" value={stats.byDifficulty.medium} max={maxDifficulty} color={colors.warning500} />
          <HorizontalBar label="Trudne" value={stats.byDifficulty.hard} max={maxDifficulty} color={colors.error} />
        </View>

        <PageFooter />
      </Page>

      {/* ── Top Prospects Table ────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Najlepsze prospekty ({topProspects.length})</Text>
          <Text style={s.textSmall}>Posortowane wg wyniku prospektu od najwyższego. Wyświetlono top {topProspects.length} z {prospects.length}.</Text>

          <View style={[s.table, { marginTop: 8 }]}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { flex: 2.5 }]}>Domena</Text>
              <Text style={[s.tableHeaderCell, { flex: 0.7 }]}>Wynik</Text>
              <Text style={[s.tableHeaderCell, { flex: 1.3 }]}>Kanał</Text>
              <Text style={[s.tableHeaderCell, { flex: 0.8 }]}>Trudność</Text>
              <Text style={[s.tableHeaderCell, { flex: 0.7 }]}>Wpływ</Text>
              <Text style={[s.tableHeaderCell, { flex: 0.6 }]}>DR</Text>
              <Text style={[s.tableHeaderCell, { flex: 0.6 }]}>Linki</Text>
            </View>
            {topProspects.slice(0, 15).map((p, i) => (
              <View style={i % 2 === 1 ? s.tableRowAlt : s.tableRow} key={i}>
                <Text style={[s.tableCell, { flex: 2.5 }]}>{p.referringDomain}</Text>
                <Text style={[s.tableCell, { flex: 0.7, fontWeight: 600, color: p.prospectScore >= 70 ? colors.success : p.prospectScore >= 40 ? colors.warning : colors.error }]}>{p.prospectScore}</Text>
                <View style={{ flex: 1.3, justifyContent: "center" }}>
                  <ChannelBadge channel={p.suggestedChannel} />
                </View>
                <View style={{ flex: 0.8, justifyContent: "center" }}>
                  <DifficultyBadge difficulty={p.acquisitionDifficulty} />
                </View>
                <Text style={[s.tableCell, { flex: 0.7 }]}>{p.estimatedImpact}</Text>
                <Text style={[s.tableCell, { flex: 0.6 }]}>{p.domainRank}</Text>
                <Text style={[s.tableCell, { flex: 0.6 }]}>{p.linksToCompetitors}</Text>
              </View>
            ))}
          </View>
        </View>
        <PageFooter />
      </Page>

      {/* ── Continued Table (page 2 if >15) ──────────────── */}
      {topProspects.length > 15 && (
        <Page size="A4" style={s.page}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>Najlepsze prospekty (cd.)</Text>

            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { flex: 2.5 }]}>Domena</Text>
                <Text style={[s.tableHeaderCell, { flex: 0.7 }]}>Wynik</Text>
                <Text style={[s.tableHeaderCell, { flex: 1.3 }]}>Kanał</Text>
                <Text style={[s.tableHeaderCell, { flex: 0.8 }]}>Trudność</Text>
                <Text style={[s.tableHeaderCell, { flex: 0.7 }]}>Wpływ</Text>
                <Text style={[s.tableHeaderCell, { flex: 0.6 }]}>DR</Text>
                <Text style={[s.tableHeaderCell, { flex: 0.6 }]}>Linki</Text>
              </View>
              {topProspects.slice(15).map((p, i) => (
                <View style={i % 2 === 1 ? s.tableRowAlt : s.tableRow} key={i}>
                  <Text style={[s.tableCell, { flex: 2.5 }]}>{p.referringDomain}</Text>
                  <Text style={[s.tableCell, { flex: 0.7, fontWeight: 600, color: p.prospectScore >= 70 ? colors.success : p.prospectScore >= 40 ? colors.warning : colors.error }]}>{p.prospectScore}</Text>
                  <View style={{ flex: 1.3, justifyContent: "center" }}>
                    <ChannelBadge channel={p.suggestedChannel} />
                  </View>
                  <View style={{ flex: 0.8, justifyContent: "center" }}>
                    <DifficultyBadge difficulty={p.acquisitionDifficulty} />
                  </View>
                  <Text style={[s.tableCell, { flex: 0.7 }]}>{p.estimatedImpact}</Text>
                  <Text style={[s.tableCell, { flex: 0.6 }]}>{p.domainRank}</Text>
                  <Text style={[s.tableCell, { flex: 0.6 }]}>{p.linksToCompetitors}</Text>
                </View>
              ))}
            </View>
          </View>
          <PageFooter />
        </Page>
      )}

      {/* ── Easy Wins Spotlight ─────────────────────────────── */}
      {prospects.filter((p) => p.acquisitionDifficulty === "easy").length > 0 && (
        <Page size="A4" style={s.page}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>Łatwe wygrane — szybkie szanse</Text>
            <Text style={s.textSmall}>
              Prospekty oznaczone jako łatwe w pozyskaniu. Najniższe bariery wejścia i najwyższy potencjał zwrotu.
            </Text>

            <View style={[s.table, { marginTop: 8 }]}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { flex: 3 }]}>Domena</Text>
                <Text style={[s.tableHeaderCell, { flex: 1 }]}>Wynik</Text>
                <Text style={[s.tableHeaderCell, { flex: 1.5 }]}>Kanał</Text>
                <Text style={[s.tableHeaderCell, { flex: 1 }]}>Wpływ</Text>
                <Text style={[s.tableHeaderCell, { flex: 0.8 }]}>DR</Text>
              </View>
              {prospects
                .filter((p) => p.acquisitionDifficulty === "easy")
                .slice(0, 20)
                .map((p, i) => (
                  <View style={i % 2 === 1 ? s.tableRowAlt : s.tableRow} key={i}>
                    <Text style={[s.tableCell, { flex: 3 }]}>{p.referringDomain}</Text>
                    <Text style={[s.tableCell, { flex: 1, fontWeight: 600, color: colors.success }]}>{p.prospectScore}</Text>
                    <View style={{ flex: 1.5, justifyContent: "center" }}>
                      <ChannelBadge channel={p.suggestedChannel} />
                    </View>
                    <Text style={[s.tableCell, { flex: 1 }]}>{p.estimatedImpact}</Text>
                    <Text style={[s.tableCell, { flex: 0.8 }]}>{p.domainRank}</Text>
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

// ─── Public API ─────────────────────────────────────────────────

export async function generateLinkBuildingReportPdf(data: LinkBuildingReportData): Promise<Blob> {
  let logoSrc: string | undefined;
  try {
    logoSrc = await svgToPngDataUri("/logo-dark.svg", 160);
  } catch {
    // Logo is optional — continue without it
  }

  const blob = await pdf(
    <LinkBuildingReportDocument data={data} logoSrc={logoSrc} />
  ).toBlob();

  return blob;
}

export type { LinkBuildingReportData, Prospect, ProspectStats, ChannelData };
