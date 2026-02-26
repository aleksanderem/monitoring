"use client";

import { useState, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  ArrowLeft,
  Globe01,
  Hash01,
  Edit01,
  Trash01,
  RefreshCw01,
  BarChart03,
  Settings01,
  Link03,
  TrendUp02,
  HomeLine,
  Save01,
  FileCheck02,
  FileSearch02,
  Lightbulb02,
  Users01,
  Lightning01,
  CodeBrowser
} from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { LoadingState } from "@/components/shared/LoadingState";
import { DeleteConfirmationDialog } from "@/components/application/modals/delete-confirmation-dialog";
import { ShareLinkDialog } from "@/components/domain/modals/ShareLinkDialog";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { Heading as AriaHeading, type Key } from "react-aria-components";
import { Tag, TagGroup, type TagItem, TagList } from "@/components/base/tags/tags";
import { Plus } from "@untitledui/icons";
import { Tabs, TabList, Tab, TabPanel } from "@/components/application/tabs/tabs";
import { MetricsChart04 } from "@/components/application/metrics/metrics";
import { toast } from "sonner";
import { ModuleHubCard } from "@/components/domain/cards/ModuleHubCard";
import type { ModuleHubData } from "@/components/domain/cards/ModuleHubCard";
import { useModuleReadiness } from "@/hooks/useModuleReadiness";
import { CanvasRevealEffect } from "@/components/ui/canvas-reveal-effect";
import { PositionDistributionChart } from "@/components/domain/charts/PositionDistributionChart";
import { MovementTrendChart } from "@/components/domain/charts/MovementTrendChart";
import { MonitoringStats } from "@/components/domain/sections/MonitoringStats";
import { ExecutiveSummary } from "@/components/domain/sections/ExecutiveSummary";
import { SERPFeaturesSection } from "@/components/domain/sections/SERPFeaturesSection";
import { KeywordMonitoringTable } from "@/components/domain/tables/KeywordMonitoringTable";
import { LiveBadge } from "@/components/domain/badges/LiveBadge";
import { Activity } from "@untitledui/icons";
import { VisibilityStats } from "@/components/domain/sections/VisibilityStats";
import { GscMetricsCard } from "@/components/domain/GscMetricsCard";
import { TopKeywordsTable } from "@/components/domain/tables/TopKeywordsTable";
import { AllKeywordsTable } from "@/components/domain/tables/AllKeywordsTable";
import { DiscoveredKeywordsTable } from "@/components/domain/tables/DiscoveredKeywordsTable";
import { Top10KeywordsSection } from "@/components/domain/sections/Top10KeywordsSection";
import { BacklinksSummaryStats } from "@/components/domain/sections/BacklinksSummaryStats";
import { PlatformTypesChart } from "@/components/domain/charts/PlatformTypesChart";
import { LinkAttributesChart } from "@/components/domain/charts/LinkAttributesChart";
import { BacklinksHistoryChart } from "@/components/domain/charts/BacklinksHistoryChart";
import { TLDDistributionTable } from "@/components/domain/tables/TLDDistributionTable";
import { CountriesDistributionTable } from "@/components/domain/tables/CountriesDistributionTable";
import { BacklinksTable } from "@/components/domain/tables/BacklinksTable";
import { BacklinkVelocityChart } from "@/components/domain/charts/BacklinkVelocityChart";
import { VelocityMetricsCards } from "@/components/domain/cards/VelocityMetricsCards";
import { OnSiteSection } from "@/components/domain/sections/OnSiteSection";
import { CompetitorManagementSection } from "@/components/domain/sections/CompetitorManagementSection";
import { CompetitorBacklinksSection } from "@/components/domain/sections/CompetitorBacklinksSection";
import { CompetitorContentAnalysisSection } from "@/components/domain/sections/CompetitorContentAnalysisSection";
import { AddKeywordsModal } from "@/components/domain/modals/AddKeywordsModal";
import { CompetitorOverviewChart } from "@/components/domain/charts/CompetitorOverviewChart";
import { CompetitorPositionScatterChart } from "@/components/domain/charts/CompetitorPositionScatterChart";
import { CompetitorKeywordBarsChart } from "@/components/domain/charts/CompetitorKeywordBarsChart";
import { CompetitorBacklinkRadarChart } from "@/components/domain/charts/CompetitorBacklinkRadarChart";
import { BacklinkQualityComparisonChart } from "@/components/domain/charts/BacklinkQualityComparisonChart";
import { CompetitorKeywordGapTable } from "@/components/domain/tables/CompetitorKeywordGapTable";
import { CompetitorAnalysisReportsSection } from "@/components/domain/sections/CompetitorAnalysisReportsSection";
import { KeywordMapSection } from "@/components/domain/sections/KeywordMapSection";
import { BacklinkProfileSection } from "@/components/domain/sections/BacklinkProfileSection";
import { LinkBuildingSection } from "@/components/domain/sections/LinkBuildingSection";
import { ContentGapSection } from "@/components/domain/sections/ContentGapSection";
import { InsightsSection } from "@/components/domain/sections/InsightsSection";
import { Target04, LinkExternal02, Stars01 } from "@untitledui/icons";
import { GenerateReportModal } from "@/components/domain/modals/GenerateReportModal";
import { DomainSetupWizard } from "@/components/domain/onboarding/DomainSetupWizard";
import { AIKeywordResearchSection } from "@/components/domain/sections/AIKeywordResearchSection";
import { StrategySection } from "@/components/domain/sections/StrategySection";
import { DiagnosticSection } from "@/components/domain/sections/DiagnosticSection";
import { GeneratorsSection } from "@/components/domain/sections/GeneratorsSection";
import { AlertsSection } from "@/components/domain/sections/AlertsSection";
import { OnboardingChecklist } from "@/components/domain/onboarding/OnboardingChecklist";
import { getCountryFlag, getLanguageFlag } from "@/lib/countryFlags";
import { EzIcon } from "@/components/foundations/ez-icon";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { LockedTabCTA, type LockedTabId } from "@/components/domain/LockedTabCTA";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const TAB_EZICONS: Record<string, string> = {
  "overview": "analytics-02",
  "monitoring": "activity-04",
  "keyword-map": "map-pin",
  "visibility": "eye",
  "backlinks": "link-06",
  "link-building": "share-08",
  "competitors": "user-group",
  "keyword-analysis": "search-02",
  "on-site": "audit-01",
  "content-gaps": "puzzle",
  "insights": "idea",
  "ai-research": "ai-magic",
  "strategy": "strategy",
  "generators": "code",
  "diagnostics": "stethoscope",
  "alerts": "alert-02",
  "settings": "settings-05",
};

