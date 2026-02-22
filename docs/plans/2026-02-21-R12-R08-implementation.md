# R12 + R08 Phases 1-2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete R12 (cross-feature "Add to Monitoring" flows + SERPFeaturesBadges) and R08 Phases 1-2 (daily digest, weekly report, alert emails with preference filtering).

**Architecture:** R12 wires frontend stubs to existing Convex mutations following the DiscoveredKeywordsTable reference pattern. R08 implements email templates in sendEmail.ts, data gathering queries in scheduler.ts, and wires alert email delivery through the existing alertEvaluation.ts flow. All emails respect userNotificationPreferences and log to notificationLogs.

**Tech Stack:** Convex (mutations/actions/internal queries), React (table components), Resend (email), next-intl (translations)

---

## Task 1: Wire AllKeywordsTable "Add to Monitoring"

**Files:**
- Modify: `src/components/domain/tables/AllKeywordsTable.tsx:1-15` (imports), `:53` (component body), `:107-115` (handleAddToMonitoring)

**Step 1: Add missing imports and mutations**

At the top of AllKeywordsTable.tsx, add `useMutation` to the convex/react import and import `toast` from sonner and `Plus` icon:

```tsx
// Change line 3-4 from:
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
// To:
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
```

Add near other imports:
```tsx
import { toast } from "sonner";
```

**Step 2: Add mutation hooks and loading state inside the component**

After `const keywords = useQuery(...)` (line 91), add:

```tsx
const addKeywordMutation = useMutation(api.keywords.addKeyword);
const refreshPositions = useMutation(api.keywords.refreshKeywordPositions);
const [addingKeywords, setAddingKeywords] = useState<Set<string>>(new Set());
```

**Step 3: Replace handleAddToMonitoring with real implementation**

Replace lines 107-115:

```tsx
const handleAddToMonitoring = async (keyword: any) => {
  if (isAlreadyMonitored(keyword.phrase)) return;
  const phrase = keyword.phrase;
  setAddingKeywords(prev => new Set(prev).add(phrase));
  try {
    const keywordId = await addKeywordMutation({ domainId, phrase });
    if (keywordId) {
      await refreshPositions({ keywordIds: [keywordId] });
    }
    toast.success(t('addedToMonitoring', { keyword: phrase }));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('failedToAddKeyword'));
  } finally {
    setAddingKeywords(prev => { const next = new Set(prev); next.delete(phrase); return next; });
  }
};
```

Note: The `t('addedToMonitoring')` and `t('failedToAddKeyword')` keys already exist in the keywords translations (used by DiscoveredKeywordsTable). Verify they exist; if not, fall back to hardcoded strings.

**Step 4: Update the button in the table row to show loading state**

Find the Add to Monitoring button rendering (around line 350-370 in the table body) and ensure it shows a loading spinner when `addingKeywords.has(keyword.phrase)`. The exact location depends on the existing button; look for `handleAddToMonitoring` in the onClick.

**Step 5: Run tests and verify**

```bash
npx vitest run --project frontend -- AllKeywordsTable
```

**Step 6: Commit**

```bash
git add src/components/domain/tables/AllKeywordsTable.tsx
git commit -m "R12: Wire AllKeywordsTable add-to-monitoring with auto position check"
```

---

## Task 2: Wire CompetitorKeywordGapTable per-row "Add to Monitoring"

**Files:**
- Modify: `src/components/domain/tables/CompetitorKeywordGapTable.tsx:332-340`

**Step 1: Add loading state**

Inside the component, near the top (after `const selection = useRowSelection()`), add:

```tsx
const [addingKeywords, setAddingKeywords] = useState<Set<string>>(new Set());
const refreshPositions = useMutation(api.keywords.refreshKeywordPositions);
```

Add `useMutation` import (already imported on line 4) and add `refreshKeywordPositions` usage.

**Step 2: Replace the per-row Plus button handler**

