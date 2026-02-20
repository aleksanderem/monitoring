import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(t: any, opts?: { name?: string; email?: string }) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      name: opts?.name ?? "Test User",
      email: opts?.email ?? `user-${Date.now()}@test.com`,
    });
  });
}

// ===========================================================================
// getUserPreferences
// ===========================================================================

describe("userSettings.getUserPreferences", () => {
  test("returns defaults when no preferences exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const asUser = t.withIdentity({ subject: userId });
    const prefs = await asUser.query(api.userSettings.getUserPreferences, {});

    expect(prefs).toEqual({
      language: "en",
      timezone: "America/New_York",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
    });
  });

  test("returns saved preferences when they exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("userPreferences", {
        userId,
        language: "pl",
        timezone: "Europe/Warsaw",
        dateFormat: "DD/MM/YYYY",
        timeFormat: "24h",
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const prefs = await asUser.query(api.userSettings.getUserPreferences, {});

    expect(prefs).toEqual({
      language: "pl",
      timezone: "Europe/Warsaw",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
    });
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const prefs = await t.query(api.userSettings.getUserPreferences, {});
    expect(prefs).toBeNull();
  });
});

// ===========================================================================
// updateUserPreferences
// ===========================================================================

describe("userSettings.updateUserPreferences", () => {
  test("creates new preferences when none exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.userSettings.updateUserPreferences, {
      language: "fr",
      timezone: "Europe/Paris",
    });

    const prefs = await asUser.query(api.userSettings.getUserPreferences, {});
    expect(prefs).toEqual({
      language: "fr",
      timezone: "Europe/Paris",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
    });
  });

  test("updates existing preferences partially", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    // Create initial preferences
    await t.run(async (ctx: any) => {
      await ctx.db.insert("userPreferences", {
        userId,
        language: "en",
        timezone: "America/New_York",
        dateFormat: "MM/DD/YYYY",
        timeFormat: "12h",
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.userSettings.updateUserPreferences, {
      language: "de",
      timeFormat: "24h",
    });

    const prefs = await asUser.query(api.userSettings.getUserPreferences, {});
    expect(prefs!.language).toBe("de");
    expect(prefs!.timeFormat).toBe("24h");
    // Unchanged fields stay the same
    expect(prefs!.timezone).toBe("America/New_York");
    expect(prefs!.dateFormat).toBe("MM/DD/YYYY");
  });

  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.userSettings.updateUserPreferences, { language: "en" })
    ).rejects.toThrow("Not authenticated");
  });
});

// ===========================================================================
// getNotificationPreferences
// ===========================================================================

describe("userSettings.getNotificationPreferences", () => {
  test("returns defaults when no notification preferences exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const asUser = t.withIdentity({ subject: userId });
    const prefs = await asUser.query(api.userSettings.getNotificationPreferences, {});

    expect(prefs).toEqual({
      dailyRankingReports: true,
      positionAlerts: true,
      keywordOpportunities: true,
      teamInvitations: true,
      systemUpdates: true,
      frequency: "daily",
    });
  });

  test("returns saved notification preferences", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("userNotificationPreferences", {
        userId,
        dailyRankingReports: false,
        positionAlerts: true,
        keywordOpportunities: false,
        teamInvitations: true,
        systemUpdates: false,
        frequency: "weekly",
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const prefs = await asUser.query(api.userSettings.getNotificationPreferences, {});

    expect(prefs).toEqual({
      dailyRankingReports: false,
      positionAlerts: true,
      keywordOpportunities: false,
      teamInvitations: true,
      systemUpdates: false,
      frequency: "weekly",
    });
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const prefs = await t.query(api.userSettings.getNotificationPreferences, {});
    expect(prefs).toBeNull();
  });
});

// ===========================================================================
// updateNotificationPreferences
// ===========================================================================

describe("userSettings.updateNotificationPreferences", () => {
  test("creates new notification preferences when none exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.userSettings.updateNotificationPreferences, {
      dailyRankingReports: false,
      frequency: "weekly",
    });

    const prefs = await asUser.query(api.userSettings.getNotificationPreferences, {});
    expect(prefs!.dailyRankingReports).toBe(false);
    expect(prefs!.frequency).toBe("weekly");
    // Defaults for unset fields
    expect(prefs!.positionAlerts).toBe(true);
    expect(prefs!.keywordOpportunities).toBe(true);
    expect(prefs!.teamInvitations).toBe(true);
    expect(prefs!.systemUpdates).toBe(true);
  });

  test("updates existing notification preferences partially", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("userNotificationPreferences", {
        userId,
        dailyRankingReports: true,
        positionAlerts: true,
        keywordOpportunities: true,
        teamInvitations: true,
        systemUpdates: true,
        frequency: "daily",
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.userSettings.updateNotificationPreferences, {
      positionAlerts: false,
      systemUpdates: false,
    });

    const prefs = await asUser.query(api.userSettings.getNotificationPreferences, {});
    expect(prefs!.positionAlerts).toBe(false);
    expect(prefs!.systemUpdates).toBe(false);
    // Unchanged
    expect(prefs!.dailyRankingReports).toBe(true);
    expect(prefs!.keywordOpportunities).toBe(true);
    expect(prefs!.teamInvitations).toBe(true);
    expect(prefs!.frequency).toBe("daily");
  });

  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.userSettings.updateNotificationPreferences, {
        dailyRankingReports: false,
      })
    ).rejects.toThrow("Not authenticated");
  });
});