// Module Hub card configuration
const MODULE_CARDS: {
  tabId: string;
  titleKey: string;
  descriptionKey: string;
  colors: [number, number, number][];
  group: string;
}[] = [
  // Monitoring group — blue
  { tabId: "monitoring", titleKey: "tabMonitoring", descriptionKey: "moduleDescMonitoring", colors: [[59,130,246],[37,99,235]], group: "hubSectionMonitoring" },
  { tabId: "keyword-map", titleKey: "tabKeywordMap", descriptionKey: "moduleDescKeywordMap", colors: [[59,130,246],[37,99,235]], group: "hubSectionMonitoring" },
  { tabId: "visibility", titleKey: "tabVisibility", descriptionKey: "moduleDescVisibility", colors: [[59,130,246],[37,99,235]], group: "hubSectionMonitoring" },
  // Competition group — indigo
  { tabId: "competitors", titleKey: "tabCompetitors", descriptionKey: "moduleDescCompetitors", colors: [[99,102,241],[79,70,229]], group: "hubSectionCompetition" },
  { tabId: "content-gaps", titleKey: "tabContentGaps", descriptionKey: "moduleDescContentGaps", colors: [[99,102,241],[79,70,229]], group: "hubSectionCompetition" },
  { tabId: "link-building", titleKey: "tabLinkBuilding", descriptionKey: "moduleDescLinkBuilding", colors: [[99,102,241],[79,70,229]], group: "hubSectionCompetition" },
  // Audit group — slate-blue
  { tabId: "backlinks", titleKey: "tabBacklinks", descriptionKey: "moduleDescBacklinks", colors: [[71,85,105],[51,65,85]], group: "hubSectionAudit" },
  { tabId: "on-site", titleKey: "tabOnSite", descriptionKey: "moduleDescOnSite", colors: [[71,85,105],[51,65,85]], group: "hubSectionAudit" },
  { tabId: "insights", titleKey: "tabInsights", descriptionKey: "moduleDescInsights", colors: [[71,85,105],[51,65,85]], group: "hubSectionAudit" },
  // Tools group — slate
  { tabId: "ai-research", titleKey: "tabAIResearch", descriptionKey: "moduleDescAIResearch", colors: [[100,116,139],[71,85,105]], group: "hubSectionTools" },
  { tabId: "strategy", titleKey: "tabStrategy", descriptionKey: "moduleDescStrategy", colors: [[100,116,139],[71,85,105]], group: "hubSectionTools" },
  { tabId: "keyword-analysis", titleKey: "tabKeywordAnalysis", descriptionKey: "moduleDescKeywordAnalysis", colors: [[100,116,139],[71,85,105]], group: "hubSectionTools" },
  { tabId: "generators", titleKey: "tabGenerators", descriptionKey: "moduleDescGenerators", colors: [[100,116,139],[71,85,105]], group: "hubSectionTools" },
  { tabId: "alerts", titleKey: "tabAlerts", descriptionKey: "moduleDescAlerts", colors: [[100,116,139],[71,85,105]], group: "hubSectionTools" },
  { tabId: "settings", titleKey: "tabSettings", descriptionKey: "moduleDescSettings", colors: [[100,116,139],[71,85,105]], group: "hubSectionTools" },
];

const HUB_GROUPS = ["hubSectionMonitoring", "hubSectionCompetition", "hubSectionAudit", "hubSectionTools"];

