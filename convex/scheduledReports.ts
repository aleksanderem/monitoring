import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import type { Id, Doc } from "./_generated/dataModel";

// ─── Helper: compute nextRunAt ──────────────────────────────────

function computeNextRunAt(
  frequency: "weekly" | "biweekly" | "monthly",
  dayOfWeek?: number,
  dayOfMonth?: number,
  fromDate?: number,
): number {
  const now = fromDate ?? Date.now();
  const d = new Date(now);

  if (frequency === "monthly") {
    // Next month on the given day
    const targetDay = dayOfMonth ?? 1;
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(Math.min(targetDay, 28));
    d.setUTCHours(6, 0, 0, 0); // 6 AM UTC
    return d.getTime();
  }

  // weekly or biweekly
  const targetDay = dayOfWeek ?? 1; // default Monday
  const currentDay = d.getUTCDay();
  let daysUntil = (targetDay - currentDay + 7) % 7;
  if (daysUntil === 0) daysUntil = 7; // always next occurrence
  if (frequency === "biweekly") {
    daysUntil += 7;
  }
  d.setUTCDate(d.getUTCDate() + daysUntil);
  d.setUTCHours(6, 0, 0, 0);
  return d.getTime();
}

// ─── Public Queries ─────────────────────────────────────────────

export const getSchedules = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("reportSchedules")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const getSchedulesByDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("reportSchedules")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
  },
});

export const getScheduleHistory = query({
  args: { scheduleId: v.id("reportSchedules") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule) return null;

    return {
      schedule,
      lastRunAt: schedule.lastRunAt ?? null,
      nextRunAt: schedule.nextRunAt ?? null,
    };
  },
});

// ─── Public Mutations ───────────────────────────────────────────

export const createSchedule = mutation({
  args: {
    orgId: v.id("organizations"),
    domainId: v.id("domains"),
    name: v.string(),
    reportType: v.union(
      v.literal("executive"),
      v.literal("keyword"),
      v.literal("competitor"),
      v.literal("monthly"),
      v.literal("custom")
    ),
    frequency: v.union(
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly")
    ),
    dayOfWeek: v.optional(v.number()),
    dayOfMonth: v.optional(v.number()),
    recipients: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.recipients.length === 0) {
      throw new Error("At least one recipient is required");
    }

    const now = Date.now();
    const nextRunAt = computeNextRunAt(
      args.frequency,
      args.dayOfWeek,
      args.dayOfMonth,
    );

    return await ctx.db.insert("reportSchedules", {
      orgId: args.orgId,
      domainId: args.domainId,
      name: args.name,
      reportType: args.reportType,
      frequency: args.frequency,
      dayOfWeek: args.dayOfWeek,
      dayOfMonth: args.dayOfMonth,
      recipients: args.recipients,
      isActive: true,
      nextRunAt,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSchedule = mutation({
  args: {
    scheduleId: v.id("reportSchedules"),
    name: v.optional(v.string()),
    reportType: v.optional(v.union(
      v.literal("executive"),
      v.literal("keyword"),
      v.literal("competitor"),
      v.literal("monthly"),
      v.literal("custom")
    )),
    frequency: v.optional(v.union(
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly")
    )),
    dayOfWeek: v.optional(v.number()),
    dayOfMonth: v.optional(v.number()),
    recipients: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.reportType !== undefined) updates.reportType = args.reportType;
    if (args.recipients !== undefined) {
      if (args.recipients.length === 0) {
        throw new Error("At least one recipient is required");
      }
      updates.recipients = args.recipients;
    }
    if (args.frequency !== undefined) updates.frequency = args.frequency;
    if (args.dayOfWeek !== undefined) updates.dayOfWeek = args.dayOfWeek;
    if (args.dayOfMonth !== undefined) updates.dayOfMonth = args.dayOfMonth;

    // Recompute nextRunAt if frequency/day changed
    const freq = (args.frequency ?? schedule.frequency) as "weekly" | "biweekly" | "monthly";
    const dow = args.dayOfWeek ?? schedule.dayOfWeek;
    const dom = args.dayOfMonth ?? schedule.dayOfMonth;
    updates.nextRunAt = computeNextRunAt(freq, dow, dom);

    await ctx.db.patch(args.scheduleId, updates);
  },
});

export const deleteSchedule = mutation({
  args: { scheduleId: v.id("reportSchedules") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    await ctx.db.delete(args.scheduleId);
  },
});

export const toggleSchedule = mutation({
  args: {
    scheduleId: v.id("reportSchedules"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const updates: Record<string, unknown> = {
      isActive: args.isActive,
      updatedAt: Date.now(),
    };

    // Recompute nextRunAt when re-activating
    if (args.isActive) {
      updates.nextRunAt = computeNextRunAt(
        schedule.frequency,
        schedule.dayOfWeek,
        schedule.dayOfMonth,
      );
    }

    await ctx.db.patch(args.scheduleId, updates);
  },
});

export const runScheduleNow = mutation({
  args: { scheduleId: v.id("reportSchedules") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    // Mark as running
    const now = Date.now();
    await ctx.db.patch(args.scheduleId, {
      lastRunAt: now,
      nextRunAt: computeNextRunAt(
        schedule.frequency,
        schedule.dayOfWeek,
        schedule.dayOfMonth,
      ),
      updatedAt: now,
    });

    // In a real implementation, this would trigger the report generation
    // via ctx.scheduler.runAfter(0, internal.scheduledReports.executeSchedule, { scheduleId })
  },
});

// ─── Internal Mutations (called by cron) ────────────────────────

export const processScheduledReports = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find all active schedules that are due
    const activeSchedules = await ctx.db
      .query("reportSchedules")
      .withIndex("by_active", (q) =>
        q.eq("isActive", true)
      )
      .collect();

    const dueSchedules = activeSchedules.filter(
      (s) => s.nextRunAt && s.nextRunAt <= now
    );

    console.log(`[scheduledReports] Found ${dueSchedules.length} due schedules out of ${activeSchedules.length} active`);

    for (const schedule of dueSchedules) {
      try {
        // Update schedule timing
        const nextRunAt = computeNextRunAt(
          schedule.frequency,
          schedule.dayOfWeek,
          schedule.dayOfMonth,
        );

        await ctx.db.patch(schedule._id, {
          lastRunAt: now,
          nextRunAt,
          updatedAt: now,
        });

        console.log(`[scheduledReports] Processed schedule "${schedule.name}" (${schedule._id}), next run: ${new Date(nextRunAt).toISOString()}`);
      } catch (error) {
        console.error(`[scheduledReports] Failed to process schedule ${schedule._id}:`, error);
      }
    }

    return { processed: dueSchedules.length };
  },
});

export const markScheduleRun = internalMutation({
  args: {
    scheduleId: v.id("reportSchedules"),
    status: v.union(v.literal("success"), v.literal("failed")),
    reportId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule) return;

    const now = Date.now();
    const nextRunAt = computeNextRunAt(
      schedule.frequency,
      schedule.dayOfWeek,
      schedule.dayOfMonth,
    );

    await ctx.db.patch(args.scheduleId, {
      lastRunAt: now,
      nextRunAt,
      updatedAt: now,
    });
  },
});