Replace lines 332-340:

```tsx
<Button
  color="tertiary"
  size="sm"
  iconLeading={Plus}
  isLoading={addingKeywords.has(gap.phrase)}
  isDisabled={addingKeywords.has(gap.phrase)}
  onClick={async () => {
    setAddingKeywords(prev => new Set(prev).add(gap.phrase));
    try {
      const ids = await addKeywords({ domainId, phrases: [gap.phrase] });
      if (ids && ids.length > 0) {
        await refreshPositions({ keywordIds: ids });
      }
      toast.success(tc('bulkActionSuccess', { count: 1 }));
    } catch {
      toast.error(tc('bulkActionFailed'));
    } finally {
      setAddingKeywords(prev => { const next = new Set(prev); next.delete(gap.phrase); return next; });
    }
  }}
/>
```

**Step 3: Also wire auto-refresh into the existing bulk action**

In the BulkActionBar onClick (lines 203-214), after `await addKeywords(...)`, add:

```tsx
// After: await addKeywords({ domainId, phrases });
// The mutation returns keyword IDs — trigger position check
// Note: addKeywords returns Id[] of newly created keywords
```

Actually, check if the bulk action already calls refreshPositions. If not, add it after the `addKeywords` call. The `addKeywords` mutation returns `Id<"keywords">[]`.

**Step 4: Commit**

```bash
git add src/components/domain/tables/CompetitorKeywordGapTable.tsx
git commit -m "R12: Wire CompetitorKeywordGapTable per-row and bulk add with position check"
```

---

## Task 3: Re-enable SERPFeaturesBadges

**Files:**
- Rename: `src/components/domain/tables/SERPFeaturesBadges.tsx.disabled` → `src/components/domain/tables/SERPFeaturesBadges.tsx`
- Modify: The keyword monitoring table that should display SERP features

**Step 1: Rename the file**

```bash
mv src/components/domain/tables/SERPFeaturesBadges.tsx.disabled src/components/domain/tables/SERPFeaturesBadges.tsx
```

**Step 2: Find where to integrate it**

Search for `KeywordMonitoringTable` or the main keyword table that displays monitored keywords. The SERPFeaturesBadges component takes `keywordId: Id<"keywords">` and renders inline badges. Add it as a column in the monitoring table.

Look at the monitoring table's existing columns and add a "SERP" column after the position or change column:

```tsx
import { SERPFeaturesBadges } from "./SERPFeaturesBadges";
```

In the table header, add:
```tsx
<th className="px-4 py-3 text-center text-xs font-medium text-tertiary">SERP</th>
```

In the table body row, add:
```tsx
<td className="px-4 py-3 text-center">
  <SERPFeaturesBadges keywordId={keyword._id} />
</td>
```

**Step 3: Verify the backend query exists**

Confirm `api.serpFeatures_queries.getCurrentSerpFeatures` is exported and accepts `{ keywordId }`.

**Step 4: Run build to verify no import errors**

```bash
npx next build 2>&1 | tail -20
```

**Step 5: Commit**

```bash
git add src/components/domain/tables/SERPFeaturesBadges.tsx
git add src/components/domain/tables/KeywordMonitoringTable.tsx  # or wherever it was integrated
git commit -m "R12: Re-enable SERPFeaturesBadges in keyword monitoring table"
```

---

## Task 4: R08 Phase 1 — Daily Digest Email Template + Data Query

**Files:**
- Create: `convex/digestQueries.ts` (internal queries for digest/report data)
- Modify: `convex/actions/sendEmail.ts` (add sendDailyDigest template)
- Modify: `convex/scheduler.ts` (implement triggerDailyDigests)
- Modify: `convex/crons.ts` (uncomment daily digest cron)

**Step 1: Create digestQueries.ts with data-gathering internal queries**

