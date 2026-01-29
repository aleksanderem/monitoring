import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily refresh at 6 AM UTC
crons.daily(
  "daily-keyword-refresh",
  { hourUTC: 6, minuteUTC: 0 },
  internal.scheduler.refreshDailyDomains
);

// Run weekly refresh on Mondays at 7 AM UTC
crons.weekly(
  "weekly-keyword-refresh",
  { dayOfWeek: "monday", hourUTC: 7, minuteUTC: 0 },
  internal.scheduler.refreshWeeklyDomains
);

// Send daily digest emails every day at 8 AM UTC (commented out until email service is fully configured)
// crons.daily(
//   "send-daily-digests",
//   { hourUTC: 8, minuteUTC: 0 },
//   internal.scheduler.triggerDailyDigests
// );

// Send weekly reports every Monday at 9 AM UTC (commented out until email service is fully configured)
// crons.weekly(
//   "send-weekly-reports",
//   { dayOfWeek: "monday", hourUTC: 9, minuteUTC: 0 },
//   internal.scheduler.triggerWeeklyReports
// );

// Cleanup stuck keyword check jobs every 5 minutes
crons.interval(
  "cleanup-stuck-jobs",
  { minutes: 5 },
  internal.keywordCheckJobs.cleanupStuckJobs
);

export default crons;
