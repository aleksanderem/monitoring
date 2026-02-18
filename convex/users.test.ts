import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

// Helper: create a user with optional email and name
async function createUser(t: any, opts?: { name?: string; email?: string }) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      name: opts?.name ?? "Test User",
      email: opts?.email ?? `user-${Date.now()}@test.com`,
    });
  });
}

describe("getCurrentUser", () => {
  test("returns authenticated user profile", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, { name: "Alice", email: "alice@test.com" });

    // Also add a team membership so we get role info
    await t.run(async (ctx: any) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Alice Org",
        slug: "alice-org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Default",
        createdAt: Date.now(),
      });
      await ctx.db.insert("teamMembers", {
        teamId,
        userId,
        role: "admin",
        joinedAt: Date.now(),
      });
    });

    const asAlice = t.withIdentity({ subject: userId });
    const user = await asAlice.query(api.users.getCurrentUser, {});
    expect(user).not.toBeNull();
    expect(user!.name).toBe("Alice");
    expect(user!.email).toBe("alice@test.com");
    expect(user!.role).toBe("admin");
  });

  test("returns null for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const user = await t.query(api.users.getCurrentUser, {});
    expect(user).toBeNull();
  });

  test("defaults to member role when no team membership", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, { name: "Solo", email: "solo@test.com" });

    const asSolo = t.withIdentity({ subject: userId });
    const user = await asSolo.query(api.users.getCurrentUser, {});
    expect(user).not.toBeNull();
    expect(user!.role).toBe("member"); // default when no team membership
  });
});

describe("updateProfile", () => {
  test("updates name successfully", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, { name: "OldName", email: "update@test.com" });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.users.updateProfile, { name: "NewName" });

    const user = await asUser.query(api.users.getCurrentUser, {});
    expect(user!.name).toBe("NewName");
  });

  test("updates email successfully", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, { name: "Test", email: "old@test.com" });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.users.updateProfile, { email: "new@test.com" });

    const updatedUser = await t.run(async (ctx: any) => {
      return await ctx.db.get(userId);
    });
    expect(updatedUser.email).toBe("new@test.com");
  });

  test("rejects invalid email format", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, { email: "valid@test.com" });

    const asUser = t.withIdentity({ subject: userId });
    await expect(
      asUser.mutation(api.users.updateProfile, { email: "not-an-email" })
    ).rejects.toThrow("Invalid email format");
  });

  test("rejects duplicate email", async () => {
    const t = convexTest(schema, modules);
    const userId1 = await createUser(t, { email: "user1@test.com" });
    await createUser(t, { email: "user2@test.com" });

    const asUser1 = t.withIdentity({ subject: userId1 });
    await expect(
      asUser1.mutation(api.users.updateProfile, { email: "user2@test.com" })
    ).rejects.toThrow("Email is already in use");
  });

  test("fails for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.users.updateProfile, { name: "Hacker" })
    ).rejects.toThrow("Not authenticated");
  });
});

