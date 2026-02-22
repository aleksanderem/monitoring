# R13: Custom Alert Rules — Design Document

## Overview

Custom Alert Rules allow users to define automated monitoring conditions for their domains. When conditions are met, the system creates alert events and sends in-app notifications (with optional email). This replaces passive anomaly detection with user-configured, actionable alerts.

## Alert Rule Types

### 1. Position Drop
Triggers when a keyword's position drops by more than X positions compared to its previous position.
- Condition: `currentPosition - previousPosition > threshold` (where both exist)
- Default threshold: 10 positions
- Data source: `keywords.currentPosition`, `keywords.previousPosition`

### 2. Keyword Exits Top N
Triggers when a keyword that was previously in the top N falls out.
- Condition: `previousPosition <= N && (currentPosition > N || currentPosition === null)`
- Configurable N values: 3, 10, 20, 50, 100
- Default: top 10
- Data source: `keywords.currentPosition`, `keywords.previousPosition`

### 3. New Competitor Detected
Triggers when a new competitor domain appears in SERP results for tracked keywords.
- Condition: A domain appears in today's SERP results that wasn't in yesterday's
- Data source: `keywordSerpResults` table (compare dates)
- Note: Only checks top 10 SERP positions to limit noise

### 4. Backlink Lost
Triggers when the domain loses more than X backlinks in a day.
- Condition: `lostBacklinks > threshold`
- Default threshold: 5 backlinks
- Data source: `backlinkVelocityHistory` table (latest entry)

### 5. Visibility Score Drop
Triggers when the domain's visibility (ETV or keyword count) drops by more than X%.
- Condition: `(previous - current) / previous * 100 > threshold`
- Default threshold: 20%
- Data source: `domainVisibilityHistory` table (compare last 2 entries)

## Data Model

### alertRules table
```
alertRules {
  domainId: Id<"domains">
  name: string                    // User-friendly name
  ruleType: "position_drop" | "top_n_exit" | "new_competitor" | "backlink_lost" | "visibility_drop"
  isActive: boolean
  threshold: number               // Type-specific threshold value
  topN: optional number           // Only for top_n_exit type (3, 10, 20, 50, 100)
  cooldownMinutes: number         // Min minutes between re-alerts (default 1440 = 24h)
  notifyVia: ["in_app"] | ["in_app", "email"]
  lastTriggeredAt: optional number
  createdBy: Id<"users">
  createdAt: number
  updatedAt: number
}
Indexes: by_domain, by_domain_active (domainId, isActive), by_domain_type (domainId, ruleType)
```

### alertEvents table
```
alertEvents {
  ruleId: Id<"alertRules">
  domainId: Id<"domains">
  ruleType: string                // Denormalized for filtering
  triggeredAt: number
  data: object {                  // Type-specific payload
    keywordId?: Id<"keywords">
    keywordPhrase?: string
    previousValue?: number
    currentValue?: number
    competitorDomain?: string
    details?: string
  }
  status: "active" | "acknowledged"
  acknowledgedAt: optional number
  acknowledgedBy: optional Id<"users">
}
Indexes: by_domain (domainId), by_rule (ruleId), by_domain_status (domainId, status)
```

## Evaluation Engine

A daily cron job (`evaluate-alert-rules`) runs at 4 AM UTC (after anomaly detection at 3 AM). For each domain with active rules:

1. Fetch all active rules for the domain
2. For each rule, call the appropriate evaluator function
3. If triggered and cooldown period has passed, create alertEvent + notification
4. Update `lastTriggeredAt` on the rule

Each evaluator is a pure function: `(rule, data) => { triggered: boolean, data: object } | null`

## Deduplication & Cooldown

- Each rule has a `cooldownMinutes` field (default 1440 = 24 hours)
- Before creating an event, check if `lastTriggeredAt + cooldownMinutes * 60000 > Date.now()`
- If within cooldown, skip (don't create duplicate alert)

## Notification Delivery

- In-app: Create entry in existing `notifications` table for all team members of the domain
- Email: Use existing `sendEmail.send` internal action (Resend) — optional per rule

## Default Rules

When a domain is created, auto-create these rules (all active):
1. Position drop > 10 positions
2. Keyword exits top 10
3. Backlink lost > 5
4. Visibility drop > 20%

New competitor detection is NOT auto-created (requires SERP data to be populated first).

## UI

### Alert Rules Manager (domain settings tab or dedicated "Alerts" tab)
- List of rules with toggle (active/inactive)
- Create/edit dialog with rule type selector, threshold input, cooldown config
- Delete confirmation

### Alert History Section
- Table of triggered alerts, sorted by date desc
- Filterable by type, status (active/acknowledged)
- "Acknowledge" button per alert
- "Acknowledge All" bulk action

## Permissions

Uses existing `domains.edit` permission for managing alert rules.
Uses existing `domains.view` permission for viewing alert history.