```typescript
// convex/digestQueries.ts
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Get digest data for a domain: top gainers, losers, and summary stats.
 * Uses denormalized fields on keywords table (currentPosition, previousPosition, positionChange).
 */
export const getDailyDigestData = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const withChange = keywords
      .filter((k) => k.currentPosition != null && k.positionChange != null)
      .map((k) => ({
        phrase: k.phrase,
        position: k.currentPosition!,
        change: k.positionChange!,
      }));

    // Sort by change descending (biggest improvement first)
    const sorted = [...withChange].sort((a, b) => b.change - a.change);
    const gainers = sorted.slice(0, 5);
    const losers = sorted.filter((k) => k.change < 0).sort((a, b) => a.change - b.change).slice(0, 5);

    const avgPosition = withChange.length > 0
      ? Math.round(withChange.reduce((sum, k) => sum + k.position, 0) / withChange.length)
      : null;

    return {
      totalKeywords: keywords.length,
      trackedWithPosition: withChange.length,
      avgPosition,
      gainers,
      losers,
    };
  },
});

/**
 * Get weekly report data: position distribution, week-over-week changes.
 */
export const getWeeklyReportData = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const withPosition = keywords.filter((k) => k.currentPosition != null);

    // Position distribution
    const top3 = withPosition.filter((k) => k.currentPosition! <= 3).length;
    const top10 = withPosition.filter((k) => k.currentPosition! <= 10).length;
    const top20 = withPosition.filter((k) => k.currentPosition! <= 20).length;
    const top50 = withPosition.filter((k) => k.currentPosition! <= 50).length;

    // Movers
    const improved = keywords.filter((k) => k.positionChange != null && k.positionChange > 0).length;
    const declined = keywords.filter((k) => k.positionChange != null && k.positionChange < 0).length;
    const stable = keywords.filter((k) => k.positionChange === 0).length;

    // Get domain visibility if available
    const domain = await ctx.db.get(args.domainId);

    return {
      totalKeywords: keywords.length,
      trackedWithPosition: withPosition.length,
      top3, top10, top20, top50,
      improved, declined, stable,
      domainName: domain?.domain ?? "Unknown",
    };
  },
});

/**
 * Get all active organizations with their domains and team members.
 * Used by digest/report triggers to determine who gets emails.
 */
export const getActiveOrgsWithDomains = internalQuery({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    const results = [];

    for (const org of orgs) {
      // Get org's teams
      const teams = await ctx.db
        .query("teams")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .collect();

      if (teams.length === 0) continue;

      // Get team members with their preferences
      const members = [];
      for (const team of teams) {
        const teamMembers = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .collect();

        for (const tm of teamMembers) {
          const user = await ctx.db.get(tm.userId);
          if (!user) continue;

          const prefs = await ctx.db
            .query("userNotificationPreferences")
            .withIndex("by_user", (q) => q.eq("userId", tm.userId))
            .unique();

          members.push({
            userId: tm.userId,
            email: user.email,
            name: user.name,
            prefs,
          });
        }
      }

      // Get domains for this org's projects
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", teams[0]._id))
        .collect();

      const domains = [];
      for (const project of projects) {
        const projectDomains = await ctx.db
          .query("domains")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        domains.push(...projectDomains);
      }

      results.push({ org, members, domains });
    }

    return results;
  },
});
```

**Step 2: Add sendDailyDigest to sendEmail.ts**

Add after the existing templates at the end of `convex/actions/sendEmail.ts`:

