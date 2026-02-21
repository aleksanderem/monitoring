import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupHierarchy(t: any, userId: string) {
  const orgId = await t.run(async (ctx: any) => {
    return ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      settings: { defaultRefreshFrequency: "weekly" as const },
    });
  });
  await t.run(async (ctx: any) => {
    await ctx.db.insert("organizationMembers", {
      organizationId: orgId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });
  const teamId = await t.run(async (ctx: any) => {
    return ctx.db.insert("teams", {
      organizationId: orgId,
      name: "Team",
      createdAt: Date.now(),
    });
  });
  await t.run(async (ctx: any) => {
    await ctx.db.insert("teamMembers", {
      teamId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
  });
  const projectId = await t.run(async (ctx: any) => {
    return ctx.db.insert("projects", {
      teamId,
      name: "Project",
      createdAt: Date.now(),
    });
  });
  return { orgId, teamId, projectId };
}

const DEFAULT_SETTINGS = {
  refreshFrequency: "weekly" as const,
  searchEngine: "google.com",
  location: "Poland",
  language: "pl",
};

async function createDomainAndReport(t: any, projectId: string) {
  const domainId = await t.run(async (ctx: any) => {
    return ctx.db.insert("domains", {
      projectId,
      domain: "example.com",
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    });
  });

  const reportId = await t.run(async (ctx: any) => {
    return ctx.db.insert("reports", {
      projectId,
      token: "test-token-123",
      name: "Test Report",
      createdAt: Date.now(),
      settings: {
        domainsIncluded: [domainId],
        showSearchVolume: true,
        showDifficulty: true,
        allowKeywordProposals: true,
      },
    });
  });

  return { domainId, reportId };
}

// ---------------------------------------------------------------------------
// getMessages (public query)
// ---------------------------------------------------------------------------

describe("getMessages", () => {
  test("returns messages for a report by reportId", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);

    // Insert messages
    await t.run(async (ctx) => {
      await ctx.db.insert("messages", {
        reportId,
        authorType: "user",
        authorId: userId,
        content: "Hello from team",
        createdAt: Date.now() - 1000,
      });
      await ctx.db.insert("messages", {
        reportId,
        authorType: "user",
        authorId: userId,
        content: "Follow up",
        createdAt: Date.now(),
      });
    });

    const messages = await t.query(api.messages.getMessages, { reportId });
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("Hello from team");
    expect(messages[1].content).toBe("Follow up");
    expect(messages[0].authorName).toBe("User");
  });

  test("returns messages for a report by token", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);

    await t.run(async (ctx) => {
      await ctx.db.insert("messages", {
        reportId,
        authorType: "user",
        authorId: userId,
        content: "Token message",
        createdAt: Date.now(),
      });
    });

    const messages = await t.query(api.messages.getMessages, { reportToken: "test-token-123" });
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Token message");
  });

  test("throws when token not found", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.query(api.messages.getMessages, { reportToken: "nonexistent" })
    ).rejects.toThrow("Report not found");
  });

  test("throws when report has expired", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("reports", {
        projectId,
        token: "expired-token",
        name: "Expired Report",
        createdAt: Date.now() - 100000,
        expiresAt: Date.now() - 50000,
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true,
          showDifficulty: true,
          allowKeywordProposals: true,
        },
      });
    });

    await expect(
      t.query(api.messages.getMessages, { reportToken: "expired-token" })
    ).rejects.toThrow("Report has expired");
  });

  test("throws when neither reportId nor token provided", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.query(api.messages.getMessages, {})
    ).rejects.toThrow("Report ID or token required");
  });

  test("resolves client author names", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);

    const clientId = await t.run(async (ctx) => {
      return ctx.db.insert("clients", {
        organizationId: orgId,
        email: "client@test.com",
        name: "Test Client",
        hasAccount: false,
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("messages", {
        reportId,
        authorType: "client",
        authorId: clientId,
        content: "Client message",
        createdAt: Date.now(),
      });
    });

    const messages = await t.query(api.messages.getMessages, { reportId });
    expect(messages).toHaveLength(1);
    expect(messages[0].authorName).toBe("Test Client");
  });

  test("returns sorted messages by createdAt", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);

    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("messages", {
        reportId,
        authorType: "user",
        authorId: userId,
        content: "Second",
        createdAt: now + 1000,
      });
      await ctx.db.insert("messages", {
        reportId,
        authorType: "user",
        authorId: userId,
        content: "First",
        createdAt: now,
      });
    });

    const messages = await t.query(api.messages.getMessages, { reportId });
    expect(messages[0].content).toBe("First");
    expect(messages[1].content).toBe("Second");
  });
});

// ---------------------------------------------------------------------------
// sendUserMessage (mutation - requires auth)
// ---------------------------------------------------------------------------

