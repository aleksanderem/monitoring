import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { PERMISSIONS, ALL_MODULES } from "./permissions";

const modules = import.meta.glob("./**/*.ts");

// Helper: seed plans and return their IDs
async function seedPlans(t: any) {
  return await t.run(async (ctx: any) => {
    const allPerms = Object.keys(PERMISSIONS);

    const freeId = await ctx.db.insert("plans", {
      name: "Free",
      key: "free",
      description: "Basic plan",
      permissions: ["keywords.view", "keywords.add", "domains.view"],
      modules: ["positioning"],
      limits: {
        maxKeywords: 50,
        maxDomains: 3,
        maxProjects: 1,
        maxKeywordsPerDomain: 50,
      },
      isDefault: true,
      createdAt: Date.now(),
    });

    const proId = await ctx.db.insert("plans", {
      name: "Pro",
      key: "pro",
      description: "Professional plan",
      permissions: allPerms.filter(p => !p.startsWith("ai.") && !p.startsWith("forecasts.")),
      modules: ["positioning", "backlinks", "seo_audit", "reports", "competitors", "link_building"],
      limits: {
        maxKeywords: 500,
        maxDomains: 20,
        maxProjects: 10,
        maxKeywordsPerDomain: 100,
      },
      isDefault: false,
      createdAt: Date.now(),
    });

    const enterpriseId = await ctx.db.insert("plans", {
      name: "Enterprise",
      key: "enterprise",
      description: "Full access",
      permissions: allPerms,
      modules: [...ALL_MODULES],
      limits: {},
      isDefault: false,
      createdAt: Date.now(),
    });

    return { freeId, proId, enterpriseId };
  });
}

// Helper: create super admin user
async function createSuperAdmin(t: any) {
  return await t.run(async (ctx: any) => {
    const userId = await ctx.db.insert("users", {
      name: "Admin",
      email: "admin@test.com",
    });
    await ctx.db.insert("superAdmins", {
      userId,
      grantedAt: Date.now(),
    });
    return userId;
  });
}

describe("getPlanByKey", () => {
  test("returns correct plan for 'free'", async () => {
    const t = convexTest(schema, modules);
    await seedPlans(t);

    const plan = await t.query(api.plans.getPlanByKey, { key: "free" });
    expect(plan).not.toBeNull();
    expect(plan!.name).toBe("Free");
    expect(plan!.key).toBe("free");
    expect(plan!.isDefault).toBe(true);
    expect(plan!.limits.maxKeywords).toBe(50);
  });

  test("returns correct plan for 'pro'", async () => {
    const t = convexTest(schema, modules);
    await seedPlans(t);

    const plan = await t.query(api.plans.getPlanByKey, { key: "pro" });
    expect(plan).not.toBeNull();
    expect(plan!.name).toBe("Pro");
    expect(plan!.modules).toContain("backlinks");
    expect(plan!.isDefault).toBe(false);
  });

  test("returns correct plan for 'enterprise'", async () => {
    const t = convexTest(schema, modules);
    await seedPlans(t);

    const plan = await t.query(api.plans.getPlanByKey, { key: "enterprise" });
    expect(plan).not.toBeNull();
    expect(plan!.name).toBe("Enterprise");
    expect(plan!.permissions).toEqual(expect.arrayContaining(Object.keys(PERMISSIONS)));
    expect(plan!.modules).toEqual(expect.arrayContaining(ALL_MODULES));
  });

  test("returns null for nonexistent key", async () => {
    const t = convexTest(schema, modules);
    await seedPlans(t);

    const plan = await t.query(api.plans.getPlanByKey, { key: "nonexistent" });
    expect(plan).toBeNull();
  });
});

describe("getDefaultPlan", () => {
  test("returns plan with isDefault=true", async () => {
    const t = convexTest(schema, modules);
    await seedPlans(t);

    const plan = await t.query(api.plans.getDefaultPlan, {});
    expect(plan).not.toBeNull();
    expect(plan!.isDefault).toBe(true);
    expect(plan!.key).toBe("free");
  });

  test("returns null when no default plan exists", async () => {
    const t = convexTest(schema, modules);
    // Insert a plan that is NOT default
    await t.run(async (ctx: any) => {
      await ctx.db.insert("plans", {
        name: "NonDefault",
        key: "nondefault",
        permissions: [],
        modules: [],
        limits: {},
        isDefault: false,
        createdAt: Date.now(),
      });
    });

    const plan = await t.query(api.plans.getDefaultPlan, {});
    expect(plan).toBeNull();
  });
});

describe("getPlan", () => {
  test("returns plan by ID", async () => {
    const t = convexTest(schema, modules);
    const { freeId } = await seedPlans(t);

    const plan = await t.query(api.plans.getPlan, { planId: freeId });
    expect(plan).not.toBeNull();
    expect(plan!._id).toBe(freeId);
    expect(plan!.name).toBe("Free");
  });
});

