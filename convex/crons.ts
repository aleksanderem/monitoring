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

// Send daily digest emails every day at 8 AM UTC
crons.daily(
  "send-daily-digests",
  { hourUTC: 8, minuteUTC: 0 },
  internal.scheduler.triggerDailyDigests
);

// Send weekly reports every Monday at 9 AM UTC
crons.weekly(
  "send-weekly-reports",
  { dayOfWeek: "monday", hourUTC: 9, minuteUTC: 0 },
  internal.scheduler.triggerWeeklyReports
);

// Calculate backlink velocity daily at 2 AM UTC (after backlink refresh)
crons.daily(
  "calculate-backlink-velocity",
  { hourUTC: 2, minuteUTC: 0 },
  internal.scheduler.calculateDailyBacklinkVelocity
);

// Detect anomalies daily at 3 AM UTC (after backlink velocity calculation)
crons.daily(
  "detect-anomalies-daily",
  { hourUTC: 3, minuteUTC: 0 },
  internal.scheduler.detectAnomaliesDaily
);

// Analyze content gaps weekly on Sundays at 4 AM UTC
crons.weekly(
  "analyze-content-gaps-weekly",
  { dayOfWeek: "sunday", hourUTC: 4, minuteUTC: 0 },
  internal.scheduler.analyzeContentGapsWeekly
);

// Evaluate custom alert rules daily at 4 AM UTC (after anomaly detection)
crons.daily(
  "evaluate-alert-rules-daily",
  { hourUTC: 4, minuteUTC: 30 },
  internal.alertEvaluation.evaluateAlertRules
);

// Check grace periods for past_due subscriptions daily at 5 AM UTC
crons.daily(
  "check-grace-periods",
  { hourUTC: 5, minuteUTC: 0 },
  internal.stripe_helpers.checkGracePeriods
);

// Send trial reminder emails daily at 7 AM UTC
crons.daily(
  "check-trial-reminders",
  { hourUTC: 7, minuteUTC: 0 },
  internal.stripe_helpers.checkTrialReminders
);

export default crons;
