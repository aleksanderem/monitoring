import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * Helper: create full hierarchy (user -> org -> orgMember -> team -> project -> domain)
 * with keywords pre-inserted.
 */
async function setupWithKeywords(t: ReturnType<typeof convexTest>, keywordPhrases: string[]) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
    } as any);
  });

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "daily" as const },
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });

  const teamId = await t.run(async (ctx) => {
    return await ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Test Team",
      createdAt: Date.now(),
    });
  });

  const projectId = await t.run(async (ctx) => {
    return await ctx.db.insert("projects", {
      teamId,
      name: "Test Project",
      createdAt: Date.now(),
    });
  });

  const domainId = await t.run(async (ctx) => {
    return await ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
      createdAt: Date.now(),
      settings: {
        refreshFrequency: "daily" as const,
        searchEngine: "google",
        location: "US",
        language: "en",
      },
    });
  });

  const asUser = t.withIdentity({ subject: userId });

  // Insert keywords
  const keywordIds = await asUser.mutation(api.keywords.addKeywords, {
    domainId,
    phrases: keywordPhrases,
  });

  return { userId, orgId, teamId, projectId, domainId, keywordIds, asUser };
}

// =============================================
// createGroup
// =============================================

describe("createGroup", () => {
  test("creates a new keyword group for domain", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupWithKeywords(t, ["kw1"]);

    const groupId = await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "Branded Keywords",
      description: "All brand-related keywords",
      color: "#FF5733",
    });

    expect(groupId).toBeTruthy();

    const groups = await asUser.query(api.keywordGroups_queries.getGroupsByDomain, { domainId });
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Branded Keywords");
    expect(groups[0].color).toBe("#FF5733");
    expect(groups[0].keywordCount).toBe(0);
  });

  test("rejects duplicate group name within same domain", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupWithKeywords(t, []);

    await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "SEO Group",
      color: "#000000",
    });

    await expect(
      asUser.mutation(api.keywordGroups_mutations.createGroup, {
        domainId,
        name: "SEO Group",
        color: "#111111",
      })
    ).rejects.toThrow("A group with this name already exists");
  });
});

// =============================================
// addKeywordsToGroup / removeKeywordsFromGroup
// =============================================

describe("addKeywordsToGroup", () => {
  test("assigns keywords to group and shows in getKeywordsByGroup", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId, keywordIds } = await setupWithKeywords(t, [
      "seo tools",
      "rank tracker",
      "backlink checker",
    ]);

    const groupId = await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "SEO Tools",
      color: "#00FF00",
    });

    // Add first two keywords to the group
    const result = await asUser.mutation(api.keywordGroups_mutations.addKeywordsToGroup, {
      groupId,
      keywordIds: [keywordIds[0], keywordIds[1]],
    });

    expect(result.added).toBe(2);

    // Query keywords by group
    const grouped = await asUser.query(api.keywordGroups_queries.getKeywordsByGroup, { groupId });
    expect(grouped).toHaveLength(2);
    const phrases = grouped.map((k: any) => k.phrase).sort();
    expect(phrases).toEqual(["rank tracker", "seo tools"]);
  });

  test("does not add same keyword twice (idempotent)", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId, keywordIds } = await setupWithKeywords(t, ["dedup test"]);

    const groupId = await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "Test Group",
      color: "#AABBCC",
    });

    await asUser.mutation(api.keywordGroups_mutations.addKeywordsToGroup, {
      groupId,
      keywordIds: [keywordIds[0]],
    });

    // Add same keyword again
    const result = await asUser.mutation(api.keywordGroups_mutations.addKeywordsToGroup, {
      groupId,
      keywordIds: [keywordIds[0]],
    });

    expect(result.added).toBe(0);

    const grouped = await asUser.query(api.keywordGroups_queries.getKeywordsByGroup, { groupId });
    expect(grouped).toHaveLength(1);
  });
});