describe("sendUserMessage", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);

    await expect(
      t.mutation(api.messages.sendUserMessage, {
        reportId,
        content: "Hello",
      })
    ).rejects.toThrow("Not authenticated");
  });

  test("creates a message when authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);

    const asUser = t.withIdentity({ subject: userId });
    const messageId = await asUser.mutation(
      api.messages.sendUserMessage,
      { reportId, content: "  Hello world  " },
    );

    expect(messageId).toBeDefined();

    const msg = await t.run(async (ctx) => ctx.db.get(messageId));
    expect(msg!.content).toBe("Hello world");
    expect(msg!.authorType).toBe("user");
    expect(msg!.authorId).toBe(userId);
  });
});

// ---------------------------------------------------------------------------
// sendClientMessage (mutation)
// ---------------------------------------------------------------------------

describe("sendClientMessage", () => {
  test("throws when token is invalid", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.messages.sendClientMessage, {
        reportToken: "bad-token",
        content: "Hi",
        clientEmail: "c@t.com",
      })
    ).rejects.toThrow("Report not found");
  });

  test("throws when report is expired", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId,
        domain: "example.com",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("reports", {
        projectId,
        token: "expired-client-token",
        name: "Expired",
        createdAt: Date.now() - 100000,
        expiresAt: Date.now() - 50000,
        settings: {
          domainsIncluded: [domainId],
          showSearchVolume: true,
          showDifficulty: true,
          allowKeywordProposals: true,
        },
      });
    });

    await expect(
      t.mutation(api.messages.sendClientMessage, {
        reportToken: "expired-client-token",
        content: "Hi",
        clientEmail: "c@t.com",
      })
    ).rejects.toThrow("Report has expired");
  });

  test("creates client and message for new email", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);

    const messageId = await t.mutation(api.messages.sendClientMessage, {
      reportToken: "test-token-123",
      content: "  Client says hi  ",
      clientEmail: "new@client.com",
      clientName: "New Client",
    });

    expect(messageId).toBeDefined();

    const msg = await t.run(async (ctx) => ctx.db.get(messageId));
    expect(msg!.content).toBe("Client says hi");
    expect(msg!.authorType).toBe("client");
    expect(msg!.reportId).toEqual(reportId);

    // Client should have been created
    const client = await t.run(async (ctx) => {
      return ctx.db
        .query("clients")
        .withIndex("by_email", (q: any) => q.eq("email", "new@client.com"))
        .first();
    });
    expect(client).not.toBeNull();
    expect(client!.name).toBe("New Client");
    expect(client!.organizationId).toEqual(orgId);
  });

  test("reuses existing client for same email", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    await createDomainAndReport(t, projectId);

    // Pre-create the client
    const existingClientId = await t.run(async (ctx) => {
      return ctx.db.insert("clients", {
        organizationId: orgId,
        email: "existing@client.com",
        name: "Existing",
        hasAccount: false,
        createdAt: Date.now(),
      });
    });

    await t.mutation(api.messages.sendClientMessage, {
      reportToken: "test-token-123",
      content: "Hi again",
      clientEmail: "existing@client.com",
    });

    // Should still have only one client record
    const clients = await t.run(async (ctx) => {
      return ctx.db
        .query("clients")
        .withIndex("by_email", (q: any) => q.eq("email", "existing@client.com"))
        .collect();
    });
    expect(clients).toHaveLength(1);
    expect(clients[0]._id).toEqual(existingClientId);
  });
});

// ---------------------------------------------------------------------------
// getUnreadMessageCount (public query - requires auth)
// ---------------------------------------------------------------------------

describe("getUnreadMessageCount", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    await expect(
      t.query(api.messages.getUnreadMessageCount, { projectId })
    ).rejects.toThrow("Not authenticated");
  });

  test("returns count of client messages for project", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);

    const clientId = await t.run(async (ctx) => {
      return ctx.db.insert("clients", {
        organizationId: orgId,
        email: "c@t.com",
        name: "Client",
        hasAccount: false,
        createdAt: Date.now(),
      });
    });

    // Insert client messages and user messages
    await t.run(async (ctx) => {
      await ctx.db.insert("messages", {
        reportId,
        authorType: "client",
        authorId: clientId,
        content: "Client msg 1",
        createdAt: Date.now(),
      });
      await ctx.db.insert("messages", {
        reportId,
        authorType: "client",
        authorId: clientId,
        content: "Client msg 2",
        createdAt: Date.now(),
      });
      await ctx.db.insert("messages", {
        reportId,
        authorType: "user",
        authorId: userId,
        content: "User msg",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const count = await asUser.query(
      api.messages.getUnreadMessageCount,
      { projectId },
    );

    expect(count).toBe(2);
  });

  test("returns zero when no client messages", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { name: "User", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const asUser = t.withIdentity({ subject: userId });
    const count = await asUser.query(
      api.messages.getUnreadMessageCount,
      { projectId },
    );

    expect(count).toBe(0);
  });
});
