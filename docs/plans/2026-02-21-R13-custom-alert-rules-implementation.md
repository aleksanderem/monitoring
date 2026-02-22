# R13: Custom Alert Rules — Implementation Plan

## Task 1: Schema — alertRules and alertEvents tables
File: `convex/schema.ts`
- Add `alertRules` table with indexes: by_domain, by_domain_active, by_domain_type
- Add `alertEvents` table with indexes: by_domain, by_rule, by_domain_status

## Task 2: Add "alerts" permission
File: `convex/permissions.ts`
- Add `"alerts.view"` and `"alerts.manage"` permissions
- Add to PERMISSION_CATEGORIES
- Add to SYSTEM_ROLE_PERMISSIONS (member gets both, viewer gets view)
- Add to MODULE_PERMISSIONS under positioning module

## Task 3: CRUD mutations for alert rules
File: `convex/alertRules.ts`
- `createAlertRule` mutation (requires domains.edit permission)
- `updateAlertRule` mutation
- `deleteAlertRule` mutation
- `toggleAlertRule` mutation (active/inactive)
- `acknowledgeAlertEvent` mutation
- `acknowledgeAllAlertEvents` mutation

## Task 4: Alert rule queries
File: `convex/alertRules.ts`
- `getAlertRulesByDomain` query
- `getAlertEventsByDomain` query (with pagination)
- `getAlertEventsByRule` query
- `getUnacknowledgedAlertCount` query

## Task 5: Alert evaluation engine
File: `convex/alertEvaluation.ts`
- `evaluateAlertRules` internalAction (called by cron)
- For each domain: fetch active rules, evaluate, create events
- `createAlertEventAndNotify` internalMutation
- Helper queries for fetching evaluation data

## Task 6: Position drop evaluator
File: `convex/alertEvaluators.ts`
- Pure function: checks all keywords for position drops exceeding threshold
- Returns array of triggered keywords with details

## Task 7: Top N exit evaluator
File: `convex/alertEvaluators.ts`
- Pure function: checks all keywords that exited top N
- Returns array of triggered keywords

## Task 8: New competitor evaluator
File: `convex/alertEvaluators.ts`
- Pure function: compares latest SERP results with previous day
- Returns array of new competitor domains

## Task 9: Backlink lost evaluator
File: `convex/alertEvaluators.ts`
- Pure function: checks backlink velocity for lost count exceeding threshold
- Returns triggered or not with count

## Task 10: Visibility drop evaluator
File: `convex/alertEvaluators.ts`
- Pure function: compares last 2 visibility history entries
- Returns triggered or not with percentage

## Task 11: Cron job registration
File: `convex/crons.ts`
- Add daily cron at 4 AM UTC: `evaluate-alert-rules-daily`

## Task 12: Default rules on domain creation
File: `convex/domains.ts` (modify existing create mutation)
- After domain creation, insert 4 default alert rules

## Task 13: Alert Rules Manager UI
File: `src/components/domain/sections/AlertRulesSection.tsx`
- List of rules with active toggle
- Create/Edit dialog
- Delete confirmation
- Add as new tab or section in domain page

## Task 14: Alert History UI
File: `src/components/domain/sections/AlertHistorySection.tsx`
- Table of alert events
- Filter by type and status
- Acknowledge button
- Acknowledge all button

## Task 15: Integration into domain page
File: `src/app/(dashboard)/domains/[domainId]/page.tsx`
- Add "Alerts" tab to MODULE_TABS and domain page
- Import and render AlertRulesSection and AlertHistorySection

## Task 16: Translations
File: `messages/en.json`, `messages/pl.json`
- Add translation keys for all alert-related UI text

## Task 17: Tests
File: `convex/alertRules.test.ts`, `convex/alertEvaluators.test.ts`
- Unit tests for evaluator functions
- Integration tests for CRUD mutations
- Test cooldown deduplication logic

## Execution Order
1. Tasks 1-2 (schema + permissions) — foundation
2. Tasks 3-4 (CRUD + queries) — data layer
3. Tasks 5-10 (evaluation engine + evaluators) — core logic
4. Task 11 (cron) — automation
5. Task 12 (default rules) — domain creation hook
6. Tasks 13-16 (UI + translations) — frontend
7. Task 17 (tests) — validation
