/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as backlinks from "../backlinks.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dataforseo from "../dataforseo.js";
import type * as domains from "../domains.js";
import type * as generatedReports from "../generatedReports.js";
import type * as http from "../http.js";
import type * as keywordCheckJobs from "../keywordCheckJobs.js";
import type * as keywords from "../keywords.js";
import type * as limits from "../limits.js";
import type * as logs from "../logs.js";
import type * as messages from "../messages.js";
import type * as onsite from "../onsite.js";
import type * as organizations from "../organizations.js";
import type * as permissions from "../permissions.js";
import type * as projects from "../projects.js";
import type * as proposals from "../proposals.js";
import type * as reports from "../reports.js";
import type * as scheduler from "../scheduler.js";
import type * as seranking from "../seranking.js";
import type * as teams from "../teams.js";
import type * as userSettings from "../userSettings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  backlinks: typeof backlinks;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dataforseo: typeof dataforseo;
  domains: typeof domains;
  generatedReports: typeof generatedReports;
  http: typeof http;
  keywordCheckJobs: typeof keywordCheckJobs;
  keywords: typeof keywords;
  limits: typeof limits;
  logs: typeof logs;
  messages: typeof messages;
  onsite: typeof onsite;
  organizations: typeof organizations;
  permissions: typeof permissions;
  projects: typeof projects;
  proposals: typeof proposals;
  reports: typeof reports;
  scheduler: typeof scheduler;
  seranking: typeof seranking;
  teams: typeof teams;
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
