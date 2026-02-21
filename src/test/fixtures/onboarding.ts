/**
 * Test fixtures for onboarding-related data.
 * Shapes match api.onboarding.getOnboardingStatus return type.
 */

export const ONBOARDING_FRESH = {
  isCompleted: false,
  isDismissed: false,
  steps: {
    businessContextSet: false,
    keywordsDiscovered: false,
    keywordsMonitored: false,
    serpChecked: false,
    competitorsAdded: false,
    analysisComplete: false,
  },
  counts: {
    discoveredKeywords: 0,
    monitoredKeywords: 0,
    activeCompetitors: 0,
    contentGaps: 0,
  },
};

export const ONBOARDING_IN_PROGRESS = {
  isCompleted: false,
  isDismissed: false,
  steps: {
    businessContextSet: true,
    keywordsDiscovered: true,
    keywordsMonitored: true,
    serpChecked: false,
    competitorsAdded: false,
    analysisComplete: false,
  },
  counts: {
    discoveredKeywords: 25,
    monitoredKeywords: 10,
    activeCompetitors: 0,
    contentGaps: 0,
  },
};

export const ONBOARDING_COMPLETED = {
  isCompleted: true,
  isDismissed: false,
  steps: {
    businessContextSet: true,
    keywordsDiscovered: true,
    keywordsMonitored: true,
    serpChecked: true,
    competitorsAdded: true,
    analysisComplete: true,
  },
  counts: {
    discoveredKeywords: 45,
    monitoredKeywords: 30,
    activeCompetitors: 3,
    contentGaps: 12,
  },
};

export const ONBOARDING_DISMISSED = {
  isCompleted: false,
  isDismissed: true,
  steps: {
    businessContextSet: true,
    keywordsDiscovered: false,
    keywordsMonitored: false,
    serpChecked: false,
    competitorsAdded: false,
    analysisComplete: false,
  },
  counts: {
    discoveredKeywords: 0,
    monitoredKeywords: 0,
    activeCompetitors: 0,
    contentGaps: 0,
  },
};
