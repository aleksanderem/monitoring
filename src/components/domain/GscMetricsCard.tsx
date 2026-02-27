"use client";

import { useQuery } from "convex/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/base/badges/badges";
import { GoogleIcon } from "@/components/shared/GoogleIcon";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { GradientChartTooltip } from "@/components/application/charts/charts-base";
import { formatNumber } from "@/lib/formatting";

interface GscOverviewSectionProps {
  domainId: Id<"domains">;
}

const DEVICE_COLORS: Record<string, string> = {
  DESKTOP: "#3b82f6",
  MOBILE: "#10b981",
  TABLET: "#f59e0b",
};

const DEVICE_LABEL_KEYS: Record<string, string> = {
  DESKTOP: "gscDesktop",
  MOBILE: "gscMobile",
  TABLET: "gscTablet",
};

// GSC returns ISO 3166-1 alpha-3 country codes; map common ones to alpha-2 for flag emoji
const ISO3_TO_ISO2: Record<string, string> = {
  usa: "US", gbr: "GB", deu: "DE", fra: "FR", pol: "PL",
  can: "CA", aus: "AU", ind: "IN", bra: "BR", esp: "ES",
  ita: "IT", nld: "NL", jpn: "JP", kor: "KR", mex: "MX",
  arg: "AR", chl: "CL", col: "CO", tur: "TR", rus: "RU",
  chn: "CN", idn: "ID", tha: "TH", phl: "PH", mys: "MY",
  sgp: "SG", swe: "SE", nor: "NO", dnk: "DK", fin: "FI",
  che: "CH", aut: "AT", bel: "BE", prt: "PT", irl: "IE",
  nzl: "NZ", zaf: "ZA", are: "AE", sau: "SA", egy: "EG",
  ukr: "UA", rou: "RO", cze: "CZ", hun: "HU", bgr: "BG",
  hrv: "HR", svk: "SK", ltu: "LT", lva: "LV", est: "EE",
};