```typescript
// ─── Daily digest ────────────────────────────────────────

export const sendDailyDigest = internalAction({
  args: {
    to: v.string(),
    userName: v.string(),
    domainName: v.string(),
    totalKeywords: v.number(),
    avgPosition: v.optional(v.number()),
    gainers: v.array(v.object({
      phrase: v.string(),
      position: v.number(),
      change: v.number(),
    })),
    losers: v.array(v.object({
      phrase: v.string(),
      position: v.number(),
      change: v.number(),
    })),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();

    const gainersHtml = args.gainers.length > 0
      ? args.gainers.map(g => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">${g.phrase}</td><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #eee;">${g.position}</td><td style="padding:8px 12px;text-align:center;color:#16a34a;border-bottom:1px solid #eee;">▲ ${g.change}</td></tr>`).join("")
      : '<tr><td colspan="3" style="padding:12px;text-align:center;color:#999;">Brak zmian pozycji</td></tr>';

    const losersHtml = args.losers.length > 0
      ? args.losers.map(l => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.phrase}</td><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #eee;">${l.position}</td><td style="padding:8px 12px;text-align:center;color:#dc2626;border-bottom:1px solid #eee;">▼ ${Math.abs(l.change)}</td></tr>`).join("")
      : '<tr><td colspan="3" style="padding:12px;text-align:center;color:#999;">Brak spadków</td></tr>';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f9fafb;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">📊 Codzienny raport pozycji</h1>
      <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px;">${args.domainName}</p>
    </div>
    <div style="padding:24px 32px;">
      <p style="color:#374151;margin:0 0 16px;">Cześć ${args.userName},</p>
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#16a34a;">${args.totalKeywords}</div>
          <div style="font-size:12px;color:#6b7280;">Monitorowanych fraz</div>
        </div>
        ${args.avgPosition != null ? `<div style="flex:1;background:#eff6ff;border-radius:8px;padding:16px;text-align:center;"><div style="font-size:24px;font-weight:700;color:#2563eb;">${args.avgPosition}</div><div style="font-size:12px;color:#6b7280;">Śr. pozycja</div></div>` : ""}
      </div>
      <h3 style="color:#16a34a;margin:0 0 8px;">🔼 Największe wzrosty</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;"><thead><tr><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280;">Fraza</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280;">Pozycja</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280;">Zmiana</th></tr></thead><tbody>${gainersHtml}</tbody></table>
      <h3 style="color:#dc2626;margin:0 0 8px;">🔽 Największe spadki</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;"><thead><tr><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280;">Fraza</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280;">Pozycja</th><th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280;">Zmiana</th></tr></thead><tbody>${losersHtml}</tbody></table>
      <div style="text-align:center;"><a href="${appUrl}/domains" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;">Otwórz dashboard</a></div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;text-align:center;"><p style="margin:0;font-size:12px;color:#9ca3af;">doseo — SEO monitoring & strategy platform</p></div>
  </div>
</div></body></html>`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: `[doseo] Codzienny raport: ${args.domainName}`,
      html,
    });
    if (error) {
      console.error("[email] Daily digest send failed:", error);
      throw new Error(`Daily digest send failed: ${error.message}`);
    }
    return data?.id;
  },
});
```

**Step 3: Add sendWeeklyReport to sendEmail.ts**

Similar template but with weekly stats (position distribution, movers count, domain summary). Add after sendDailyDigest.

