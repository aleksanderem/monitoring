/**
 * Predefined product tour definitions.
 * These are constants — the tour structure lives in the frontend,
 * only progress is persisted to the DB.
 */

export interface TourStepDef {
  id: string;
  target: string; // CSS selector
  title: string; // translation key
  content: string; // translation key
  placement: "top" | "bottom" | "left" | "right";
}

export interface TourDef {
  id: string;
  nameKey: string; // translation key
  steps: TourStepDef[];
}

export const TOUR_GETTING_STARTED: TourDef = {
  id: "getting-started",
  nameKey: "help.tourGettingStarted",
  steps: [
    {
      id: "welcome",
      target: "[data-tour='dashboard']",
      title: "help.tourWelcomeTitle",
      content: "help.tourWelcomeContent",
      placement: "bottom",
    },
    {
      id: "add-domain",
      target: "[data-tour='add-domain']",
      title: "help.tourAddDomainTitle",
      content: "help.tourAddDomainContent",
      placement: "bottom",
    },
    {
      id: "add-keywords",
      target: "[data-tour='add-keywords']",
      title: "help.tourAddKeywordsTitle",
      content: "help.tourAddKeywordsContent",
      placement: "right",
    },
    {
      id: "view-positions",
      target: "[data-tour='positions-table']",
      title: "help.tourViewPositionsTitle",
      content: "help.tourViewPositionsContent",
      placement: "top",
    },
    {
      id: "check-competitors",
      target: "[data-tour='competitors-tab']",
      title: "help.tourCheckCompetitorsTitle",
      content: "help.tourCheckCompetitorsContent",
      placement: "bottom",
    },
  ],
};

export const TOUR_REPORTS: TourDef = {
  id: "reports-tour",
  nameKey: "help.tourReports",
  steps: [
    {
      id: "navigate-reports",
      target: "[data-tour='reports-nav']",
      title: "help.tourReportsNavTitle",
      content: "help.tourReportsNavContent",
      placement: "right",
    },
    {
      id: "generate-report",
      target: "[data-tour='generate-report']",
      title: "help.tourGenerateReportTitle",
      content: "help.tourGenerateReportContent",
      placement: "bottom",
    },
    {
      id: "customize-report",
      target: "[data-tour='report-settings']",
      title: "help.tourCustomizeReportTitle",
      content: "help.tourCustomizeReportContent",
      placement: "left",
    },
    {
      id: "export-report",
      target: "[data-tour='export-report']",
      title: "help.tourExportReportTitle",
      content: "help.tourExportReportContent",
      placement: "bottom",
    },
  ],
};

export const TOUR_SETTINGS: TourDef = {
  id: "settings-tour",
  nameKey: "help.tourSettings",
  steps: [
    {
      id: "org-settings",
      target: "[data-tour='org-settings']",
      title: "help.tourOrgSettingsTitle",
      content: "help.tourOrgSettingsContent",
      placement: "right",
    },
    {
      id: "branding",
      target: "[data-tour='branding-tab']",
      title: "help.tourBrandingTitle",
      content: "help.tourBrandingContent",
      placement: "bottom",
    },
    {
      id: "team",
      target: "[data-tour='team-tab']",
      title: "help.tourTeamTitle",
      content: "help.tourTeamContent",
      placement: "bottom",
    },
    {
      id: "notifications",
      target: "[data-tour='notifications-tab']",
      title: "help.tourNotificationsTitle",
      content: "help.tourNotificationsContent",
      placement: "bottom",
    },
  ],
};

export const ALL_TOURS: TourDef[] = [
  TOUR_GETTING_STARTED,
  TOUR_REPORTS,
  TOUR_SETTINGS,
];

export function getTourById(tourId: string): TourDef | undefined {
  return ALL_TOURS.find((t) => t.id === tourId);
}