describe("getPlans (super admin only)", () => {
  test("super admin can list all plans", async () => {
    const t = convexTest(schema, modules);
    await seedPlans(t);
    const adminId = await createSuperAdmin(t);

    const asAdmin = t.withIdentity({ subject: adminId });
    const plans = await asAdmin.query(api.plans.getPlans, {});
    expect(plans.length).toBe(3);
  });

  test("non-super-admin gets empty array", async () => {
    const t = convexTest(schema, modules);
    await seedPlans(t);
    const userId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Regular",
        email: "regular@test.com",
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const plans = await asUser.query(api.plans.getPlans, {});
    expect(plans).toEqual([]);
  });

  test("unauthenticated user gets empty array", async () => {
    const t = convexTest(schema, modules);
    await seedPlans(t);

    const plans = await t.query(api.plans.getPlans, {});
    expect(plans).toEqual([]);
  });
});

describe("assignPlanToOrganization", () => {
  test("assigns plan and copies limits to org", async () => {
    const t = convexTest(schema, modules);
    const { proId } = await seedPlans(t);
    const adminId = await createSuperAdmin(t);

    // Create an org
    const orgId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("organizations", {
        name: "Target Org",
        slug: "target-org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });
    await asAdmin.mutation(api.plans.assignPlanToOrganization, {
      organizationId: orgId,
      planId: proId,
    });

    // Verify the org has the plan and limits
    const org = await t.run(async (ctx: any) => {
      return await ctx.db.get(orgId);
    });
    expect(org.planId).toBe(proId);
    expect(org.limits).toBeDefined();
    expect(org.limits.maxKeywords).toBe(500);
    expect(org.limits.maxDomains).toBe(20);
  });

  test("fails for non-super-admin", async () => {
    const t = convexTest(schema, modules);
    const { proId } = await seedPlans(t);
    const userId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        name: "Regular",
        email: "regular2@test.com",
      });
    });

    const orgId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("organizations", {
        name: "Another Org",
        slug: "another-org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await expect(
      asUser.mutation(api.plans.assignPlanToOrganization, {
        organizationId: orgId,
        planId: proId,
      })
    ).rejects.toThrow("Super admin access required");
  });

  test("fails for nonexistent plan", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createSuperAdmin(t);

    const orgId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org-3",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });
    await expect(
      asAdmin.mutation(api.plans.assignPlanToOrganization, {
        organizationId: orgId,
        planId: "kh7eg6c8w3f3wp2bxqrbvjvfz576t5wg" as any,
      })
    ).rejects.toThrow();
  });
});

describe("createPlan", () => {
  test("super admin can create a new plan", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createSuperAdmin(t);

    const asAdmin = t.withIdentity({ subject: adminId });
    const planId = await asAdmin.mutation(api.plans.createPlan, {
      name: "Starter",
      key: "starter",
      description: "A starter plan",
      permissions: ["keywords.view"],
      modules: ["positioning"],
      limits: { maxKeywords: 25 },
      isDefault: false,
    });
    expect(planId).toBeDefined();

    const plan = await t.query(api.plans.getPlanByKey, { key: "starter" });
    expect(plan).not.toBeNull();
    expect(plan!.name).toBe("Starter");
  });

  test("fails with duplicate key", async () => {
    const t = convexTest(schema, modules);
    await seedPlans(t);
    const adminId = await createSuperAdmin(t);

    const asAdmin = t.withIdentity({ subject: adminId });
    await expect(
      asAdmin.mutation(api.plans.createPlan, {
        name: "Another Free",
        key: "free",
        permissions: [],
        modules: [],
        limits: {},
        isDefault: false,
      })
    ).rejects.toThrow("Plan z takim kluczem już istnieje");
  });

  test("setting isDefault unsets other defaults", async () => {
    const t = convexTest(schema, modules);
    await seedPlans(t);
    const adminId = await createSuperAdmin(t);

    const asAdmin = t.withIdentity({ subject: adminId });
    await asAdmin.mutation(api.plans.createPlan, {
      name: "New Default",
      key: "new_default",
      permissions: ["keywords.view"],
      modules: ["positioning"],
      limits: {},
      isDefault: true,
    });

    // Old free plan should no longer be default
    const freePlan = await t.query(api.plans.getPlanByKey, { key: "free" });
    expect(freePlan!.isDefault).toBe(false);

    // New plan should be default
    const newDefault = await t.query(api.plans.getDefaultPlan, {});
    expect(newDefault!.key).toBe("new_default");
  });
});

describe("deletePlan", () => {
  test("super admin can delete unused plan", async () => {
    const t = convexTest(schema, modules);
    const { enterpriseId } = await seedPlans(t);
    const adminId = await createSuperAdmin(t);

    const asAdmin = t.withIdentity({ subject: adminId });
    await asAdmin.mutation(api.plans.deletePlan, { planId: enterpriseId });

    const plan = await t.query(api.plans.getPlanByKey, { key: "enterprise" });
    expect(plan).toBeNull();
  });

  test("fails when plan is in use by an org", async () => {
    const t = convexTest(schema, modules);
    const { freeId } = await seedPlans(t);
    const adminId = await createSuperAdmin(t);

    // Create an org using this plan
    await t.run(async (ctx: any) => {
      await ctx.db.insert("organizations", {
        name: "Using Free Plan",
        slug: "using-free",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
        planId: freeId,
      });
    });

    const asAdmin = t.withIdentity({ subject: adminId });
    await expect(
      asAdmin.mutation(api.plans.deletePlan, { planId: freeId })
    ).rejects.toThrow("Ten plan jest używany przez");
  });
});