```typescript
// ─── Weekly report ───────────────────────────────────────

export const sendWeeklyReport = internalAction({
  args: {
    to: v.string(),
    userName: v.string(),
    domainName: v.string(),
    totalKeywords: v.number(),
    top3: v.number(),
    top10: v.number(),
    top20: v.number(),
    top50: v.number(),
    improved: v.number(),
    declined: v.number(),
    stable: v.number(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f9fafb;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#059669,#10b981);padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">📈 Tygodniowy raport SEO</h1>
      <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px;">${args.domainName}</p>
    </div>
    <div style="padding:24px 32px;">
      <p style="color:#374151;margin:0 0 16px;">Cześć ${args.userName},</p>
      <p style="color:#6b7280;margin:0 0 24px;">Oto podsumowanie pozycji Twojej domeny za ostatni tydzień.</p>
      <h3 style="margin:0 0 12px;color:#374151;">Rozkład pozycji</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr><td style="padding:10px 12px;border-bottom:1px solid #eee;">Top 3</td><td style="padding:10px 12px;text-align:right;font-weight:700;color:#16a34a;border-bottom:1px solid #eee;">${args.top3}</td></tr>
        <tr><td style="padding:10px 12px;border-bottom:1px solid #eee;">Top 10</td><td style="padding:10px 12px;text-align:right;font-weight:700;color:#2563eb;border-bottom:1px solid #eee;">${args.top10}</td></tr>
        <tr><td style="padding:10px 12px;border-bottom:1px solid #eee;">Top 20</td><td style="padding:10px 12px;text-align:right;font-weight:700;color:#7c3aed;border-bottom:1px solid #eee;">${args.top20}</td></tr>
        <tr><td style="padding:10px 12px;border-bottom:1px solid #eee;">Top 50</td><td style="padding:10px 12px;text-align:right;font-weight:700;color:#6b7280;border-bottom:1px solid #eee;">${args.top50}</td></tr>
      </table>
      <h3 style="margin:0 0 12px;color:#374151;">Zmiany w tym tygodniu</h3>
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#16a34a;">▲ ${args.improved}</div><div style="font-size:11px;color:#6b7280;">Wzrosty</div></div>
        <div style="flex:1;background:#fef2f2;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#dc2626;">▼ ${args.declined}</div><div style="font-size:11px;color:#6b7280;">Spadki</div></div>
        <div style="flex:1;background:#f9fafb;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#6b7280;">— ${args.stable}</div><div style="font-size:11px;color:#6b7280;">Bez zmian</div></div>
      </div>
      <div style="text-align:center;"><a href="${appUrl}/domains" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;">Zobacz szczegóły</a></div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;text-align:center;"><p style="margin:0;font-size:12px;color:#9ca3af;">doseo — SEO monitoring & strategy platform</p></div>
  </div>
</div></body></html>`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: `[doseo] Tygodniowy raport: ${args.domainName}`,
      html,
    });
    if (error) {
      console.error("[email] Weekly report send failed:", error);
      throw new Error(`Weekly report send failed: ${error.message}`);
    }
    return data?.id;
  },
});
```

**Step 4: Implement triggerDailyDigests in scheduler.ts**

Replace the stub (lines 106-118) with:

```typescript
export const triggerDailyDigests = internalAction({
  args: {},
  handler: async (ctx): Promise<{ sent: number; failed: number }> => {
    const orgsData = await ctx.runQuery(internal.digestQueries.getActiveOrgsWithDomains);
    let sent = 0;
    let failed = 0;

    for (const { members, domains } of orgsData) {
      // Filter members who opted into daily digests
      const dailyMembers = members.filter(
        (m) => m.prefs?.dailyRankingReports === true
      );
      if (dailyMembers.length === 0) continue;

      for (const domain of domains) {
        const data = await ctx.runQuery(internal.digestQueries.getDailyDigestData, {
          domainId: domain._id,
        });
        if (data.totalKeywords === 0) continue;

        for (const member of dailyMembers) {
          if (!member.email) continue;
          try {
            await ctx.runAction(internal.actions.sendEmail.sendDailyDigest, {
              to: member.email,
              userName: member.name ?? "Użytkownik",
              domainName: domain.domain,
              totalKeywords: data.totalKeywords,
              avgPosition: data.avgPosition ?? undefined,
              gainers: data.gainers,
              losers: data.losers,
            });
            // Log to notificationLogs
            await ctx.runMutation(internal.scheduler.logNotification, {
              type: "email",
              recipient: member.email,
              subject: `[doseo] Codzienny raport: ${domain.domain}`,
              status: "sent",
            });
            sent++;
          } catch (error) {
            console.error(`[digest] Failed for ${member.email}:`, error);
            await ctx.runMutation(internal.scheduler.logNotification, {
              type: "email",
              recipient: member.email,
              subject: `[doseo] Codzienny raport: ${domain.domain}`,
              status: "failed",
              error: error instanceof Error ? error.message : "Unknown error",
            });
            failed++;
          }
        }
      }
    }

    console.log(`[digest] Daily digest: sent=${sent}, failed=${failed}`);
    return { sent, failed };
  },
});
```

**Step 5: Add logNotification internal mutation to scheduler.ts**

```typescript
export const logNotification = internalMutation({
  args: {
    type: v.union(v.literal("email"), v.literal("system")),
    recipient: v.string(),
    subject: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("pending")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notificationLogs", {
      type: args.type,
      recipient: args.recipient,
      subject: args.subject,
      status: args.status,
      error: args.error,
      createdAt: Date.now(),
    });
  },
});
```

Add `internalMutation` to the imports from `./_generated/server`.

**Step 6: Implement triggerWeeklyReports similarly**

Replace the stub (lines 124-136) with same pattern but using `getWeeklyReportData` and `sendWeeklyReport`, filtering by `m.prefs?.frequency === "weekly"`.

**Step 7: Uncomment cron entries in crons.ts**

Remove the comment markers from lines 21-32:

```typescript
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
```

**Step 8: Run build to verify**

```bash
npx next build 2>&1 | tail -20
```

**Step 9: Commit**

```bash
git add convex/digestQueries.ts convex/actions/sendEmail.ts convex/scheduler.ts convex/crons.ts
git commit -m "R08 Phase 1: Daily digest and weekly report emails with preference filtering"
```

---

## Task 5: R08 Phase 2 — Alert Email Templates

**Files:**
- Modify: `convex/actions/sendEmail.ts` (add 5 alert email templates)

**Step 1: Add alert email templates**

Add 5 new `internalAction` functions to `sendEmail.ts`:

1. `sendPositionDropAlert` — args: to, domainName, keywordPhrase, previousPosition, currentPosition
2. `sendTopNExitAlert` — args: to, domainName, keywordPhrase, threshold, newPosition
3. `sendNewCompetitorAlert` — args: to, domainName, competitorDomain, details
4. `sendBacklinkLostAlert` — args: to, domainName, details
5. `sendVisibilityDropAlert` — args: to, domainName, previousValue, currentValue

Each follows the same HTML template pattern as existing emails — purple/red gradient header, clear message body, CTA button linking to the domain dashboard.

Example for sendPositionDropAlert:

```typescript
export const sendPositionDropAlert = internalAction({
  args: {
    to: v.string(),
    domainName: v.string(),
    keywordPhrase: v.string(),
    previousPosition: v.number(),
    currentPosition: v.number(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();
    const drop = args.currentPosition - args.previousPosition;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f9fafb;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#dc2626,#f87171);padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">⚠️ Alert: Spadek pozycji</h1>
      <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px;">${args.domainName}</p>
    </div>
    <div style="padding:24px 32px;">
      <p style="color:#374151;margin:0 0 16px;">Wykryto spadek pozycji dla frazy:</p>
      <div style="background:#fef2f2;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="margin:0 0 8px;font-weight:700;color:#374151;">"${args.keywordPhrase}"</p>
        <p style="margin:0;color:#dc2626;font-size:14px;">Pozycja ${args.previousPosition} → ${args.currentPosition} (spadek o ${drop})</p>
      </div>
      <div style="text-align:center;"><a href="${appUrl}/domains" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;">Sprawdź szczegóły</a></div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;text-align:center;"><p style="margin:0;font-size:12px;color:#9ca3af;">doseo — SEO monitoring & strategy platform</p></div>
  </div>
</div></body></html>`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: `[doseo] ⚠️ Spadek pozycji: "${args.keywordPhrase}" (${args.domainName})`,
      html,
    });
    if (error) throw new Error(`Alert email failed: ${error.message}`);
    return data?.id;
  },
});
```

The other 4 templates follow the same structure with different colors and content:
- `sendTopNExitAlert`: orange gradient, shows threshold and new position
- `sendNewCompetitorAlert`: purple gradient, shows competitor domain
- `sendBacklinkLostAlert`: red gradient, shows lost backlink details
- `sendVisibilityDropAlert`: orange gradient, shows before/after visibility scores

**Step 2: Commit**

```bash
git add convex/actions/sendEmail.ts
git commit -m "R08 Phase 2: Add 5 alert email templates"
```

---

## Task 6: R08 Phase 2 — Wire Alert Emails into alertEvaluation.ts

**Files:**
- Modify: `convex/alertEvaluation.ts:135-191` (createAlertEventAndNotify)
- Modify: `convex/alertEvaluation.ts:201-275` (evaluateAlertRules — pass notifyVia through)

**Step 1: Update createAlertEventAndNotify to accept notifyVia and schedule email**

Add `notifyVia` to the args:

```typescript
notifyVia: v.array(v.union(v.literal("in_app"), v.literal("email"))),
```

After the in-app notification loop (line 189), add email sending logic:

```typescript
// Send email alerts if configured
if (args.notifyVia.includes("email")) {
  for (const member of teamMembers) {
    const user = await ctx.db.get(member.userId);
    if (!user?.email) continue;

    // Check user preferences — only send if positionAlerts is true
    const prefs = await ctx.db
      .query("userNotificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", member.userId))
      .unique();
    if (prefs && prefs.positionAlerts === false) continue;

    // Schedule the appropriate email based on rule type
    const emailAction = getAlertEmailAction(args.ruleType);
    if (emailAction) {
      await ctx.scheduler.runAfter(0, emailAction, {
        to: user.email,
        domainName: domain.domain,
        ...(args.ruleType === "position_drop" || args.ruleType === "top_n_exit" ? {
          keywordPhrase: args.data.keywordPhrase ?? "Unknown",
          previousPosition: args.data.previousValue ?? 0,
          currentPosition: args.data.currentValue ?? 0,
        } : {}),
        ...(args.ruleType === "top_n_exit" ? {
          threshold: args.data.previousValue ?? 10,
          newPosition: args.data.currentValue ?? 0,
        } : {}),
        ...(args.ruleType === "new_competitor" ? {
          competitorDomain: args.data.competitorDomain ?? "Unknown",
          details: args.data.details ?? "",
        } : {}),
        ...(args.ruleType === "backlink_lost" ? {
          details: args.data.details ?? "",
        } : {}),
        ...(args.ruleType === "visibility_drop" ? {
          previousValue: args.data.previousValue ?? 0,
          currentValue: args.data.currentValue ?? 0,
        } : {}),
      });
    }
  }
}
```

Note: Since `createAlertEventAndNotify` is an `internalMutation` and email sending requires an `internalAction`, use `ctx.scheduler.runAfter(0, ...)` to schedule the email action asynchronously. This avoids the mutation→action call restriction in Convex.

Add a helper function at the top of the file:

```typescript
import { internal } from "./_generated/api";

function getAlertEmailAction(ruleType: string) {
  switch (ruleType) {
    case "position_drop": return internal.actions.sendEmail.sendPositionDropAlert;
    case "top_n_exit": return internal.actions.sendEmail.sendTopNExitAlert;
    case "new_competitor": return internal.actions.sendEmail.sendNewCompetitorAlert;
    case "backlink_lost": return internal.actions.sendEmail.sendBacklinkLostAlert;
    case "visibility_drop": return internal.actions.sendEmail.sendVisibilityDropAlert;
    default: return null;
  }
}
```

**Step 2: Update the evaluateAlertRules call site to pass notifyVia**

In `evaluateAlertRules` (around line 244), the call to `createAlertEventAndNotify` needs to include the rule's `notifyVia`:

```typescript
await ctx.runMutation(
  internal.alertEvaluation.createAlertEventAndNotify,
  {
    ruleId: rule._id,
    domainId: domain._id,
    ruleType: rule.ruleType,
    ruleName: rule.name,
    notifyVia: rule.notifyVia,  // ADD THIS
    data: { ... },
  }
);
```

Also update `getActiveRulesForDomain` to return `notifyVia` in its results if it doesn't already.

**Step 3: Run tests**

```bash
npx vitest run -- alertEval
```

**Step 4: Commit**

```bash
git add convex/alertEvaluation.ts
git commit -m "R08 Phase 2: Wire alert email delivery through evaluation engine"
```

---

## Task 7: Tests for R12 + R08

**Files:**
- Create: `src/test/integration/r12-cross-feature-flows.test.tsx`
- Create: `convex/tests/digestQueries.test.ts`
- Modify: `src/test/e2e/real-email-delivery.test.ts` (add digest + alert templates)

**Step 1: R12 frontend data-flow tests**

Test that AllKeywordsTable and CompetitorKeywordGapTable call the correct mutations:

```tsx
// src/test/integration/r12-cross-feature-flows.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// ... standard mock setup for useQuery, useMutation, useTranslations

describe("R12: AllKeywordsTable add to monitoring", () => {
  it("calls addKeyword mutation then refreshKeywordPositions on add", async () => {
    // Setup: mock keywords query returns some keywords
    // Click add button on a non-monitored keyword
    // Verify addKeyword was called with { domainId, phrase }
    // Verify refreshKeywordPositions was called with returned ID
  });

  it("shows already-monitored state for existing keywords", () => {
    // Verify button is disabled/different for already-monitored keywords
  });
});

describe("R12: CompetitorKeywordGapTable per-row add", () => {
  it("calls addKeywords and refreshPositions on per-row Plus click", async () => {
    // Setup gap data, click Plus on a row
    // Verify addKeywords called with { domainId, phrases: [gap.phrase] }
    // Verify refreshPositions called with returned IDs
  });
});
```

**Step 2: Convex digest query tests**

```typescript
// convex/tests/digestQueries.test.ts
// Test getDailyDigestData returns correct gainers/losers sorted
// Test getWeeklyReportData returns correct position distribution
// Test getActiveOrgsWithDomains returns filtered members with prefs
```

**Step 3: E2E email delivery tests**

Add daily digest and one alert template to the real email delivery test:

```typescript
// In src/test/e2e/real-email-delivery.test.ts
it("should deliver daily digest email", async () => {
  // Call Resend API directly with digest HTML template
  // Verify delivery
});

it("should deliver position drop alert email", async () => {
  // Call Resend API directly with alert HTML template
  // Verify delivery
});
```

**Step 4: Run full test suite**

```bash
npm test
```

**Step 5: Run build**

```bash
npx next build 2>&1 | tail -20
```

**Step 6: Commit**

```bash
git add src/test/integration/r12-cross-feature-flows.test.tsx convex/tests/digestQueries.test.ts src/test/e2e/real-email-delivery.test.ts
git commit -m "Add R12 + R08 tests: cross-feature flows, digest queries, email delivery"
```

---

## Task 8: Update ROADMAP.md and final verification

**Files:**
- Modify: `docs/plans/ROADMAP.md`

**Step 1: Mark R12 as done**

Change `### R12 [~]` to `### R12 [x]` and add completion notes.

**Step 2: Update R08 progress**

Update R08's Progress section to note Phases 1-2 complete, Phases 3-4 remaining.

**Step 3: Update Status Summary table**

Tier 1 Done: 4 (R11, R12, R13, R15) — add R12.

**Step 4: Add Completion Log entries**

**Step 5: Final commit**

```bash
git add docs/plans/ROADMAP.md session_state.json tasks_progress.json tasks_progress_verbose.txt
git commit -m "R12 + R08 Phase 1-2: Update roadmap, session tracking"
```