function countryCodeToFlag(code: string): string {
  const iso2 = ISO3_TO_ISO2[code.toLowerCase()] ?? code.slice(0, 2).toUpperCase();
  return [...iso2].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

// Shared wrapper for GSC state cards (not connected, no property, awaiting sync)
function GscStateCard({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-6">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        <p className="max-w-md text-sm text-tertiary">{description}</p>
        {action}
      </div>
    </div>
  );
}

/**
 * Prominent alert banner shown at the top of Monitoring tab when GSC is not
 * fully set up. Renders nothing when GSC is connected + has data.
 */
export function GscAlertBanner({ domainId, onSwitchToSettings }: {
  domainId: Id<"domains">;
  onSwitchToSettings?: () => void;
}) {
  const t = useTranslations("domains");
  const connectionInfo = useQuery(api.gsc.getGscPropertiesForDomain, { domainId });

  // Loading, auth failure, or fully set up → render nothing
  if (connectionInfo === undefined || connectionInfo === null) return null;
  if (connectionInfo.connected && connectionInfo.selectedPropertyUrl) return null;

  // Not connected at all
  if (!connectionInfo.connected) {
    return (
      <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-950/30">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/50">
            <GoogleIcon className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-200">{t("gscBannerTitle")}</h3>
            <p className="mt-1 text-sm text-orange-800 dark:text-orange-300">{t("gscBannerDesc")}</p>
            <Link
              href="/settings"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              <GoogleIcon className="size-4" />
              {t("gscBannerCta")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Connected but no property selected
  return (
    <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/30">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
          <GoogleIcon className="size-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">{t("gscBannerPropertyTitle")}</h3>
          <p className="mt-1 text-sm text-blue-800 dark:text-blue-300">{t("gscBannerPropertyDesc")}</p>
          {onSwitchToSettings ? (
            <button
              onClick={onSwitchToSettings}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {t("gscBannerPropertyCta")}
            </button>
          ) : (
            <Link
              href="/settings"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {t("gscBannerPropertyCta")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function GscOverviewSection({ domainId }: GscOverviewSectionProps) {
  const t = useTranslations("domains");
  const connectionInfo = useQuery(api.gsc.getGscPropertiesForDomain, { domainId });
  const metrics = useQuery(api.gsc.getGscMetrics, { domainId });
  const deviceSplitRaw = useQuery(api.gsc.getGscDeviceSplit, { domainId });
  const topPagesRaw = useQuery(api.gsc.getGscTopPages, { domainId, limit: 5 });
  const countryBreakdownRaw = useQuery(api.gsc.getGscCountryBreakdown, { domainId, limit: 5 });
  // Normalize: null (auth failure) → empty array, undefined stays undefined (loading)
  const deviceSplit = deviceSplitRaw === null ? [] : deviceSplitRaw;
  const topPages = topPagesRaw === null ? [] : topPagesRaw;
  const countryBreakdown = countryBreakdownRaw === null ? [] : countryBreakdownRaw;

  // --- Loading state ---
  if (connectionInfo === undefined) {
    return <div className="animate-pulse h-32 rounded-lg border border-secondary bg-primary" />;
  }

  // --- Auth failure (null) ---
  if (connectionInfo === null) {
    return null;
  }

  // --- State 1: GSC not connected at org level ---
  if (!connectionInfo.connected) {
    return (
      <GscStateCard
        icon={<GoogleIcon className="size-6" />}
        title={t("gscNotConnectedTitle")}
        description={t("gscNotConnectedDesc")}
        action={
          <Link
            href="/settings"
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {t("gscGoToSettings")}
          </Link>
        }
      />
    );
  }

  // --- State 2: GSC connected but no property selected for this domain ---
  if (!connectionInfo.selectedPropertyUrl) {
    return (
      <GscStateCard
        icon={<GoogleIcon className="size-6" />}
        title={t("gscNoPropertyTitle")}
        description={t("gscNoPropertyDesc")}
      />
    );
  }

  // --- State 3: Property selected but no metrics data yet (awaiting first sync) ---
  const hasRealData = metrics && (metrics.totalClicks > 0 || metrics.totalImpressions > 0);
  if (metrics !== undefined && !hasRealData) {
    return (
      <GscStateCard
        icon={
          <div className="relative">
            <GoogleIcon className="size-6" />
            <div className="absolute -bottom-0.5 -right-0.5 size-2.5 animate-pulse rounded-full bg-green-500" />
          </div>
        }
        title={t("gscAwaitingSyncTitle")}
        description={t("gscAwaitingSyncDesc")}
      />
    );
  }

  // --- Loading metrics (still fetching) ---
  if (!metrics) {
    return <div className="animate-pulse h-32 rounded-lg border border-secondary bg-primary" />;
  }

  // --- State 4: Connected with data — full display ---
  const deviceData = deviceSplit
    ? deviceSplit
        .filter((d) => d.clicks > 0)
        .map((d) => ({
          name: DEVICE_LABEL_KEYS[d.device] ? t(DEVICE_LABEL_KEYS[d.device]) : d.device,
          value: d.clicks,
          fill: DEVICE_COLORS[d.device] || "#9ca3af",
        }))
    : [];

  return (
    <div className="flex flex-col gap-5">
      {/* Summary metrics */}
      <div className="relative rounded-xl border border-secondary bg-primary p-5">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <div className="mb-4 flex items-center gap-2">
          <GoogleIcon className="size-4 shrink-0" />
          <h3 className="text-sm font-semibold text-primary">{t("gscMetricsTitle")}</h3>
          <Badge color="blue" size="sm">GSC</Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-2xl font-semibold text-primary">{metrics.totalClicks.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-tertiary">{t("gscClicks")}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-primary">{metrics.totalImpressions.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-tertiary">{t("gscImpressions")}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-primary">{(metrics.avgCtr * 100).toFixed(1)}%</p>
            <p className="mt-0.5 text-xs text-tertiary">{t("gscAvgCtr")}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-primary">{metrics.avgPosition.toFixed(1)}</p>
            <p className="mt-0.5 text-xs text-tertiary">{t("gscAvgPosition")}</p>
          </div>
        </div>
      </div>

      {/* Device Split + Top Pages */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Device Split Pie Chart */}
        <div className="relative rounded-xl border border-secondary bg-primary p-5">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <h4 className="mb-3 text-sm font-semibold text-primary">{t("gscDeviceSplit")}</h4>
          {deviceSplit === undefined ? (
            <div className="h-[200px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
          ) : deviceData.length === 0 ? (
            <p className="py-8 text-center text-sm text-tertiary">{t("gscNoDeviceData")}</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={deviceData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {deviceData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<GradientChartTooltip />}
                    formatter={(value, name) => [formatNumber((value as number) ?? 0), name as string]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-1 flex-col gap-2">
                {deviceData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-sm text-primary">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-primary">{formatNumber(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Pages Table */}
        <div className="relative rounded-xl border border-secondary bg-primary p-5">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <h4 className="mb-3 text-sm font-semibold text-primary">{t("gscTopPages")}</h4>
          {topPages === undefined ? (
            <div className="h-[200px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
          ) : topPages.length === 0 ? (
            <p className="py-8 text-center text-sm text-tertiary">{t("gscNoPagesData")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-secondary">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-tertiary">{t("gscPage")}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase text-tertiary">{t("gscClicks")}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase text-tertiary">{t("gscImpressions")}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase text-tertiary">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.map((page: { page: string; clicks: number; impressions: number; ctr: number }, i: number) => {
                    let pathSegment: string;
                    try {
                      pathSegment = new URL(page.page).pathname;
                    } catch {
                      pathSegment = page.page;
                    }
                    return (
                      <tr key={i} className="border-b border-secondary last:border-b-0">
                        <td className="max-w-[200px] truncate px-3 py-2 text-primary" title={page.page}>
                          {pathSegment}
                        </td>
                        <td className="px-3 py-2 text-right text-primary">{formatNumber(page.clicks)}</td>
                        <td className="px-3 py-2 text-right text-primary">{formatNumber(page.impressions)}</td>
                        <td className="px-3 py-2 text-right text-primary">{(page.ctr * 100).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Country Breakdown */}
      <div className="relative rounded-xl border border-secondary bg-primary p-5">
        <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
        <h4 className="mb-3 text-sm font-semibold text-primary">{t("gscCountryBreakdown")}</h4>
        {countryBreakdown === undefined ? (
          <div className="h-[150px] animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
        ) : countryBreakdown.length === 0 ? (
          <p className="py-8 text-center text-sm text-tertiary">{t("gscNoCountryData")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-secondary">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-tertiary">{t("gscCountry")}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-tertiary">{t("gscClicks")}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-tertiary">{t("gscImpressions")}</th>
                </tr>
              </thead>
              <tbody>
                {countryBreakdown.map((row: { country: string; clicks: number; impressions: number }, i: number) => (
                  <tr key={i} className="border-b border-secondary last:border-b-0">
                    <td className="px-3 py-2 text-primary">
                      <span className="mr-1.5">{countryCodeToFlag(row.country)}</span>
                      {row.country.toUpperCase()}
                    </td>
                    <td className="px-3 py-2 text-right text-primary">{formatNumber(row.clicks)}</td>
                    <td className="px-3 py-2 text-right text-primary">{formatNumber(row.impressions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
