import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";

// ─── Font Registration (supports Polish diacritics) ──────────────

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

// ─── Styles ─────────────────────────────────────────────────────

const colors = {
  primary: "#0F172A",
  secondary: "#475569",
  tertiary: "#94A3B8",
  brand: "#6366F1",
  brandLight: "#EEF2FF",
  success: "#16A34A",
  successLight: "#F0FDF4",
  warning: "#D97706",
  warningLight: "#FFFBEB",
  error: "#DC2626",
  errorLight: "#FEF2F2",
  border: "#E2E8F0",
  bg: "#FFFFFF",
  bgMuted: "#F8FAFC",
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
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableCell: {
    fontSize: 9,
    color: colors.primary,
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
    color: colors.primary,
    lineHeight: 1.5,
  },
  textSmall: {
    fontSize: 9,
    color: colors.secondary,
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: colors.tertiary,
    textAlign: "center",
  },
});

// ─── Helper Components ──────────────────────────────────────────

function MetricBox({ value, label }: { value: string | number | null | undefined; label: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricValue}>{String(value ?? "—")}</Text>
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

function PageFooter({ pageNumber }: { pageNumber: string }) {
  return (
    <Text style={styles.footer}>
      Page {pageNumber} — Generated by SEO Monitoring Tool
    </Text>
  );
}

// ─── Report Document ────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function SEOReportDocument({ data, domainName }: { data: any; domainName: string }) {
  const reportDate = new Date(data.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const scoreColor = (data.healthScore?.total ?? 0) >= 70
    ? colors.success
    : (data.healthScore?.total ?? 0) >= 40
      ? colors.warning
      : colors.error;

  return (
    <Document>
      {/* ── Cover Page ─────────────────────────────────────── */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverTitle}>SEO Report</Text>
        <Text style={styles.coverDomain}>{domainName}</Text>
        <Text style={styles.coverDate}>{reportDate}</Text>
        {data.healthScore && (
          <>
            <Text style={[styles.coverScore, { color: scoreColor }]}>
              {data.healthScore.total}
            </Text>
            <Text style={styles.coverScoreLabel}>Health Score / 100</Text>
          </>
        )}
      </Page>

      {/* ── Summary Page ───────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>

          {data.healthScore?.breakdown && (
            <>
              <Text style={styles.subsectionTitle}>Health Score Breakdown</Text>
              <View style={{ marginBottom: 10 }}>
                <HorizontalBar label="Keywords" value={data.healthScore.breakdown.keywords?.score ?? 0} max={30} color={colors.brand} />
                <HorizontalBar label="Backlinks" value={data.healthScore.breakdown.backlinks?.score ?? 0} max={30} color="#8B5CF6" />
                <HorizontalBar label="On-Site" value={data.healthScore.breakdown.onsite?.score ?? 0} max={20} color="#06B6D4" />
                <HorizontalBar label="Content" value={data.healthScore.breakdown.content?.score ?? 0} max={20} color="#10B981" />
              </View>
            </>
          )}

          <Text style={styles.subsectionTitle}>Key Metrics</Text>
          <View style={styles.metricsRow}>
            <MetricBox value={data.keywords?.total ?? 0} label="Active Keywords" />
            <MetricBox value={data.keywords?.avgPosition ?? "N/A"} label="Avg Position" />
            <MetricBox value={data.backlinks?.summary?.totalBacklinks ?? 0} label="Total Backlinks" />
            <MetricBox value={data.backlinks?.summary?.totalDomains ?? 0} label="Referring Domains" />
          </View>
          <View style={styles.metricsRow}>
            <MetricBox value={data.contentGaps?.total ?? 0} label="Content Gaps" />
            <MetricBox value={data.competitors?.active ?? 0} label="Active Competitors" />
            <MetricBox value={data.linkBuilding?.activeProspects ?? 0} label="Link Prospects" />
            <MetricBox value={data.keywords?.discoveredTotal ?? 0} label="Discovered Keywords" />
          </View>
        </View>

        <PageFooter pageNumber="2" />
      </Page>

      {/* ── Keywords Page ──────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Keywords</Text>

          <Text style={styles.subsectionTitle}>Position Distribution</Text>
          {data.keywords?.positionDistribution && (
            <View style={{ marginBottom: 10 }}>
              <HorizontalBar label="Top 3" value={data.keywords.positionDistribution.top3} max={Math.max(data.keywords.total, 1)} color={colors.success} />
              <HorizontalBar label="4-10" value={data.keywords.positionDistribution.pos4_10} max={Math.max(data.keywords.total, 1)} color="#22C55E" />
              <HorizontalBar label="11-20" value={data.keywords.positionDistribution.pos11_20} max={Math.max(data.keywords.total, 1)} color={colors.warning} />
              <HorizontalBar label="21-50" value={data.keywords.positionDistribution.pos21_50} max={Math.max(data.keywords.total, 1)} color="#F59E0B" />
              <HorizontalBar label="51-100" value={data.keywords.positionDistribution.pos51_100} max={Math.max(data.keywords.total, 1)} color={colors.error} />
            </View>
          )}

          {data.keywords?.movement && (
            <>
              <Text style={styles.subsectionTitle}>7-Day Movement</Text>
              <View style={styles.metricsRow}>
                <MetricBox value={data.keywords.movement.gainers} label="Gainers" />
                <MetricBox value={data.keywords.movement.losers} label="Losers" />
                <MetricBox value={data.keywords.movement.stable} label="Stable" />
              </View>
            </>
          )}

          {data.keywords?.topGainers?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Top Gainers</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Keyword</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Old</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>New</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Change</Text>
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

          {data.keywords?.topLosers?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Top Losers</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Keyword</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Old</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>New</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Change</Text>
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

          {data.keywords?.nearPage1?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Near Page 1 (Positions 11-20)</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Keyword</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Position</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Volume</Text>
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
        <PageFooter pageNumber="3" />
      </Page>

      {/* ── Backlinks Page ─────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backlinks</Text>

          {data.backlinks?.summary && (
            <>
              <Text style={styles.subsectionTitle}>Overview</Text>
              <View style={styles.metricsRow}>
                <MetricBox value={data.backlinks.summary.totalBacklinks ?? 0} label="Total Backlinks" />
                <MetricBox value={data.backlinks.summary.totalDomains ?? 0} label="Referring Domains" />
                <MetricBox value={data.backlinks.summary.dofollow ?? 0} label="Dofollow" />
                <MetricBox value={data.backlinks.summary.nofollow ?? 0} label="Nofollow" />
              </View>
            </>
          )}

          {data.backlinks?.anchorDistribution && (
            <>
              <Text style={styles.subsectionTitle}>Anchor Text Distribution</Text>
              <View style={{ marginBottom: 10 }}>
                {Object.entries(data.backlinks.anchorDistribution as Record<string, number>).map(([category, count]) => (
                  <HorizontalBar
                    key={category}
                    label={category.charAt(0).toUpperCase() + category.slice(1)}
                    value={count}
                    max={Math.max(...Object.values(data.backlinks.anchorDistribution as Record<string, number>), 1)}
                    color={category === "branded" ? colors.brand : category === "exact_url" ? "#8B5CF6" : category === "generic" ? colors.warning : "#06B6D4"}
                  />
                ))}
              </View>
            </>
          )}

          {data.backlinks?.toxicLinks?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Toxic Links ({data.backlinks.totalToxic} total)</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Source Domain</Text>
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
        <PageFooter pageNumber="4" />
      </Page>

      {/* ── Content Gaps + Competitors Page ─────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content Gaps & Competitors</Text>

          <Text style={styles.subsectionTitle}>Content Gap Summary</Text>
          <View style={styles.metricsRow}>
            <MetricBox value={data.contentGaps?.total ?? 0} label="Total Gaps" />
            <MetricBox value={data.contentGaps?.byPriority?.high ?? 0} label="High Priority" />
            <MetricBox value={data.contentGaps?.byPriority?.medium ?? 0} label="Medium Priority" />
            <MetricBox value={`$${Math.round((data.contentGaps?.totalEstimatedValue ?? 0) / 100) * 100}`} label="Est. Traffic Value" />
          </View>

          {data.contentGaps?.topGaps?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Top Content Opportunities</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Keyword</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Competitor</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Score</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Volume</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Diff.</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Comp #</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>You #</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Priority</Text>
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

          {data.competitors?.list?.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Tracked Competitors</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Domain</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Name</Text>
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
        <PageFooter pageNumber="5" />
      </Page>

      {/* ── On-Site Page ───────────────────────────────────── */}
      {data.onSite && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>On-Site SEO</Text>

            <View style={styles.metricsRow}>
              <MetricBox value={`${data.onSite.healthScore}/100`} label="Health Score" />
              <MetricBox value={data.onSite.totalPages} label="Total Pages" />
              <MetricBox value={data.onSite.criticalIssues} label="Critical Issues" />
              <MetricBox value={data.onSite.warnings} label="Warnings" />
            </View>

            {data.onSite.issues && (
              <>
                <Text style={styles.subsectionTitle}>Issue Breakdown</Text>
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

            {data.coreWebVitals?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Core Web Vitals</Text>
                <View style={styles.metricsRow}>
                  {data.coreWebVitals.map((cwv: any, i: number) => (
                    <View key={i} style={styles.metricBox}>
                      <Text style={{ fontSize: 8, color: colors.secondary, marginBottom: 4 }}>
                        {cwv.device.toUpperCase()}
                      </Text>
                      {cwv.lcp != null && <Text style={styles.textSmall}>LCP: {cwv.lcp}ms</Text>}
                      {cwv.fid != null && <Text style={styles.textSmall}>FID: {cwv.fid}ms</Text>}
                      {cwv.cls != null && <Text style={styles.textSmall}>CLS: {cwv.cls}</Text>}
                      {cwv.performanceScore != null && (
                        <Text style={[styles.textSmall, { fontFamily: "Inter", fontWeight: 700, marginTop: 4 }]}>
                          Score: {cwv.performanceScore}/100
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </>
            )}

            {data.onSite.criticalIssuesList?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Critical Issues</Text>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Issue</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Pages</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Category</Text>
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
          <PageFooter pageNumber="6" />
        </Page>
      )}

      {/* ── Link Building Page ─────────────────────────────── */}
      {data.linkBuilding?.topProspects?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Link Building</Text>

            <View style={styles.metricsRow}>
              <MetricBox value={data.linkBuilding.totalProspects} label="Total Prospects" />
              <MetricBox value={data.linkBuilding.activeProspects} label="Active Prospects" />
            </View>

            {data.linkBuilding.byChannel && (
              <>
                <Text style={styles.subsectionTitle}>Prospects by Channel</Text>
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

            <Text style={styles.subsectionTitle}>Top Prospects</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Domain</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Rank</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Score</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Difficulty</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Channel</Text>
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
          </View>
          <PageFooter pageNumber="7" />
        </Page>
      )}

      {/* ── Recommendations Page ───────────────────────────── */}
      {data.recommendations?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <Text style={styles.textSmall}>
              Prioritized list of actions to improve your SEO performance.
            </Text>
            <View style={{ marginTop: 10 }}>
              {data.recommendations.map((rec: any, i: number) => (
                <View style={styles.recItem} key={i}>
                  <PriorityBadge priority={rec.priority} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.text, { fontFamily: "Inter", fontWeight: 700 }]}>{rec.title}</Text>
                    <Text style={styles.textSmall}>{rec.description}</Text>
                    <Text style={{ fontSize: 8, color: colors.tertiary, marginTop: 2 }}>
                      Category: {rec.category}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <PageFooter pageNumber="8" />
        </Page>
      )}
    </Document>
  );
}

// ─── Export: Generate PDF Blob ───────────────────────────────────

export async function generateDomainReportPdf(
  reportData: any,
  domainName: string
): Promise<Blob> {
  const doc = <SEOReportDocument data={reportData} domainName={domainName} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}
