// ─── Report Section Registry ────────────────────────────────────
// Central registry of all report sections and their sub-elements.
// Used by both the modal editor UI and the PDF renderer.

export type ReportProfile = "quick" | "standard" | "full" | "custom";

export interface SubElementDef {
  id: string;
  labelKey: string;
}

export interface SectionDef {
  id: string;
  labelKey: string;
  subElements: SubElementDef[];
}

export const SECTION_REGISTRY: SectionDef[] = [
  {
    id: "executive",
    labelKey: "sectionExecutive",
    subElements: [
      { id: "healthBreakdown", labelKey: "subHealthBreakdown" },
      { id: "keyMetrics", labelKey: "subKeyMetrics" },
    ],
  },
  {
    id: "keywords",
    labelKey: "sectionKeywords",
    subElements: [
      { id: "positionDistribution", labelKey: "subPositionDistribution" },
      { id: "movement", labelKey: "subMovement" },
      { id: "topGainers", labelKey: "subTopGainers" },
      { id: "topLosers", labelKey: "subTopLosers" },
      { id: "nearPage1", labelKey: "subNearPage1" },
    ],
  },
  {
    id: "backlinks",
    labelKey: "sectionBacklinks",
    subElements: [
      { id: "summary", labelKey: "subSummary" },
      { id: "anchorDistribution", labelKey: "subAnchorDistribution" },
      { id: "toxicLinks", labelKey: "subToxicLinks" },
    ],
  },
  {
    id: "contentGaps",
    labelKey: "sectionContentGaps",
    subElements: [
      { id: "gapSummary", labelKey: "subGapSummary" },
      { id: "topOpportunities", labelKey: "subTopOpportunities" },
      { id: "competitorList", labelKey: "subCompetitorList" },
    ],
  },
  {
    id: "onsite",
    labelKey: "sectionOnsite",
    subElements: [
      { id: "healthMetrics", labelKey: "subHealthMetrics" },
      { id: "issueDistribution", labelKey: "subIssueDistribution" },
      { id: "coreWebVitals", labelKey: "subCoreWebVitals" },
      { id: "criticalIssues", labelKey: "subCriticalIssues" },
    ],
  },
  {
    id: "linkBuilding",
    labelKey: "sectionLinkBuilding",
    subElements: [
      { id: "prospectMetrics", labelKey: "subProspectMetrics" },
      { id: "byChannel", labelKey: "subByChannel" },
      { id: "topProspects", labelKey: "subTopProspects" },
    ],
  },
  {
    id: "recommendations",
    labelKey: "sectionRecommendations",
    subElements: [],
  },
];

export interface ReportSectionConfig {
  id: string;
  enabled: boolean;
  subElements?: Record<string, boolean>;
}

export interface ReportConfig {
  sections: ReportSectionConfig[];
}

export const PRESET_PROFILES: Record<Exclude<ReportProfile, "custom">, { sectionIds: string[] }> = {
  quick: { sectionIds: ["executive"] },
  standard: { sectionIds: ["executive", "keywords", "backlinks", "contentGaps"] },
  full: { sectionIds: ["executive", "keywords", "backlinks", "contentGaps", "onsite", "linkBuilding", "recommendations"] },
};

export function configFromPreset(profile: Exclude<ReportProfile, "custom">): ReportConfig {
  const preset = PRESET_PROFILES[profile];
  return {
    sections: SECTION_REGISTRY.map((sec) => ({
      id: sec.id,
      enabled: preset.sectionIds.includes(sec.id),
    })),
  };
}

export function resolveConfig(config: ReportConfig): {
  orderedSections: string[];
  enabledSections: Set<string>;
  subElements: Record<string, Record<string, boolean>>;
} {
  const orderedSections: string[] = [];
  const enabledSections = new Set<string>();
  const subElements: Record<string, Record<string, boolean>> = {};

  // Cover and ToC are always included
  enabledSections.add("cover");
  enabledSections.add("toc");

  for (const sec of config.sections) {
    orderedSections.push(sec.id);
    if (sec.enabled) {
      enabledSections.add(sec.id);
    }
    if (sec.subElements) {
      subElements[sec.id] = sec.subElements;
    }
  }

  return { orderedSections, enabledSections, subElements };
}
