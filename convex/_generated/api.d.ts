/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_aiBusinessContext from "../actions/aiBusinessContext.js";
import type * as actions_aiCompetitorSearch from "../actions/aiCompetitorSearch.js";
import type * as actions_aiKeywordResearch from "../actions/aiKeywordResearch.js";
import type * as actions_aiProvider from "../actions/aiProvider.js";
import type * as actions_aiSeoStrategist from "../actions/aiSeoStrategist.js";
import type * as actions_aiStrategy from "../actions/aiStrategy.js";
import type * as actions_dataforseoLocations from "../actions/dataforseoLocations.js";
import type * as actions_generateLlmsTxt from "../actions/generateLlmsTxt.js";
import type * as actions_generatePlatformInstructions from "../actions/generatePlatformInstructions.js";
import type * as actions_generateSchema from "../actions/generateSchema.js";
import type * as actions_scrapeHomepage from "../actions/scrapeHomepage.js";
import type * as actions_sendEmail from "../actions/sendEmail.js";
import type * as admin from "../admin.js";
import type * as analytics from "../analytics.js";
import type * as aiResearch from "../aiResearch.js";
import type * as aiStrategy from "../aiStrategy.js";
import type * as apiUsage from "../apiUsage.js";
import type * as auth from "../auth.js";
import type * as backfillSupabase from "../backfillSupabase.js";
import type * as backlinkAnalysis_queries from "../backlinkAnalysis_queries.js";
import type * as backlinkVelocity from "../backlinkVelocity.js";
import type * as backlinks from "../backlinks.js";
import type * as branding from "../branding.js";
import type * as calendarEvents from "../calendarEvents.js";
import type * as competitorAnalysis from "../competitorAnalysis.js";
import type * as competitorAnalysisReports from "../competitorAnalysisReports.js";
import type * as competitorBacklinksJobs from "../competitorBacklinksJobs.js";
import type * as competitorComparison_queries from "../competitorComparison_queries.js";
import type * as competitorContentGapJobs from "../competitorContentGapJobs.js";
import type * as competitorKeywordPositions_internal from "../competitorKeywordPositions_internal.js";
import type * as competitors from "../competitors.js";
import type * as competitors_actions from "../competitors_actions.js";
import type * as competitors_internal from "../competitors_internal.js";
import type * as contentGap from "../contentGap.js";
import type * as contentGaps_actions from "../contentGaps_actions.js";
import type * as contentGaps_internal from "../contentGaps_internal.js";
import type * as contentGaps_mutations from "../contentGaps_mutations.js";
import type * as contentGaps_queries from "../contentGaps_queries.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dataforseo from "../dataforseo.js";
import type * as dataforseoLocations from "../dataforseoLocations.js";
import type * as debugLog from "../debugLog.js";
import type * as diagnostic from "../diagnostic.js";
import type * as domainReports from "../domainReports.js";
import type * as domains from "../domains.js";
import type * as forecasts_actions from "../forecasts_actions.js";
import type * as forecasts_mutations from "../forecasts_mutations.js";
import type * as forecasts_queries from "../forecasts_queries.js";
import type * as generatedReports from "../generatedReports.js";
import type * as generators from "../generators.js";
import type * as http from "../http.js";
import type * as insights_queries from "../insights_queries.js";
import type * as jobs_queries from "../jobs_queries.js";
import type * as keywordCheckJobs from "../keywordCheckJobs.js";
import type * as keywordGroups_mutations from "../keywordGroups_mutations.js";
import type * as keywordGroups_queries from "../keywordGroups_queries.js";
import type * as keywordMap_mutations from "../keywordMap_mutations.js";
import type * as keywordMap_queries from "../keywordMap_queries.js";
import type * as keywordPositions_internal from "../keywordPositions_internal.js";
import type * as keywordSerpJobs from "../keywordSerpJobs.js";
import type * as keywords from "../keywords.js";
import type * as lib_analyticsHelpers from "../lib/analyticsHelpers.js";
import type * as lib_debugLogger from "../lib/debugLogger.js";
import type * as lib_diagnosticCore from "../lib/diagnosticCore.js";
import type * as lib_diagnosticCross from "../lib/diagnosticCross.js";
import type * as lib_diagnosticIndependent from "../lib/diagnosticIndependent.js";
import type * as lib_diagnosticTypes from "../lib/diagnosticTypes.js";
import type * as lib_keywordValidation from "../lib/keywordValidation.js";
import type * as lib_supabase from "../lib/supabase.js";
import type * as limits from "../limits.js";
import type * as linkBuilding_mutations from "../linkBuilding_mutations.js";
import type * as linkBuilding_queries from "../linkBuilding_queries.js";
import type * as logs from "../logs.js";
import type * as messages from "../messages.js";
import type * as migrations_cleanOldBacklinks from "../migrations/cleanOldBacklinks.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as onsite from "../onsite.js";
import type * as organizations from "../organizations.js";
import type * as pageScoring from "../pageScoring.js";
import type * as permissions from "../permissions.js";
import type * as plans from "../plans.js";
import type * as projectDashboard_queries from "../projectDashboard_queries.js";
import type * as projects from "../projects.js";
import type * as proposals from "../proposals.js";
import type * as queries_competitors from "../queries/competitors.js";
import type * as reports from "../reports.js";
import type * as scheduledReports from "../scheduledReports.js";
import type * as scheduler from "../scheduler.js";
import type * as seoAudit_actions from "../seoAudit_actions.js";
import type * as seoAudit_queries from "../seoAudit_queries.js";
import type * as seranking from "../seranking.js";
import type * as serpFeatures_mutations from "../serpFeatures_mutations.js";
import type * as serpFeatures_queries from "../serpFeatures_queries.js";
import type * as stripe from "../stripe.js";
import type * as stripe_helpers from "../stripe_helpers.js";
import type * as stripe_webhook from "../stripe_webhook.js";
import type * as teams from "../teams.js";
import type * as test_alternative from "../test_alternative.js";
import type * as test_detoksvip from "../test_detoksvip.js";
import type * as test_google_ads_api from "../test_google_ads_api.js";
import type * as userSettings from "../userSettings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/aiBusinessContext": typeof actions_aiBusinessContext;
  "actions/aiCompetitorSearch": typeof actions_aiCompetitorSearch;
  "actions/aiKeywordResearch": typeof actions_aiKeywordResearch;
  "actions/aiProvider": typeof actions_aiProvider;
  "actions/aiSeoStrategist": typeof actions_aiSeoStrategist;
  "actions/aiStrategy": typeof actions_aiStrategy;
  "actions/dataforseoLocations": typeof actions_dataforseoLocations;
  "actions/generateLlmsTxt": typeof actions_generateLlmsTxt;
  "actions/generatePlatformInstructions": typeof actions_generatePlatformInstructions;
  "actions/generateSchema": typeof actions_generateSchema;
  "actions/scrapeHomepage": typeof actions_scrapeHomepage;
  "actions/sendEmail": typeof actions_sendEmail;
  admin: typeof admin;
  analytics: typeof analytics;
  aiResearch: typeof aiResearch;
  aiStrategy: typeof aiStrategy;
  apiUsage: typeof apiUsage;
  auth: typeof auth;
  backfillSupabase: typeof backfillSupabase;
  backlinkAnalysis_queries: typeof backlinkAnalysis_queries;
  backlinkVelocity: typeof backlinkVelocity;
  backlinks: typeof backlinks;
  branding: typeof branding;
  calendarEvents: typeof calendarEvents;
  competitorAnalysis: typeof competitorAnalysis;
  competitorAnalysisReports: typeof competitorAnalysisReports;
  competitorBacklinksJobs: typeof competitorBacklinksJobs;
  competitorComparison_queries: typeof competitorComparison_queries;
  competitorContentGapJobs: typeof competitorContentGapJobs;
  competitorKeywordPositions_internal: typeof competitorKeywordPositions_internal;
  competitors: typeof competitors;
  competitors_actions: typeof competitors_actions;
  competitors_internal: typeof competitors_internal;
  contentGap: typeof contentGap;
  contentGaps_actions: typeof contentGaps_actions;
  contentGaps_internal: typeof contentGaps_internal;
  contentGaps_mutations: typeof contentGaps_mutations;
  contentGaps_queries: typeof contentGaps_queries;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dataforseo: typeof dataforseo;
  dataforseoLocations: typeof dataforseoLocations;
  debugLog: typeof debugLog;
  diagnostic: typeof diagnostic;
  domainReports: typeof domainReports;
  domains: typeof domains;
  forecasts_actions: typeof forecasts_actions;
  forecasts_mutations: typeof forecasts_mutations;
  forecasts_queries: typeof forecasts_queries;
  generatedReports: typeof generatedReports;
  generators: typeof generators;
  http: typeof http;
  insights_queries: typeof insights_queries;
  jobs_queries: typeof jobs_queries;
  keywordCheckJobs: typeof keywordCheckJobs;
  keywordGroups_mutations: typeof keywordGroups_mutations;
  keywordGroups_queries: typeof keywordGroups_queries;
  keywordMap_mutations: typeof keywordMap_mutations;
  keywordMap_queries: typeof keywordMap_queries;
  keywordPositions_internal: typeof keywordPositions_internal;
  keywordSerpJobs: typeof keywordSerpJobs;
  keywords: typeof keywords;
  "lib/analyticsHelpers": typeof lib_analyticsHelpers;
  "lib/debugLogger": typeof lib_debugLogger;
  "lib/diagnosticCore": typeof lib_diagnosticCore;
  "lib/diagnosticCross": typeof lib_diagnosticCross;
  "lib/diagnosticIndependent": typeof lib_diagnosticIndependent;
  "lib/diagnosticTypes": typeof lib_diagnosticTypes;
  "lib/keywordValidation": typeof lib_keywordValidation;
  "lib/supabase": typeof lib_supabase;
  limits: typeof limits;
  linkBuilding_mutations: typeof linkBuilding_mutations;
  linkBuilding_queries: typeof linkBuilding_queries;
  logs: typeof logs;
  messages: typeof messages;
  "migrations/cleanOldBacklinks": typeof migrations_cleanOldBacklinks;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  onsite: typeof onsite;
  organizations: typeof organizations;
  pageScoring: typeof pageScoring;
  permissions: typeof permissions;
  plans: typeof plans;
  projectDashboard_queries: typeof projectDashboard_queries;
  projects: typeof projects;
  proposals: typeof proposals;
  "queries/competitors": typeof queries_competitors;
  reports: typeof reports;
  scheduledReports: typeof scheduledReports;
  scheduler: typeof scheduler;
  seoAudit_actions: typeof seoAudit_actions;
  seoAudit_queries: typeof seoAudit_queries;
  seranking: typeof seranking;
  serpFeatures_mutations: typeof serpFeatures_mutations;
  serpFeatures_queries: typeof serpFeatures_queries;
  stripe: typeof stripe;
  stripe_helpers: typeof stripe_helpers;
  stripe_webhook: typeof stripe_webhook;
  teams: typeof teams;
  test_alternative: typeof test_alternative;
  test_detoksvip: typeof test_detoksvip;
  test_google_ads_api: typeof test_google_ads_api;
  userSettings: typeof userSettings;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