describe("API keys - generate, list, revoke", () => {
  test("generates a new API key with full key returned", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.mutation(api.users.generateAPIKey, {
      name: "Test Key",
      scopes: ["read", "write"],
    });

    expect(result._id).toBeDefined();
    expect(result.name).toBe("Test Key");
    expect(result.key).toMatch(/^sk_/);
    expect(result.scopes).toEqual(["read", "write"]);
    expect(result.createdAt).toBeDefined();
  });

  test("lists API keys with masked key values", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const asUser = t.withIdentity({ subject: userId });
    // Generate two keys
    await asUser.mutation(api.users.generateAPIKey, {
      name: "Key 1",
      scopes: ["read"],
    });
    await asUser.mutation(api.users.generateAPIKey, {
      name: "Key 2",
      scopes: ["read", "write"],
    });

    const keys = await asUser.query(api.users.getAPIKeys, {});
    expect(keys.length).toBe(2);
    // Keys should be masked (first 8 chars + ... + last 4 chars)
    for (const key of keys) {
      expect(key.key).toMatch(/^.{8}\.\.\..{4}$/);
    }
  });

  test("revokes an API key", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const asUser = t.withIdentity({ subject: userId });
    const generated = await asUser.mutation(api.users.generateAPIKey, {
      name: "To Revoke",
      scopes: ["read"],
    });

    await asUser.mutation(api.users.revokeAPIKey, { keyId: generated._id });

    const keys = await asUser.query(api.users.getAPIKeys, {});
    expect(keys.length).toBe(0);
  });

  test("cannot revoke another user's API key", async () => {
    const t = convexTest(schema, modules);
    const userId1 = await createUser(t, { email: "user1-api@test.com" });
    const userId2 = await createUser(t, { email: "user2-api@test.com" });

    const asUser1 = t.withIdentity({ subject: userId1 });
    const generated = await asUser1.mutation(api.users.generateAPIKey, {
      name: "User1 Key",
      scopes: ["read"],
    });

    const asUser2 = t.withIdentity({ subject: userId2 });
    await expect(
      asUser2.mutation(api.users.revokeAPIKey, { keyId: generated._id })
    ).rejects.toThrow("API key not found or unauthorized");
  });

  test("unauthenticated user gets empty key list", async () => {
    const t = convexTest(schema, modules);
    const keys = await t.query(api.users.getAPIKeys, {});
    expect(keys).toEqual([]);
  });
});

describe("getAPIKeyUsageStats", () => {
  test("returns correct counts", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const asUser = t.withIdentity({ subject: userId });
    // Generate 3 keys, set one with recent lastUsedAt
    const key1 = await asUser.mutation(api.users.generateAPIKey, {
      name: "Active",
      scopes: ["read"],
    });
    await asUser.mutation(api.users.generateAPIKey, {
      name: "Inactive 1",
      scopes: ["read"],
    });
    await asUser.mutation(api.users.generateAPIKey, {
      name: "Inactive 2",
      scopes: ["read"],
    });

    // Update one key to have recent usage
    await t.run(async (ctx: any) => {
      await ctx.db.patch(key1._id, { lastUsedAt: Date.now() });
    });

    const stats = await asUser.query(api.users.getAPIKeyUsageStats, {});
    expect(stats.totalKeys).toBe(3);
    expect(stats.activeKeys).toBe(1);
  });

  test("returns zeros for unauthenticated user", async () => {
    const t = convexTest(schema, modules);
    const stats = await t.query(api.users.getAPIKeyUsageStats, {});
    expect(stats).toEqual({ totalKeys: 0, activeKeys: 0 });
  });
});

describe("auth.getCurrentUser (from auth.ts)", () => {
  test("returns user data for authenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, { name: "AuthUser", email: "auth@test.com" });

    const asUser = t.withIdentity({ subject: userId });
    const user = await asUser.query(api.auth.getCurrentUser, {});
    expect(user).not.toBeNull();
    expect(user!.name).toBe("AuthUser");
    expect(user!.email).toBe("auth@test.com");
  });

  test("returns null for unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const user = await t.query(api.auth.getCurrentUser, {});
    expect(user).toBeNull();
  });
});

describe("auth.getCurrentUserWithOrg (from auth.ts)", () => {
  test("returns user with their organizations", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, { name: "OrgUser", email: "orguser@test.com" });

    // Create org and membership
    await t.run(async (ctx: any) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "User's Org",
        slug: "users-org",
        createdAt: Date.now(),
        settings: { defaultRefreshFrequency: "daily" as const },
      });
      await ctx.db.insert("organizationMembers", {
        organizationId: orgId,
        userId,
        role: "owner",
        joinedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.query(api.auth.getCurrentUserWithOrg, {});
    expect(result).not.toBeNull();
    expect(result!.name).toBe("OrgUser");
    expect(result!.organizations.length).toBe(1);
    expect(result!.organizations[0]!.name).toBe("User's Org");
    expect(result!.organizations[0]!.role).toBe("owner");
  });
});