describe("removeKeywordsFromGroup", () => {
  test("removes keyword from group while keeping the keyword", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId, keywordIds } = await setupWithKeywords(t, [
      "alpha",
      "beta",
      "gamma",
    ]);

    const groupId = await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "Mixed",
      color: "#112233",
    });

    await asUser.mutation(api.keywordGroups_mutations.addKeywordsToGroup, {
      groupId,
      keywordIds: [keywordIds[0], keywordIds[1], keywordIds[2]],
    });

    // Remove beta from the group
    const result = await asUser.mutation(api.keywordGroups_mutations.removeKeywordsFromGroup, {
      groupId,
      keywordIds: [keywordIds[1]],
    });

    expect(result.removed).toBe(1);

    const grouped = await asUser.query(api.keywordGroups_queries.getKeywordsByGroup, { groupId });
    expect(grouped).toHaveLength(2);
    const phrases = grouped.map((k: any) => k.phrase).sort();
    expect(phrases).toEqual(["alpha", "gamma"]);

    // The keyword itself should still exist in the domain
    const allKeywords = await asUser.query(api.keywords.getKeywords, { domainId });
    expect(allKeywords).toHaveLength(3);
  });
});

// =============================================
// getGroupsForKeyword
// =============================================

describe("getGroupsForKeyword", () => {
  test("returns all groups a keyword belongs to", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId, keywordIds } = await setupWithKeywords(t, ["multi-group keyword"]);

    const group1 = await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "Group A",
      color: "#AA0000",
    });

    const group2 = await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "Group B",
      color: "#00BB00",
    });

    await asUser.mutation(api.keywordGroups_mutations.addKeywordsToGroup, {
      groupId: group1,
      keywordIds: [keywordIds[0]],
    });

    await asUser.mutation(api.keywordGroups_mutations.addKeywordsToGroup, {
      groupId: group2,
      keywordIds: [keywordIds[0]],
    });

    const groups = await asUser.query(api.keywordGroups_queries.getGroupsForKeyword, {
      keywordId: keywordIds[0],
    });

    expect(groups).toHaveLength(2);
    const names = groups.map((g: any) => g.name).sort();
    expect(names).toEqual(["Group A", "Group B"]);
  });
});

// =============================================
// getGroupsByDomain (with keyword counts)
// =============================================

describe("getGroupsByDomain", () => {
  test("returns groups with correct keyword counts", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId, keywordIds } = await setupWithKeywords(t, [
      "kw1",
      "kw2",
      "kw3",
    ]);

    const group1 = await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "Small Group",
      color: "#111111",
    });

    const group2 = await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "Big Group",
      color: "#222222",
    });

    await asUser.mutation(api.keywordGroups_mutations.addKeywordsToGroup, {
      groupId: group1,
      keywordIds: [keywordIds[0]],
    });

    await asUser.mutation(api.keywordGroups_mutations.addKeywordsToGroup, {
      groupId: group2,
      keywordIds: [keywordIds[0], keywordIds[1], keywordIds[2]],
    });

    const groups = await asUser.query(api.keywordGroups_queries.getGroupsByDomain, { domainId });
    expect(groups).toHaveLength(2);

    const small = groups.find((g: any) => g.name === "Small Group");
    const big = groups.find((g: any) => g.name === "Big Group");
    expect(small?.keywordCount).toBe(1);
    expect(big?.keywordCount).toBe(3);
  });
});

// =============================================
// deleteGroup
// =============================================

describe("deleteGroup", () => {
  test("deletes group and its memberships, keywords remain", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId, keywordIds } = await setupWithKeywords(t, [
      "persistent keyword",
    ]);

    const groupId = await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "Doomed Group",
      color: "#FF0000",
    });

    await asUser.mutation(api.keywordGroups_mutations.addKeywordsToGroup, {
      groupId,
      keywordIds: [keywordIds[0]],
    });

    // Delete the group
    await asUser.mutation(api.keywordGroups_mutations.deleteGroup, { groupId });

    // Group should be gone
    const groups = await asUser.query(api.keywordGroups_queries.getGroupsByDomain, { domainId });
    expect(groups).toHaveLength(0);

    // Memberships should be gone
    const memberships = await t.run(async (ctx) => {
      return await ctx.db
        .query("keywordGroupMemberships")
        .withIndex("by_group", (q: any) => q.eq("groupId", groupId))
        .collect();
    });
    expect(memberships).toHaveLength(0);

    // Keyword should still exist
    const keywords = await asUser.query(api.keywords.getKeywords, { domainId });
    expect(keywords).toHaveLength(1);
    expect(keywords[0].phrase).toBe("persistent keyword");
  });
});

