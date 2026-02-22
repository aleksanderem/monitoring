# Batch 7 Implementation Plan — Final 5 Roadmap Items

> Implements R23, R27, R30, R31, R32 in parallel worktree agents.

## R23: White-Label & Agency Features
- New `convex/agency.ts`: agency account CRUD, client org creation, branding overrides
- New schema tables: `agencyClients` (agency→client org mapping), `brandingOverrides` (per-client branding)
- New `src/components/settings/WhiteLabelTab.tsx`: agency branding config
- New `src/components/agency/ClientManagement.tsx`: manage client orgs
- EN/PL/DE/ES/FR translations
- 15+ integration tests

## R27: Webhooks & Integrations
- New `convex/webhooks.ts`: webhook CRUD, event delivery with retry, event log
- New schema tables: `webhookEndpoints`, `webhookDeliveries`
- New `src/components/settings/WebhooksTab.tsx`: webhook management UI
- New `src/components/settings/IntegrationsPanel.tsx`: Slack/Zapier connection UI
- EN/PL/DE/ES/FR translations
- 15+ integration tests

## R30: Custom Dashboards & Saved Views
- New `convex/dashboards.ts`: dashboard layout CRUD, widget configs
- New `convex/savedViews.ts`: filter preset save/load
- New schema tables: `dashboardLayouts`, `savedViews`
- New `src/components/dashboard/DashboardBuilder.tsx`: layout customization
- New `src/components/dashboard/SavedViewsPanel.tsx`: preset manager
- EN/PL/DE/ES/FR translations
- 15+ integration tests

## R31: Scheduled Report Delivery
- New `convex/scheduledReports.ts`: schedule CRUD, execution trigger
- New schema table: `reportSchedules` (domainId, frequency, reportType, recipients)
- Cron job integration for weekly/monthly report generation
- New `src/components/reports/ScheduleManager.tsx`: schedule config UI
- Wire to existing R09 AI report engine + R08 email system
- EN/PL/DE/ES/FR translations
- 15+ integration tests

## R32: Advanced Onboarding & Knowledge Base
- New `convex/tours.ts`: tour step definitions, completion tracking
- New `convex/knowledgeBase.ts`: KB articles, search
- New schema tables: `tourProgress`, `kbArticles`
- New `src/components/tours/ProductTour.tsx`: interactive tour overlay
- New `src/components/help/KnowledgeBase.tsx`: searchable help center
- New `src/app/(public)/help/page.tsx`: public help center page
- EN/PL/DE/ES/FR translations
- 15+ integration tests
