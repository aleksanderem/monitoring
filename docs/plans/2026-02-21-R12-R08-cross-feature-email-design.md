# R12 + R08 Phases 1-2: Cross-Feature Flows & Email Notifications — Design

## Problem Statement

R12: Keywords discovered in content gap analysis and competitor tables have "Add to Monitoring" buttons that are stubs (console.log or toast). Users can discover keywords but can't act on them without manually navigating to add them. The SERPFeaturesBadges component is disabled despite backend support being ready.

R08 Phases 1-2: The email notification system has infrastructure (Resend, notification preferences, cron stubs) but most emails aren't sent. Daily digests, weekly reports, and alert emails are not implemented despite the data and scheduling infrastructure existing.

## Current State Analysis

### R12 Gaps

| Surface | Single-row "Add" | Bulk "Add" | Already-monitored indicator | First position check |
|---|---|---|---|---|
| AllKeywordsTable | TODO/console.log | Not present | Button shown, click is no-op | Not triggered |
| CompetitorKeywordGapTable | TODO/toast | Wired (addKeywords) | Not shown | Not triggered |
| DiscoveredKeywordsTable | Wired (addKeyword) | Wired (addKeywords) | Yes (toggle button) | Not triggered |
| QuickWinsTable | Wired (addKeywords) | Wired (addKeywords) | Not shown | Not triggered |
| SERPFeaturesBadges | n/a | n/a | n/a | Disabled (.tsx.disabled) |

Reference implementation: `DiscoveredKeywordsTable.tsx` has the correct pattern.

### R08 Gaps

Phase 1 (Digest/Report):
- `triggerDailyDigests` and `triggerWeeklyReports` are empty stubs in scheduler.ts
- Cron entries are commented out in crons.ts
- No email templates exist for digest or report
- userNotificationPreferences table has fields but is never queried by senders

Phase 2 (Alert Emails):
- alertEvaluation.ts creates in-app notifications but no emails
- alertRules.notifyVia field supports "email" but is never read
- No alert email templates exist

## Proposed Solution

### R12: 4 Targeted Fixes

1. AllKeywordsTable: Wire handleAddToMonitoring to useMutation(api.keywords.addKeyword)
2. CompetitorKeywordGapTable: Wire per-row Plus button to addKeywords mutation
3. Auto-trigger first position check: Frontend calls refreshKeywordPositions after add succeeds
4. SERPFeaturesBadges: Rename .disabled → .tsx, import into KeywordMonitoringTable

### R08 Phase 1: Daily Digest + Weekly Report

New internal query functions:
- getDailyDigestData(domainId): top 5 gainers, top 5 losers, avg position, visibility
- getWeeklyReportData(domainId): week-over-week summary, visibility trend, keyword/competitor counts

New email templates:
- sendDailyDigest(email, domainName, data)
- sendWeeklyReport(email, domainName, data)

Scheduler logic:
- Query all active orgs → domains → team members
- Check userNotificationPreferences for opt-in
- Send emails, log to notificationLogs
- Uncomment cron entries

### R08 Phase 2: Alert Emails

Wire into existing createAlertEventAndNotify:
- Check rule.notifyVia for "email"
- Fetch team member emails
- Call appropriate template

5 new email templates:
- sendPositionDropAlert
- sendTopNExitAlert
- sendNewCompetitorAlert
- sendBacklinkLostAlert
- sendVisibilityDropAlert

## Data Model Changes

No new tables needed. Existing tables used:
- notificationLogs: write entries for all new emails
- userNotificationPreferences: read for opt-in checks
- alertRules: read notifyVia field (already exists)

## Security Considerations

- All email functions are internal actions (not callable from client)
- Preference checks prevent unwanted emails
- notificationLogs creates audit trail
- Alert emails only sent to team members of the domain's organization

## Test Strategy

- R12: Frontend data-flow tests for table mutation wiring (verify correct args)
- R08 Phase 1: Convex tests for digest/report data gathering + preference filtering
- R08 Phase 2: Integration tests for alert email delivery path
- E2E: Extend real-email-delivery.test.ts with new templates
