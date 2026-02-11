"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CrawlLinksTable } from "../tables/CrawlLinksTable";
import { RedirectChainsTable } from "../tables/RedirectChainsTable";
import { ImageAnalysisTable } from "../tables/ImageAnalysisTable";
import { WordFrequencySection } from "./WordFrequencySection";
import { RobotsTestResultsCard } from "../cards/RobotsTestResultsCard";
import { PageSpeedTab } from "../tables/PageSpeedTab";

interface CrawlAnalyticsSectionProps {
  domainId: Id<"domains">;
}

type TabKey = "links" | "redirects" | "images" | "pageSpeed" | "wordFreq" | "robotsTest";

export function CrawlAnalyticsSection({ domainId }: CrawlAnalyticsSectionProps) {
  const t = useTranslations('onsite');
  const [activeTab, setActiveTab] = useState<TabKey>("links");

  const TABS: { key: TabKey; label: string }[] = [
    { key: "links", label: t('tabLinkAnalysis') },
    { key: "redirects", label: t('tabRedirectChains') },
    { key: "images", label: t('tabImageAnalysis') },
    { key: "pageSpeed", label: t('tabPageSpeed') },
    { key: "wordFreq", label: t('tabWordFrequency') },
    { key: "robotsTest", label: t('tabRobotsTest') },
  ];

  const availability = useQuery(
    api.seoAudit_queries.getCrawlAnalyticsAvailability,
    { domainId }
  );

  if (!availability) return null;

  const hasAnyData =
    availability.hasLinks ||
    availability.hasRedirects ||
    availability.hasImages ||
    availability.hasPageSpeed ||
    availability.hasWordFreq ||
    availability.hasRobotsTest;

  if (!hasAnyData) return null;

  const availableTabs = TABS.filter((tab) => {
    switch (tab.key) {
      case "links": return availability.hasLinks;
      case "redirects": return availability.hasRedirects;
      case "images": return availability.hasImages;
      case "pageSpeed": return availability.hasPageSpeed;
      case "wordFreq": return availability.hasWordFreq;
      case "robotsTest": return availability.hasRobotsTest;
    }
  });

  // Auto-select first available tab if current is unavailable
  const effectiveTab = availableTabs.find((t) => t.key === activeTab)
    ? activeTab
    : availableTabs[0]?.key || "links";

  return (
    <div className="bg-primary rounded-lg border border-secondary p-6">
      <h3 className="text-md font-semibold text-primary mb-4">
        {t('crawlAnalytics')}
      </h3>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-secondary overflow-x-auto">
        {availableTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              effectiveTab === tab.key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-tertiary hover:text-secondary hover:border-tertiary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {effectiveTab === "links" && <CrawlLinksTable domainId={domainId} />}
      {effectiveTab === "redirects" && <RedirectChainsTable domainId={domainId} />}
      {effectiveTab === "images" && <ImageAnalysisTable domainId={domainId} />}
      {effectiveTab === "pageSpeed" && <PageSpeedTab domainId={domainId} />}
      {effectiveTab === "wordFreq" && <WordFrequencySection domainId={domainId} />}
      {effectiveTab === "robotsTest" && <RobotsTestResultsCard domainId={domainId} />}
    </div>
  );
}
