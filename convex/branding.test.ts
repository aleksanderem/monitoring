import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUserWithOrg(
  t: any,
  opts?: { role?: string; name?: string; email?: string }
) {
  const userId = await t.run(async (ctx: any) => {
    return ctx.db.insert("users", {
      name: opts?.name ?? "Test User",
      email: opts?.email ?? `user-${Date.now()}@test.com`,
    });
  });

  const orgId = await t.run(async (ctx: any) => {
    return ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org-" + Date.now(),
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
    });
  });

  await t.run(async (ctx: any) => {
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: opts?.role ?? "owner",
      joinedAt: Date.now(),
    });
  });

  return { userId, orgId };
}

// ===========================================================================
// getOrganizationBranding
// ===========================================================================

describe("branding.getOrganizationBranding", () => {
  test("returns org branding data for authenticated user", async () => {
    const t = convexTest(schema, modules);
    const { userId, orgId } = await createUserWithOrg(t);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.branding.getOrganizationBranding, {});

    expect(result).not.toBeNull();
    expect(result!.organizationId).toBe(orgId);
    expect(result!.organizationName).toBe("Test Org");
    expect(result!.branding).toBeNull();
  });

  test("returns branding when logo is set", async () => {
    const t = convexTest(schema, modules);
    const { userId, orgId } = await createUserWithOrg(t);

    // Set branding directly on the org
    await t.run(async (ctx: any) => {
      await ctx.db.patch(orgId, {
        branding: {
          logoStorageId: "storage-123",
          logoUrl: "https://example.com/logo.png",
        },
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.branding.getOrganizationBranding, {});

    expect(result!.branding).not.toBeNull();
    expect(result!.branding!.logoStorageId).toBe("storage-123");
    expect(result!.branding!.logoUrl).toBe("https://example.com/logo.png");
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.branding.getOrganizationBranding, {});
    expect(result).toBeNull();
  });

  test("returns null when user has no org membership", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", {
        name: "Lonely User",
        email: "lonely@test.com",
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.branding.getOrganizationBranding, {});
    expect(result).toBeNull();
  });
});

// ===========================================================================
// removeOrganizationLogo
// ===========================================================================

describe("branding.removeOrganizationLogo", () => {
  test("clears branding from organization", async () => {
    const t = convexTest(schema, modules);
    const { userId, orgId } = await createUserWithOrg(t);

    // Set branding first
    await t.run(async (ctx: any) => {
      await ctx.db.patch(orgId, {
        branding: {
          logoStorageId: "storage-abc",
          logoUrl: "https://example.com/logo.png",
        },
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.branding.removeOrganizationLogo, {});

    // Verify branding was removed
    const org = await t.run(async (ctx: any) => ctx.db.get(orgId));
    expect(org!.branding).toBeUndefined();
  });

  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.branding.removeOrganizationLogo, {})
    ).rejects.toThrow("Not authenticated");
  });

  test("throws for non-admin member", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await createUserWithOrg(t, { role: "member" });

    const asUser = t.withIdentity({ subject: userId });
    await expect(
      asUser.mutation(api.branding.removeOrganizationLogo, {})
    ).rejects.toThrow("Only organization owners and admins can manage branding");
  });

  test("succeeds for admin role", async () => {
    const t = convexTest(schema, modules);
    const { userId, orgId } = await createUserWithOrg(t, { role: "admin" });

    await t.run(async (ctx: any) => {
      await ctx.db.patch(orgId, {
        branding: {
          logoStorageId: "storage-xyz",
          logoUrl: "https://example.com/logo.png",
        },
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.branding.removeOrganizationLogo, {});

    const org = await t.run(async (ctx: any) => ctx.db.get(orgId));
    expect(org!.branding).toBeUndefined();
  });
});

// ===========================================================================
// generateLogoUploadUrl
// ===========================================================================

describe("branding.generateLogoUploadUrl", () => {
  test("throws for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.branding.generateLogoUploadUrl, {})
    ).rejects.toThrow("Not authenticated");
  });

  test("throws for non-admin member", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await createUserWithOrg(t, { role: "member" });

    const asUser = t.withIdentity({ subject: userId });
    await expect(
      asUser.mutation(api.branding.generateLogoUploadUrl, {})
    ).rejects.toThrow("Only organization owners and admins can manage branding");
  });

  test("returns upload URL for owner", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await createUserWithOrg(t, { role: "owner" });

    const asUser = t.withIdentity({ subject: userId });
    const url = await asUser.mutation(api.branding.generateLogoUploadUrl, {});
    expect(url).toBeDefined();
    expect(typeof url).toBe("string");
  });
});