// Helper to format date
function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Helper to format relative time
function formatRelativeTime(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function GscPropertySection({ domainId }: { domainId: Id<"domains"> }) {
  const t = useTranslations("domains");
  const gscData = useQuery(api.gsc.getGscPropertiesForDomain, { domainId });
  const setGscProperty = useMutation(api.gsc.setDomainGscProperty);

  if (gscData === undefined) {
    return <div className="animate-pulse h-24 rounded-xl border border-secondary bg-primary" />;
  }

  if (!gscData || !gscData.connected) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <h3 className="text-sm font-semibold text-primary mb-2">{t("gscProperty")}</h3>
        <p className="text-sm text-tertiary">{t("gscConnectHint")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6">
      <h3 className="text-sm font-semibold text-primary mb-3">{t("gscProperty")}</h3>
      {gscData.properties.length > 0 ? (
        <select
          value={gscData.selectedPropertyUrl || ""}
          onChange={async (e) => {
            await setGscProperty({
              domainId,
              propertyUrl: e.target.value || null,
            });
          }}
          className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        >
          <option value="">{t("gscSelectProperty")}</option>
          {gscData.properties.map((p: { url: string; type: string }) => (
            <option key={p.url} value={p.url}>
              {p.url} ({p.type})
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-tertiary">{t("gscNotConnected")}</p>
      )}
    </div>
  );
}

function DomainLimitsSection({ domainId, currentLimits }: { domainId: Id<"domains">; currentLimits?: { maxKeywords?: number; maxDailyRefreshes?: number } }) {
  const t = useTranslations("domains");
  const updateDomainLimits = useMutation(api.limits.updateDomainLimits);

  const [maxKeywords, setMaxKeywords] = useState<number | null>(null);
  const [maxDailyRefreshes, setMaxDailyRefreshes] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentMaxKeywords = maxKeywords ?? currentLimits?.maxKeywords ?? 0;
  const currentMaxDailyRefreshes = maxDailyRefreshes ?? currentLimits?.maxDailyRefreshes ?? 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDomainLimits({
        domainId,
        limits: {
          maxKeywords: currentMaxKeywords || null,
          maxDailyRefreshes: currentMaxDailyRefreshes || null,
        },
      });
      toast.success(t("limitsUpdated"));
    } catch {
      toast.error(t("limitsUpdateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-6">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-primary">{t("refreshLimitsTitle")}</h2>
        <p className="mt-1 text-sm text-tertiary">{t("refreshLimitsDescription")}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-secondary">{t("maxKeywordsLabel")}</label>
          <input
            type="number"
            min={0}
            value={currentMaxKeywords}
            onChange={(e) => setMaxKeywords(parseInt(e.target.value) || 0)}
            className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
          />
          <p className="text-xs text-tertiary">{t("maxKeywordsHint")}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-secondary">{t("maxDailyRefreshesLabel")}</label>
          <input
            type="number"
            min={0}
            value={currentMaxDailyRefreshes}
            onChange={(e) => setMaxDailyRefreshes(parseInt(e.target.value) || 0)}
            className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
          />
          <p className="text-xs text-tertiary">{t("maxDailyRefreshesHint")}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          color="primary"
          size="sm"
          onClick={handleSave}
          isLoading={isSaving}
        >
          {t("limitsSave")}
        </Button>
      </div>
    </div>
  );
}

function BusinessContextSection({ domainId, domain }: { domainId: Id<"domains">; domain: { businessDescription?: string; targetCustomer?: string; domain: string } }) {
  const t = useTranslations("domains");
  const [desc, setDesc] = useState(domain.businessDescription ?? "");
  const [customer, setCustomer] = useState(domain.targetCustomer ?? "");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const saveContext = useMutation(api.domains.saveBusinessContextPublic);
  const generateContext = useAction(api.actions.aiBusinessContext.generateBusinessContext);

  // Sync if domain data loads later
  useEffect(() => {
    if (domain.businessDescription && !desc) setDesc(domain.businessDescription);
    if (domain.targetCustomer && !customer) setCustomer(domain.targetCustomer);
  }, [domain.businessDescription, domain.targetCustomer]);

  const dirty =
    desc.trim() !== (domain.businessDescription ?? "") ||
    customer.trim() !== (domain.targetCustomer ?? "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveContext({ domainId, businessDescription: desc.trim(), targetCustomer: customer.trim() });
      toast.success(t("businessContextSaved"));
    } catch {
      toast.error(t("businessContextSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateContext({ domainId });
      if (result.businessDescription) setDesc(result.businessDescription);
      if (result.targetCustomer) setCustomer(result.targetCustomer);
      toast.success(t("autoGenerateSuccess"));
    } catch {
      toast.error(t("autoGenerateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="relative rounded-xl border border-secondary bg-primary p-6">
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">{t("businessContextTitle")}</h2>
          <p className="mt-0.5 text-sm text-tertiary">{t("businessContextDescription")}</p>
        </div>
        <Button
          color="secondary"
          size="sm"
          iconLeading={Stars01}
          onClick={handleGenerate}
          isDisabled={generating}
        >
          {generating ? t("autoGenerating") : t("autoGenerateAI")}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-secondary">{t("businessDescriptionLabel")}</label>
          <textarea
            className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-quaternary focus:outline-none focus:ring-2 focus:ring-brand-solid focus:border-transparent resize-none dark:bg-neutral-900 dark:border-neutral-700"
            rows={4}
            placeholder={t("businessDescriptionPlaceholder")}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            disabled={generating}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-secondary">{t("targetCustomerLabel")}</label>
          <textarea
            className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-quaternary focus:outline-none focus:ring-2 focus:ring-brand-solid focus:border-transparent resize-none dark:bg-neutral-900 dark:border-neutral-700"
            rows={3}
            placeholder={t("targetCustomerPlaceholder")}
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            disabled={generating}
          />
        </div>
      </div>

      {dirty && (
        <div className="mt-4 flex justify-end">
          <Button color="primary" size="sm" onClick={handleSave} isDisabled={saving}>
            {saving ? t("onboardingAdding") : t("businessContextSaveBtn")}
          </Button>
        </div>
      )}
    </div>
  );
}

function TabContentOrCTA({
  tabId,
  moduleReadiness,
  domainId,
  children,
}: {
  tabId: string;
  moduleReadiness: Record<string, { locked: boolean; lockReason: string }>;
  domainId: Id<"domains">;
  children: React.ReactNode;
}) {
  const state = moduleReadiness[tabId];
  if (state?.locked) {
    return <LockedTabCTA tabId={tabId as LockedTabId} lockReason={state.lockReason} domainId={domainId} />;
  }
  return <>{children}</>;
}

export default function DomainDetailPage() {
  const t = useTranslations('domains');
  const locale = useLocale();

  const isSuperAdmin = useQuery(api.admin.checkIsSuperAdmin);
  const params = useParams();
  const router = useRouter();
  const domainId = params.domainId as Id<"domains">;

  // Strategy tab — active strategy for sidebar badge
  const activeStrategySession = useQuery(api.aiStrategy.getActiveStrategy, { domainId });
  const strategyBadge = (() => {
    if (!activeStrategySession || activeStrategySession.status !== "completed") return undefined;
    const s = activeStrategySession as any;
    const ap = s.strategy?.actionPlan ?? [];
    const as_ = s.strategy?.actionableSteps ?? [];
    const total = ap.length + as_.length;
    if (total === 0) return undefined;
    const done = (s.taskStatuses ?? []).filter((x: any) => x.completed).length
      + (s.stepStatuses ?? []).filter((x: any) => x.completed).length;
    return `${done}/${total}`;
  })();

  const { hasModule, can } = usePermissions();
  const moduleReadiness = useModuleReadiness(domainId);

  const tabs = [
    { id: "overview", label: t('tabOverview'), icon: BarChart03 },
    { id: "monitoring", label: t('tabMonitoring'), icon: Activity, locked: moduleReadiness.monitoring?.locked, lockReason: moduleReadiness.monitoring?.lockReason },
    { id: "keyword-map", label: t('tabKeywordMap'), icon: Target04, locked: moduleReadiness["keyword-map"]?.locked, lockReason: moduleReadiness["keyword-map"]?.lockReason },
    { id: "visibility", label: t('tabVisibility'), icon: TrendUp02, locked: moduleReadiness.visibility?.locked, lockReason: moduleReadiness.visibility?.lockReason },
    ...(hasModule("backlinks") ? [{ id: "backlinks", label: t('tabBacklinks'), icon: Link03, locked: moduleReadiness.backlinks?.locked, lockReason: moduleReadiness.backlinks?.lockReason }] : []),
    ...(hasModule("link_building") ? [{ id: "link-building", label: t('tabLinkBuilding'), icon: LinkExternal02, locked: moduleReadiness["link-building"]?.locked, lockReason: moduleReadiness["link-building"]?.lockReason }] : []),
    ...(hasModule("competitors") ? [{ id: "competitors", label: t('tabCompetitors'), icon: Users01, locked: moduleReadiness.competitors?.locked, lockReason: moduleReadiness.competitors?.lockReason }] : []),
    { id: "keyword-analysis", label: t('tabKeywordAnalysis'), icon: FileSearch02 },
    ...(hasModule("seo_audit") ? [{ id: "on-site", label: t('tabOnSite'), icon: FileCheck02, locked: moduleReadiness["on-site"]?.locked, lockReason: moduleReadiness["on-site"]?.lockReason }] : []),
    ...(hasModule("competitors") ? [{ id: "content-gaps", label: t('tabContentGaps'), icon: Lightbulb02, locked: moduleReadiness["content-gaps"]?.locked, lockReason: moduleReadiness["content-gaps"]?.lockReason }] : []),
    { id: "insights", label: t('tabInsights'), icon: Lightning01, locked: moduleReadiness.insights?.locked, lockReason: moduleReadiness.insights?.lockReason },
    ...(hasModule("ai_strategy") ? [
      { id: "ai-research", label: t('tabAIResearch'), icon: Stars01, locked: moduleReadiness["ai-research"]?.locked, lockReason: moduleReadiness["ai-research"]?.lockReason },
      { id: "strategy", label: t('tabStrategy'), icon: Stars01, badge: strategyBadge, locked: moduleReadiness.strategy?.locked, lockReason: moduleReadiness.strategy?.lockReason },
    ] : []),
    { id: "generators", label: t('tabGenerators'), icon: CodeBrowser },
    { id: "alerts", label: t('tabAlerts'), icon: Activity },
    { id: "settings", label: t('tabSettings'), icon: Settings01 },
    ...(isSuperAdmin ? [{ id: "diagnostics", label: t('tabDiagnostics'), icon: Settings01 }] : []),
  ];

  const [selectedTab, setSelectedTab] = useState<string>("overview");

  const domain = useQuery(api.domains.getDomain, { domainId });
  const keywords = useQuery(api.keywords.getKeywords, { domainId });
  const projects = useQuery(api.projects.list);
  const deleteDomain = useMutation(api.domains.remove);
  const refreshKeywords = useMutation(api.keywords.refreshKeywordPositions);
  const updateDomain = useMutation(api.domains.updateDomain);

  const tabLabel = tabs.find((t) => t.id === selectedTab)?.label ?? selectedTab;
  usePageTitle(domain?.domain, tabLabel);

  // Visibility tab queries
  const visibilityStats = useQuery(api.domains.getVisibilityStats, { domainId });
  const top3Keywords = useQuery(api.domains.getTopKeywords, {
    domainId,
    limit: 10,
    positionRange: { min: 1, max: 3 }
  });
  const top10Keywords = useQuery(api.domains.getTopKeywords, {
    domainId,
    limit: 10,
    positionRange: { min: 4, max: 10 }
  });

  // Backlinks tab queries and state
  const backlinksSummary = useQuery(api.backlinks.getBacklinkSummary, { domainId });
  const isBacklinkDataStale = useQuery(api.backlinks.isBacklinkDataStale, { domainId });
  const backlinksDistributions = useQuery(api.backlinks.getBacklinkDistributions, { domainId });
  const fetchBacklinksAction = useAction(api.backlinks.fetchBacklinksFromAPI);

  // Backlink velocity queries
  const velocityHistory = useQuery(api.backlinkVelocity.getVelocityHistory, { domainId, days: 30 });
  const velocityStats = useQuery(api.backlinkVelocity.getVelocityStats, { domainId, days: 30 });
  const velocity7Day = useQuery(api.backlinkVelocity.getVelocityStats, { domainId, days: 7 });

  // Content gaps queries (now handled inside ContentGapSection)

  // Visibility data fetching actions
  const fetchVisibilityAction = useAction(api.dataforseo.fetchAndStoreVisibility);
  const fetchVisibilityHistoryAction = useAction(api.dataforseo.fetchAndStoreVisibilityHistory);

  // Onboarding
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus, { domainId });
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardAutoOpened, setWizardAutoOpened] = useState(false);

  // Auto-open wizard for new domains that haven't completed onboarding
  useEffect(() => {
    if (
      onboardingStatus &&
      !onboardingStatus.isCompleted &&
      !onboardingStatus.isDismissed &&
      !wizardAutoOpened
    ) {
      setIsWizardOpen(true);
      setWizardAutoOpened(true);
    }
  }, [onboardingStatus, wizardAutoOpened]);

  // Personalization data for module hub cards
  const hubData: ModuleHubData = useMemo(() => ({
    domain: domain?.domain,
    keywords: keywords?.slice(0, 5).map((k) => k.phrase),
    keywordCount: onboardingStatus?.counts.monitoredKeywords ?? keywords?.length,
    competitorCount: onboardingStatus?.counts.activeCompetitors,
    gapCount: onboardingStatus?.counts.contentGaps,
    searchEngine: domain?.settings.searchEngine,
    location: domain?.settings.location,
    language: domain?.settings.language,
    locale,
  }), [domain, keywords, onboardingStatus, locale]);

  const [isFetchingBacklinks, setIsFetchingBacklinks] = useState(false);
  const [isFetchingVisibility, setIsFetchingVisibility] = useState(false);
  const [isAddKeywordsModalOpen, setIsAddKeywordsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [backlinksPage, setBacklinksPage] = useState(1);
  const backlinksPageSize = 50;

  const backlinksData = useQuery(api.backlinks.getBacklinks, {
    domainId,
    limit: backlinksPageSize,
    offset: (backlinksPage - 1) * backlinksPageSize,
  });

  const handleFetchBacklinks = async () => {
    try {
      setIsFetchingBacklinks(true);
      const result = await fetchBacklinksAction({ domainId });
      toast.success(t('fetchedBacklinks', { count: result.backlinksCount }));
      setBacklinksPage(1); // Reset to first page
    } catch (error) {
      toast.error(t('failedToFetchBacklinks'));
      console.error(error);
    } finally {
      setIsFetchingBacklinks(false);
    }
  };

  const handleFetchVisibility = async () => {
    if (!domain) return;

    try {
      setIsFetchingVisibility(true);
      toast.info(t('fetchingVisibilityData'));

      // Fetch both discovered keywords and visibility history in parallel
      const [visibilityResult, historyResult] = await Promise.all([
        fetchVisibilityAction({
          domainId,
          domain: domain.domain,
          location: domain.settings.location,
          language: domain.settings.language,
        }),
        fetchVisibilityHistoryAction({
          domainId,
          domain: domain.domain,
          location: domain.settings.location,
          language: domain.settings.language,
        }),
      ]);

      const messages: string[] = [];
      if (visibilityResult.success) {
        messages.push(t('discoveredKeywords', { count: visibilityResult.count || 0 }));
      }
      if (historyResult.success) {
        messages.push(t('monthsHistory', { count: historyResult.datesStored || 0 }));
      }

      if (messages.length > 0) {
        toast.success(t('fetchedData', { data: messages.join(", ") }));
      } else {
        toast.error(t('failedToFetchVisibility'));
      }
    } catch (error) {
      toast.error(t('failedToFetchVisibility'));
      console.error(error);
    } finally {
      setIsFetchingVisibility(false);
    }
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    projectId: "" as Id<"projects"> | "",
    tags: [] as TagItem[],
    refreshFrequency: "",
    searchEngine: "",
    location: "",
    language: "",
  });
  const [newTagInput, setNewTagInput] = useState("");

  const handleDelete = async () => {
    try {
      await deleteDomain({ id: domainId });
      toast.success(t('domainDeletedSuccess'));
      router.push("/domains");
    } catch (error) {
      toast.error(t('failedToDeleteDomain'));
      console.error(error);
    }
  };

  const handleRefresh = async () => {
    try {
      if (!keywords || keywords.length === 0) {
        toast.error(t('noKeywordsToRefresh'));
        return;
      }

      const keywordIds = keywords.map(k => k._id);
      await refreshKeywords({ keywordIds });
      toast.success(t('refreshingKeywords', { count: keywords.length }));
    } catch (error) {
      toast.error(t('failedToStartRefresh'));
      console.error(error);
    }
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !editForm.tags.some(t => t.label === trimmed)) {
      setEditForm({
        ...editForm,
        tags: [...editForm.tags, { id: `tag-${Date.now()}`, label: trimmed }],
      });
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (keys: Set<Key>) => {
    setEditForm({
      ...editForm,
      tags: editForm.tags.filter(tag => !keys.has(tag.id)),
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDomain({
        domainId,
        projectId: editForm.projectId || undefined,
        tags: editForm.tags.length > 0 ? editForm.tags.map(t => t.label) : undefined,
        settings: {
          refreshFrequency: editForm.refreshFrequency as "daily" | "weekly" | "on_demand",
          searchEngine: editForm.searchEngine,
          location: editForm.location,
          language: editForm.language,
        },
      });
      toast.success(t('domainUpdatedSuccess'));
      setIsEditModalOpen(false);
    } catch (error) {
      toast.error(t('failedToUpdateDomain'));
      console.error(error);
    }
  };

  // Populate form when modal opens
  useEffect(() => {
    if (isEditModalOpen && domain) {
      const tags = (domain.tags || []).map((tag, idx) => ({
        id: `tag-${idx}`,
        label: tag,
      }));
      setEditForm({
        projectId: domain.projectId,
        tags,
        refreshFrequency: domain.settings.refreshFrequency,
        searchEngine: domain.settings.searchEngine,
        location: domain.settings.location,
        language: domain.settings.language,
      });
      setNewTagInput("");
    }
  }, [isEditModalOpen, domain]);

  if (domain === undefined) {
    return (
      <div className="p-8">
        <LoadingState type="card" />
      </div>
    );
  }

  if (domain === null) {
    return (
      <div className="mx-auto flex w-full max-w-container flex-col gap-8 px-4 py-8 lg:px-8">
        <div className="text-center">
          <p className="text-lg font-semibold text-primary">{t('domainNotFound')}</p>
          <Button size="md" color="secondary" onClick={() => router.push("/domains")} className="mt-4">
            {t('backToDomains')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="flex w-full flex-col gap-3 bg-secondary_subtle pt-8 pb-12 shadow-none lg:gap-8 lg:bg-primary lg:pt-12 lg:pb-24">
      <div className="mx-auto flex w-full max-w-container flex-col gap-5 px-4 lg:px-8">
        {/* Domain header banner with canvas effect */}
        <div className="relative overflow-hidden rounded-2xl border border-secondary bg-white dark:bg-neutral-900">
          {/* Canvas background */}
          <CanvasRevealEffect
            animationSpeed={0.3}
            colors={[[59,130,246],[37,99,235]]}
            dotSize={2}
            showGradient={false}
          />
          {/* Gradient overlay for readability */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-white/40 dark:from-neutral-900/95 dark:via-neutral-900/80 dark:to-neutral-900/40" />

          {/* Content */}
          <div className="relative z-10 flex flex-col gap-4 p-5 lg:p-6">
            <div className="max-lg:hidden">
              <Breadcrumbs type="button">
                <Breadcrumbs.Item href="/" icon={HomeLine} />
                <Breadcrumbs.Item href="/domains">{t('domains')}</Breadcrumbs.Item>
                <Breadcrumbs.Item href="#">{domain.domain}</Breadcrumbs.Item>
              </Breadcrumbs>
            </div>
            <div className="flex lg:hidden">
              <Button href="/domains" color="link-gray" size="md" iconLeading={ArrowLeft}>
                {t('back')}
              </Button>
            </div>

            {/* Page header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                  <Globe01 className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-primary lg:text-display-xs">
                    {domain.domain}
                  </h1>
                  <p className="text-md text-tertiary">
                    {getCountryFlag(domain.settings.location)} {domain.settings.location} · {getLanguageFlag(domain.settings.language)} {domain.settings.language} · {domain.settings.searchEngine} · {domain.settings.refreshFrequency}
                  </p>
                </div>
              </div>

            <div className="flex gap-2">
              {onboardingStatus?.isCompleted !== false ? (
                <>
                  <PermissionGate permission="reports.share">
                    <ShareLinkDialog domainId={domainId}>
                      <ButtonUtility
                        size="sm"
                        color="tertiary"
                        tooltip={t('shareMonitoring')}
                        icon={Link03}
                      />
                    </ShareLinkDialog>
                  </PermissionGate>
                  <PermissionGate permission="reports.create">
                    <ButtonUtility
                      size="sm"
                      color="tertiary"
                      tooltip={t('generateFullReport')}
                      icon={FileCheck02}
                      onClick={() => setIsReportModalOpen(true)}
                    />
                  </PermissionGate>
                  <PermissionGate permission="keywords.refresh">
                    <ButtonUtility
                      size="sm"
                      color="tertiary"
                      tooltip={t('refreshRankings')}
                      icon={RefreshCw01}
                      onClick={handleRefresh}
                    />
                  </PermissionGate>
                  <PermissionGate permission="domains.edit">
                    <ButtonUtility
                      size="sm"
                      color="tertiary"
                      tooltip={t('edit')}
                      icon={Edit01}
                      onClick={() => setIsEditModalOpen(true)}
                    />
                  </PermissionGate>
                  <PermissionGate permission="domains.delete">
                    <DeleteConfirmationDialog
                      title={`Delete "${domain.domain}"?`}
                      description="This will permanently delete the domain and all associated keywords and ranking data. This action cannot be undone."
                      confirmLabel="Delete domain"
                      onConfirm={handleDelete}
                    >
                      <ButtonUtility
                        size="sm"
                        color="tertiary"
                        tooltip={t('delete')}
                        icon={Trash01}
                      />
                    </DeleteConfirmationDialog>
                  </PermissionGate>
                </>
              ) : (
                <>
                  <ButtonUtility size="sm" color="tertiary" icon={Link03} isDisabled />
                  <ButtonUtility size="sm" color="tertiary" icon={FileCheck02} isDisabled />
                  <ButtonUtility size="sm" color="tertiary" icon={RefreshCw01} isDisabled />
                  <ButtonUtility size="sm" color="tertiary" icon={Edit01} isDisabled />
                  <ButtonUtility size="sm" color="tertiary" icon={Trash01} isDisabled />
                </>
              )}
            </div>
          </div>
          {/* /content */}
          </div>
        {/* /banner */}
        </div>
      </div>

      {/* Onboarding Checklist Banner */}
      <div className="mx-auto w-full max-w-container px-4 lg:px-8">
        <OnboardingChecklist
          domainId={domainId}
          onOpenWizard={() => setIsWizardOpen(true)}
        />
      </div>

      {/* Main content with vertical tabs */}
      <div className="relative mx-auto w-full max-w-container px-4 lg:px-8">
        {/* Block interactions until onboarding is completed */}
        {onboardingStatus && !onboardingStatus.isCompleted && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-start pt-32">
            <div className="absolute inset-0 bg-primary/60 backdrop-blur-[2px]" />
            <div className="relative z-10 flex flex-col items-center gap-4 rounded-xl border border-secondary bg-primary p-8 shadow-lg">
              <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                <Settings01 className="h-6 w-6 text-brand-600" />
              </div>
              <h3 className="text-lg font-semibold text-primary">{t('onboardingRequiredTitle')}</h3>
              <p className="max-w-sm text-center text-sm text-tertiary">{t('onboardingRequiredDescription')}</p>
              <Button size="md" color="primary" onClick={() => setIsWizardOpen(true)}>
                {t('onboardingStartSetup')}
              </Button>
            </div>
          </div>
        )}
        <Tabs orientation="vertical" selectedKey={selectedTab} onSelectionChange={(key) => setSelectedTab(key as string)}>
          <div className="flex w-full gap-8 lg:gap-16">
            {/* Desktop Sidebar Navigation — sticky below TopBar */}
            <div className="sticky top-20 self-start max-lg:hidden">
              <TabList size="sm" type="line" items={tabs} className="w-auto items-start">
                {(item: any) => (
                  <Tab
                    id={item.id}
                    badge={item.badge}
                    className={item.locked ? "opacity-50" : undefined}
                  >
                    <span className="relative inline-flex">
                      <EzIcon name={TAB_EZICONS[item.id] || "settings-05"} size={18} color="#94a3b8" strokeColor="#94a3b8" />
                      {item.locked && (
                        <span className="absolute -right-1 -bottom-1 flex h-3 w-3 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                          <EzIcon name="lock-01" size={8} color="#9ca3af" strokeColor="#9ca3af" />
                        </span>
                      )}
                    </span>
                    <span title={item.locked ? t(item.lockReason) : undefined}>
                      {item.label}
                    </span>
                  </Tab>
                )}
              </TabList>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-6">
              {/* Mobile Horizontal Navigation */}
              <TabList size="sm" type="line" items={tabs} className="lg:hidden">
                {(item: any) => (
                  <Tab
                    id={item.id}
                    badge={item.badge}
                    className={item.locked ? "opacity-50" : undefined}
                  >
                    <span className="relative inline-flex">
                      <EzIcon name={TAB_EZICONS[item.id] || "settings-05"} size={18} color="#94a3b8" strokeColor="#94a3b8" />
                      {item.locked && (
                        <span className="absolute -right-1 -bottom-1 flex h-3 w-3 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                          <EzIcon name="lock-01" size={8} color="#9ca3af" strokeColor="#9ca3af" />
                        </span>
                      )}
                    </span>
                    <span title={item.locked ? t(item.lockReason) : undefined}>
                      {item.label}
                    </span>
                  </Tab>
                )}
              </TabList>

            {/* Overview Tab — Module Hub */}
            <TabPanel id="overview">
              <ErrorBoundary label="Overview">
              <div className="flex flex-col gap-8">
                {HUB_GROUPS.map((group) => {
                  const cards = MODULE_CARDS.filter(
                    (c) => c.group === group && moduleReadiness[c.tabId]?.visible
                  );
                  if (cards.length === 0) return null;
                  return (
                    <div key={group} className="flex flex-col gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-quaternary">
                        {t(group)}
                      </h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {cards.map((card) => (
                          <ModuleHubCard
                            key={card.tabId}
                            tabId={card.tabId}
                            title={t(card.titleKey)}
                            description={moduleReadiness[card.tabId]?.locked
                              ? t(moduleReadiness[card.tabId].lockReason)
                              : t(card.descriptionKey)}
                            icon={TAB_EZICONS[card.tabId] || "settings-05"}
                            state={moduleReadiness[card.tabId]}
                            colors={card.colors}
                            onClick={() => setSelectedTab(card.tabId)}
                            onNavigateToTab={(tid) => setSelectedTab(tid)}
                            data={hubData}
                            benefitText={t(`moduleBenefit${card.tabId}`)}
                            benefitLabel={t("moduleWhatGives")}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              </ErrorBoundary>
            </TabPanel>

            {/* Monitoring Tab */}
            <TabPanel id="monitoring">
              <ErrorBoundary label="Monitoring">
              <TabContentOrCTA tabId="monitoring" moduleReadiness={moduleReadiness} domainId={domainId}>
              <div className="flex flex-col gap-8">
                {/* Header with Add Keywords Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-primary">{t('keywordMonitoring')}</h2>
                    <LiveBadge size="md" />
                  </div>
                  <PermissionGate permission="keywords.add">
                    <Button
                      size="md"
                      color="primary"
                      iconLeading={Plus}
                      onClick={() => setIsAddKeywordsModalOpen(true)}
                    >
                      {t('addKeywords')}
                    </Button>
                  </PermissionGate>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <PositionDistributionChart domainId={domainId} />
                  <MovementTrendChart domainId={domainId} />
                </div>

                {/* GSC Metrics (renders null if not connected) */}
                <GscMetricsCard domainId={domainId} />

                {/* Statistics Section */}
                <MonitoringStats domainId={domainId} />

                {/* SERP Features */}
                <SERPFeaturesSection domainId={domainId} />

                {/* Monitoring Table */}
                <KeywordMonitoringTable domainId={domainId} />
              </div>
              </TabContentOrCTA>
              </ErrorBoundary>
            </TabPanel>

            {/* Keyword Map Tab */}
            <TabPanel id="keyword-map">
              <ErrorBoundary label="Keyword Map">
              <TabContentOrCTA tabId="keyword-map" moduleReadiness={moduleReadiness} domainId={domainId}>
              <KeywordMapSection domainId={domainId} />
              </TabContentOrCTA>
              </ErrorBoundary>
            </TabPanel>

            {/* Visibility Tab */}
            <TabPanel id="visibility">
              <ErrorBoundary label="Visibility">
              <TabContentOrCTA tabId="visibility" moduleReadiness={moduleReadiness} domainId={domainId}>
              <div className="flex flex-col gap-6">
                {/* Header with Fetch Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">{t('domainVisibility')}</h2>
                    <p className="text-sm text-tertiary">
                      {t('trackVisibilityDescription')}
                    </p>
                  </div>
                  <Button
                    size="md"
                    color="primary"
                    iconLeading={RefreshCw01}
                    onClick={handleFetchVisibility}
                    disabled={isFetchingVisibility || !domain}
                    title={t('fetchCurrentRankings')}
                  >
                    {isFetchingVisibility ? t('fetching') : t('refreshKeywords')}
                  </Button>
                </div>

                {/* Executive Summary */}
                <ExecutiveSummary domainId={domainId} />

                {/* Visibility Statistics */}
                <VisibilityStats
                  stats={visibilityStats || {
                    totalKeywords: 0,
                    avgPosition: 0,
                    top3Count: 0,
                    top10Count: 0,
                    top100Count: 0,
                    visibilityScore: 0,
                    visibilityChange: 0,
                  }}
                  isLoading={visibilityStats === undefined}
                />

                {/* Discovered Keywords Table with Rich Data - Full Width */}
                <DiscoveredKeywordsTable domainId={domainId} />

                {/* Top 10 Keywords Section - Full Width */}
                <Top10KeywordsSection
                  keywords={top10Keywords || []}
                  isLoading={top10Keywords === undefined}
                />

                {/* Position Distribution & Movement Trend */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <PositionDistributionChart domainId={domainId} />
                  <MovementTrendChart domainId={domainId} />
                </div>
              </div>
              </TabContentOrCTA>
              </ErrorBoundary>
            </TabPanel>

            {/* Backlinks Tab */}
            <TabPanel id="backlinks">
              <ErrorBoundary label="Backlinks">
              <TabContentOrCTA tabId="backlinks" moduleReadiness={moduleReadiness} domainId={domainId}>
              <div className="flex flex-col gap-6">
                {/* Header with Fetch Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">{t('backlinksAnalysis')}</h2>
                    <p className="text-sm text-tertiary">
                      {backlinksSummary
                        ? `${t('lastUpdated')} ${new Date(backlinksSummary.fetchedAt).toLocaleDateString()}`
                        : t('noDataAvailable')}
                    </p>
                  </div>
                  <Button
                    size="md"
                    color="primary"
                    iconLeading={RefreshCw01}
                    onClick={handleFetchBacklinks}
                    disabled={isFetchingBacklinks}
                  >
                    {isFetchingBacklinks ? t('fetching') : t('fetchBacklinks')}
                  </Button>
                </div>

                {/* Summary Statistics */}
                <BacklinksSummaryStats
                  summary={backlinksSummary || null}
                  isLoading={backlinksSummary === undefined}
                />

                {/* Backlinks History Chart */}
                {backlinksSummary && (
                  <BacklinksHistoryChart domainId={domainId} />
                )}

                {/* Backlink Velocity Section */}
                <div className="flex flex-col gap-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                      <EzIcon name="rocket-01" size={20} color="#059669" strokeColor="#059669" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-primary">{t('backlinkVelocity')}</h3>
                      <p className="text-sm text-tertiary">
                        {t('trackBacklinkAcquisition')}
                      </p>
                    </div>
                  </div>

                  {/* Velocity Metrics Cards */}
                  <VelocityMetricsCards
                    stats={velocityStats || {
                      avgNewPerDay: 0,
                      avgLostPerDay: 0,
                      avgNetChange: 0,
                      totalNew: 0,
                      totalLost: 0,
                      netChange: 0,
                      daysTracked: 0,
                    }}
                    isLoading={velocityStats === undefined}
                    recentVelocity={velocity7Day?.avgNetChange}
                  />

                  {/* Velocity Chart */}
                  <BacklinkVelocityChart
                    data={velocityHistory || []}
                    isLoading={velocityHistory === undefined}
                  />
                </div>

                {/* Distribution Charts & Tables - 2x2 Grid */}
                {backlinksSummary && backlinksDistributions && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <TLDDistributionTable
                      data={backlinksDistributions.tldDistribution}
                      isLoading={backlinksDistributions === undefined}
                    />
                    <CountriesDistributionTable
                      data={backlinksDistributions.countries}
                      isLoading={backlinksDistributions === undefined}
                    />
                    <LinkAttributesChart
                      data={backlinksDistributions.linkAttributes}
                      isLoading={backlinksDistributions === undefined}
                    />
                    <PlatformTypesChart
                      data={backlinksDistributions.platformTypes}
                      isLoading={backlinksDistributions === undefined}
                    />
                  </div>
                )}

                {/* Individual Backlinks Table */}
                {backlinksSummary && (
                  <BacklinksTable
                    backlinks={
                      backlinksData || {
                        total: 0,
                        items: [],
                        stats: {
                          totalDofollow: 0,
                          totalNofollow: 0,
                          avgRank: 0,
                          avgSpamScore: 0,
                        },
                      }
                    }
                    isLoading={backlinksData === undefined}
                  />
                )}

                {/* Backlink Profile Analysis */}
                <BacklinkProfileSection domainId={domainId} />
              </div>
              </TabContentOrCTA>
              </ErrorBoundary>
            </TabPanel>

            {/* Link Building Tab */}
            <TabPanel id="link-building">
              <ErrorBoundary label="Link Building">
              <TabContentOrCTA tabId="link-building" moduleReadiness={moduleReadiness} domainId={domainId}>
              <LinkBuildingSection domainId={domainId} domainName={domain.domain} />
              </TabContentOrCTA>
              </ErrorBoundary>
            </TabPanel>

            {/* Competitors Tab */}
            <TabPanel id="competitors">
              <ErrorBoundary label="Competitors">
              <TabContentOrCTA tabId="competitors" moduleReadiness={moduleReadiness} domainId={domainId}>
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                    <EzIcon name="user-group" size={22} color="#ea580c" strokeColor="#ea580c" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-primary mb-1">{t('competitorTracking')}</h2>
                    <p className="text-sm text-tertiary">
                      {t('monitorCompetitorOpportunities')}
                    </p>
                  </div>
                </div>

                <CompetitorManagementSection domainId={domainId} />

                <CompetitorOverviewChart domainId={domainId} />

                <CompetitorPositionScatterChart domainId={domainId} />

                <CompetitorKeywordBarsChart domainId={domainId} />

                <CompetitorBacklinkRadarChart domainId={domainId} />

                <BacklinkQualityComparisonChart domainId={domainId} />

                <CompetitorBacklinksSection domainId={domainId} />

                <CompetitorContentAnalysisSection domainId={domainId} />

                <CompetitorKeywordGapTable domainId={domainId} />
              </div>
              </TabContentOrCTA>
              </ErrorBoundary>
            </TabPanel>

            {/* Keyword Analysis Tab */}
            <TabPanel id="keyword-analysis">
              <ErrorBoundary label="Keyword Analysis">
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <EzIcon name="analytics-up" size={22} color="#2563eb" strokeColor="#2563eb" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-primary mb-1">{t('keywordAnalysis')}</h2>
                    <p className="text-sm text-tertiary">
                      {t('deepDiveAnalysisDescription')}
                    </p>
                  </div>
                </div>

                <CompetitorAnalysisReportsSection domainId={domainId} />
              </div>
              </ErrorBoundary>
            </TabPanel>

            {/* On-Site Tab */}
            <TabPanel id="on-site">
              <ErrorBoundary label="On-Site">
              <TabContentOrCTA tabId="on-site" moduleReadiness={moduleReadiness} domainId={domainId}>
              <OnSiteSection domainId={domainId} />
              </TabContentOrCTA>
              </ErrorBoundary>
            </TabPanel>

            {/* Content Gaps Tab */}
            <TabPanel id="content-gaps">
              <ErrorBoundary label="Content Gaps">
              <TabContentOrCTA tabId="content-gaps" moduleReadiness={moduleReadiness} domainId={domainId}>
              <ContentGapSection domainId={domainId} />
              </TabContentOrCTA>
              </ErrorBoundary>
            </TabPanel>

            {/* Insights Tab */}
            <TabPanel id="insights">
              <ErrorBoundary label="Insights">
              <TabContentOrCTA tabId="insights" moduleReadiness={moduleReadiness} domainId={domainId}>
              <InsightsSection domainId={domainId} />
              </TabContentOrCTA>
              </ErrorBoundary>
            </TabPanel>

            {/* AI Research Tab */}
            <TabPanel id="ai-research">
              <ErrorBoundary label="AI Research">
              <TabContentOrCTA tabId="ai-research" moduleReadiness={moduleReadiness} domainId={domainId}>
              <AIKeywordResearchSection domainId={domainId} />
              </TabContentOrCTA>
              </ErrorBoundary>
            </TabPanel>

            {/* Strategy Tab */}
            <TabPanel id="strategy">
              <ErrorBoundary label="Strategy">
              <TabContentOrCTA tabId="strategy" moduleReadiness={moduleReadiness} domainId={domainId}>
              <StrategySection domainId={domainId} />
              </TabContentOrCTA>
              </ErrorBoundary>
            </TabPanel>

            {/* Generators Tab */}
            <TabPanel id="generators">
              <ErrorBoundary label="Generators">
              <GeneratorsSection domainId={domainId} />
              </ErrorBoundary>
            </TabPanel>

            {/* Alerts Tab */}
            <TabPanel id="alerts">
              <ErrorBoundary label="Alerts">
              <AlertsSection domainId={domainId} />
              </ErrorBoundary>
            </TabPanel>

            {/* Settings Tab */}
            <TabPanel id="settings">
              <ErrorBoundary label="Settings">
              <div className="flex flex-col gap-6">
                <div className="relative rounded-xl border border-secondary bg-primary p-6">
                  <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
                  <h2 className="text-lg font-semibold text-primary">{t('settings')}</h2>

                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-secondary">{t('searchEngine')}</p>
                      <p className="text-sm text-primary">{domain.settings.searchEngine}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-secondary">{t('refreshFrequency')}</p>
                      <BadgeWithDot size="sm" color="gray" type="modern">
                        {domain.settings.refreshFrequency}
                      </BadgeWithDot>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-secondary">{t('location')}</p>
                      <p className="text-sm text-primary">{getCountryFlag(domain.settings.location)} {domain.settings.location}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-secondary">{t('language')}</p>
                      <p className="text-sm text-primary">{getLanguageFlag(domain.settings.language)} {domain.settings.language}</p>
                    </div>
                  </div>
                </div>

                <GscPropertySection domainId={domainId} />

                <BusinessContextSection domainId={domainId} domain={domain} />

                <DomainLimitsSection domainId={domainId} currentLimits={domain.limits} />
              </div>
              </ErrorBoundary>
            </TabPanel>

            {/* Diagnostics Tab (superAdmin only) */}
            {isSuperAdmin && (
              <TabPanel id="diagnostics">
                <ErrorBoundary label="Diagnostics">
                <DiagnosticSection domainId={domainId} />
                </ErrorBoundary>
              </TabPanel>
            )}
            </div>
          </div>
        </Tabs>
      </div>

      {/* Edit Domain Modal */}
      <ModalOverlay isOpen={isEditModalOpen} onOpenChange={setIsEditModalOpen} isDismissable>
        <Modal>
          <Dialog className="overflow-hidden">
            <div className="relative w-full overflow-hidden rounded-xl bg-primary dark:bg-[#0d0f13] dark:border dark:border-neutral-800 shadow-xl sm:max-w-160">
              <CloseButton
                onClick={() => setIsEditModalOpen(false)}
                theme="light"
                size="lg"
                className="absolute top-3 right-3 z-10"
              />

              <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                <div className="relative w-max max-sm:hidden">
                  <FeaturedIcon color="gray" size="lg" theme="modern" icon={Settings01} />
                  <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>

                <div className="z-10 flex flex-col gap-0.5">
                  <AriaHeading slot="title" className="text-md font-semibold text-primary">
                    {t('editDomainSettingsModal')}
                  </AriaHeading>
                  <p className="text-sm text-tertiary">{t('updateSearchSettings', { domain: domain.domain })}</p>
                </div>
              </div>

              <form onSubmit={handleEditSubmit} className="flex flex-col gap-5 px-4 pb-6 pt-5 sm:px-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      {t('project')}
                    </label>
                    <select
                      value={editForm.projectId}
                      onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value as Id<"projects"> })}
                      className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                    >
                      {projects?.map((project) => (
                        <option key={project._id} value={project._id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      {t('tags')}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        size="md"
                        value={newTagInput}
                        onChange={(value) => setNewTagInput(value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder={t('addATag')}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        color="secondary"
                        size="md"
                        iconLeading={Plus}
                        onClick={handleAddTag}
                      >
                        {t('add')}
                      </Button>
                    </div>
                    {editForm.tags.length > 0 && (
                      <div className="mt-3">
                        <TagGroup
                          label="Domain tags"
                          size="md"
                          onRemove={handleRemoveTag}
                        >
                          <TagList className="flex flex-wrap gap-2" items={editForm.tags}>
                            {(item) => <Tag {...item}>{item.label}</Tag>}
                          </TagList>
                        </TagGroup>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      {t('refreshFrequency')}
                    </label>
                    <select
                      value={editForm.refreshFrequency}
                      onChange={(e) => setEditForm({ ...editForm, refreshFrequency: e.target.value })}
                      className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                    >
                      <option value="daily">{t('daily')}</option>
                      <option value="weekly">{t('weekly')}</option>
                      <option value="on_demand">{t('onDemand')}</option>
                    </select>
                  </div>

                  <Input
                    label={t('searchEngine')}
                    size="md"
                    value={editForm.searchEngine}
                    onChange={(value) => setEditForm({ ...editForm, searchEngine: value })}
                    placeholder="google.pl"
                    className="sm:col-span-1"
                  />

                  <Input
                    label={t('location')}
                    size="md"
                    value={editForm.location}
                    onChange={(value) => setEditForm({ ...editForm, location: value })}
                    placeholder="Poland"
                    className="sm:col-span-1"
                  />

                  <Input
                    label={t('language')}
                    size="md"
                    value={editForm.language}
                    onChange={(value) => setEditForm({ ...editForm, language: value })}
                    placeholder="pl"
                    className="sm:col-span-2"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-secondary pt-5">
                  <Button type="button" color="secondary" size="lg" onClick={() => setIsEditModalOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit" color="primary" size="lg" iconLeading={Save01}>
                    {t('saveChanges')}
                  </Button>
                </div>
              </form>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>

      {/* Add Keywords Modal */}
      <AddKeywordsModal
        domainId={domainId}
        isOpen={isAddKeywordsModalOpen}
        onClose={() => setIsAddKeywordsModalOpen(false)}
      />

      {/* Generate Report Modal */}
      {domain && (
        <GenerateReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          domainId={domainId}
          domainName={domain.domain}
        />
      )}

      {/* Domain Setup Wizard */}
      <DomainSetupWizard
        domainId={domainId}
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </main>
  );
}