// =============================================
// updateGroup
// =============================================

describe("updateGroup", () => {
  test("updates group name and color", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupWithKeywords(t, []);

    const groupId = await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "Old Name",
      color: "#000000",
    });

    await asUser.mutation(api.keywordGroups_mutations.updateGroup, {
      groupId,
      name: "New Name",
      color: "#FFFFFF",
    });

    const groups = await asUser.query(api.keywordGroups_queries.getGroupsByDomain, { domainId });
    expect(groups[0].name).toBe("New Name");
    expect(groups[0].color).toBe("#FFFFFF");
  });

  test("rejects update to existing name", async () => {
    const t = convexTest(schema, modules);
    const { asUser, domainId } = await setupWithKeywords(t, []);

    await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "Group One",
      color: "#111111",
    });

    const groupId2 = await asUser.mutation(api.keywordGroups_mutations.createGroup, {
      domainId,
      name: "Group Two",
      color: "#222222",
    });

    await expect(
      asUser.mutation(api.keywordGroups_mutations.updateGroup, {
        groupId: groupId2,
        name: "Group One",
      })
    ).rejects.toThrow("A group with this name already exists");
  });
});

// =============================================
// bulkTagKeywords
// =============================================

describe("bulkTagKeywords", () => {
  test("adds tags to multiple keywords", async () => {
    const t = convexTest(schema, modules);
    const { asUser, keywordIds } = await setupWithKeywords(t, ["tag-test-1", "tag-test-2"]);

    const result = await asUser.mutation(api.keywordGroups_mutations.bulkTagKeywords, {
      keywordIds: [keywordIds[0], keywordIds[1]],
      tags: ["branded", "priority"],
    });

    expect(result.updated).toBe(2);

    const kw = await t.run(async (ctx) => {
      return await ctx.db.get(keywordIds[0]);
    });
    expect(kw?.tags).toEqual(expect.arrayContaining(["branded", "priority"]));
  });

  test("merges tags without duplicates", async () => {
    const t = convexTest(schema, modules);
    const { asUser, keywordIds } = await setupWithKeywords(t, ["merge-tag"]);

    // First tag
    await asUser.mutation(api.keywordGroups_mutations.bulkTagKeywords, {
      keywordIds: [keywordIds[0]],
      tags: ["existing-tag"],
    });

    // Add another tag (+ repeat existing)
    await asUser.mutation(api.keywordGroups_mutations.bulkTagKeywords, {
      keywordIds: [keywordIds[0]],
      tags: ["existing-tag", "new-tag"],
    });

    const kw = await t.run(async (ctx) => {
      return await ctx.db.get(keywordIds[0]);
    });
    expect(kw?.tags).toHaveLength(2);
    expect(kw?.tags).toEqual(expect.arrayContaining(["existing-tag", "new-tag"]));
  });
});

// =============================================
// removeTagFromKeywords
// =============================================

describe("removeTagFromKeywords", () => {
  test("removes a specific tag from keywords", async () => {
    const t = convexTest(schema, modules);
    const { asUser, keywordIds } = await setupWithKeywords(t, ["remove-tag-test"]);

    await asUser.mutation(api.keywordGroups_mutations.bulkTagKeywords, {
      keywordIds: [keywordIds[0]],
      tags: ["keep-me", "remove-me"],
    });

    const result = await asUser.mutation(api.keywordGroups_mutations.removeTagFromKeywords, {
      keywordIds: [keywordIds[0]],
      tag: "remove-me",
    });

    expect(result.updated).toBe(1);

    const kw = await t.run(async (ctx) => {
      return await ctx.db.get(keywordIds[0]);
    });
    expect(kw?.tags).toEqual(["keep-me"]);
  });
});
