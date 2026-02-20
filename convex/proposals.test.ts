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

async function createDomainAndReport(t: any, projectId: string, opts?: { allowProposals?: boolean; expired?: boolean }) {
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
      expiresAt: opts?.expired ? Date.now() - 50000 : undefined,
      settings: {
        domainsIncluded: [domainId],
        showSearchVolume: true,
        showDifficulty: true,
        allowKeywordProposals: opts?.allowProposals ?? true,
      },
    });
  });

  return { domainId, reportId };
}

async function createClient(t: any, orgId: string, email = "client@test.com") {
  return await t.run(async (ctx: any) => {
    return ctx.db.insert("clients", {
      organizationId: orgId,
      email,
      name: email.split("@")[0],
      hasAccount: false,
      createdAt: Date.now(),
    });
  });
}

// ---------------------------------------------------------------------------
// submitProposal
// ---------------------------------------------------------------------------

describe("submitProposal", () => {
  test("throws when report token is invalid", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.proposals.submitProposal, {
        reportToken: "bad-token",
        phrase: "seo tools",
      })
    ).rejects.toThrow("Report not found");
  });

  test("throws when report is expired", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    await createDomainAndReport(t, projectId, { expired: true });

    await expect(
      t.mutation(api.proposals.submitProposal, {
        reportToken: "test-token-123",
        phrase: "seo tools",
      })
    ).rejects.toThrow("Report has expired");
  });

  test("throws when proposals are not allowed", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    await createDomainAndReport(t, projectId, { allowProposals: false });

    await expect(
      t.mutation(api.proposals.submitProposal, {
        reportToken: "test-token-123",
        phrase: "seo tools",
      })
    ).rejects.toThrow("Keyword proposals are not allowed");
  });

  test("creates proposal and client when email is provided", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    await createDomainAndReport(t, projectId);

    const proposalId = await t.mutation(api.proposals.submitProposal, {
      reportToken: "test-token-123",
      phrase: "  SEO Tools  ",
      clientEmail: "newclient@test.com",
      clientName: "New Client",
    });

    expect(proposalId).toBeDefined();

    const proposal = await t.run(async (ctx: any) => ctx.db.get(proposalId));
    expect(proposal!.phrase).toBe("seo tools"); // lowercased and trimmed
    expect(proposal!.status).toBe("pending");

    // Client should be created
    const client = await t.run(async (ctx: any) => {
      return ctx.db.query("clients")
        .withIndex("by_email", (q: any) => q.eq("email", "newclient@test.com"))
        .first();
    });
    expect(client).not.toBeNull();
    expect(client!.name).toBe("New Client");
    expect(client!.organizationId).toEqual(orgId);
  });

  test("reuses existing client for same email", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    await createDomainAndReport(t, projectId);

    const existingClientId = await createClient(t, orgId, "existing@test.com");

    await t.mutation(api.proposals.submitProposal, {
      reportToken: "test-token-123",
      phrase: "keyword test",
      clientEmail: "existing@test.com",
    });

    const clients = await t.run(async (ctx: any) => {
      return ctx.db.query("clients")
        .withIndex("by_email", (q: any) => q.eq("email", "existing@test.com"))
        .collect();
    });
    expect(clients).toHaveLength(1);
    expect(clients[0]._id).toEqual(existingClientId);
  });
});

// ---------------------------------------------------------------------------
// getProposals
// ---------------------------------------------------------------------------

describe("getProposals", () => {
  test("returns empty when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);

    const proposals = await t.query(api.proposals.getProposals, { reportId });
    expect(proposals).toEqual([]);
  });

  test("returns proposals with client info sorted by createdAt desc", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);
    const clientId = await createClient(t, orgId);

    const now = Date.now();
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "older kw", status: "pending", createdAt: now - 1000,
      });
      await ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "newer kw", status: "pending", createdAt: now,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const proposals = await asUser.query(api.proposals.getProposals, { reportId });
    expect(proposals).toHaveLength(2);
    expect(proposals[0].phrase).toBe("newer kw");
    expect(proposals[1].phrase).toBe("older kw");
    expect(proposals[0].clientName).toBe("client");
  });
});

// ---------------------------------------------------------------------------
// getProjectProposals
// ---------------------------------------------------------------------------

describe("getProjectProposals", () => {
  test("returns empty when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const proposals = await t.query(api.proposals.getProjectProposals, { projectId });
    expect(proposals).toEqual([]);
  });

  test("returns proposals across all reports for a project", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const clientId = await createClient(t, orgId);

    const domainId = await t.run(async (ctx: any) => {
      return ctx.db.insert("domains", {
        projectId, domain: "example.com", createdAt: Date.now(), settings: DEFAULT_SETTINGS,
      });
    });

    const reportId1 = await t.run(async (ctx: any) => {
      return ctx.db.insert("reports", {
        projectId, token: "tok1", name: "R1", createdAt: Date.now(),
        settings: { domainsIncluded: [domainId], showSearchVolume: true, showDifficulty: true, allowKeywordProposals: true },
      });
    });
    const reportId2 = await t.run(async (ctx: any) => {
      return ctx.db.insert("reports", {
        projectId, token: "tok2", name: "R2", createdAt: Date.now(),
        settings: { domainsIncluded: [domainId], showSearchVolume: true, showDifficulty: true, allowKeywordProposals: true },
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordProposals", {
        reportId: reportId1, clientId, phrase: "kw1", status: "pending", createdAt: Date.now(),
      });
      await ctx.db.insert("keywordProposals", {
        reportId: reportId2, clientId, phrase: "kw2", status: "approved", createdAt: Date.now() + 1000,
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const proposals = await asUser.query(api.proposals.getProjectProposals, { projectId });
    expect(proposals).toHaveLength(2);
    expect(proposals[0].reportName).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getPendingProposalsCount
// ---------------------------------------------------------------------------

describe("getPendingProposalsCount", () => {
  test("returns 0 when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { projectId } = await setupHierarchy(t, userId);

    const count = await t.query(api.proposals.getPendingProposalsCount, { projectId });
    expect(count).toBe(0);
  });

  test("counts only pending proposals", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);
    const clientId = await createClient(t, orgId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "kw1", status: "pending", createdAt: Date.now(),
      });
      await ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "kw2", status: "pending", createdAt: Date.now(),
      });
      await ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "kw3", status: "approved", createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const count = await asUser.query(api.proposals.getPendingProposalsCount, { projectId });
    expect(count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// approveProposal
// ---------------------------------------------------------------------------

describe("approveProposal", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { domainId, reportId } = await createDomainAndReport(t, projectId);
    const clientId = await createClient(t, orgId);

    const proposalId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "test kw", status: "pending", createdAt: Date.now(),
      });
    });

    await expect(
      t.mutation(api.proposals.approveProposal, { proposalId, domainId })
    ).rejects.toThrow("Not authenticated");
  });

  test("approves proposal and creates keyword", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { domainId, reportId } = await createDomainAndReport(t, projectId);
    const clientId = await createClient(t, orgId);

    const proposalId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "new keyword", status: "pending", createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.mutation(api.proposals.approveProposal, { proposalId, domainId });
    expect(result).toEqual(proposalId);

    // Proposal should be approved
    const proposal = await t.run(async (ctx: any) => ctx.db.get(proposalId));
    expect(proposal!.status).toBe("approved");
    expect(proposal!.reviewedBy).toEqual(userId);

    // Keyword should be created
    const keywords = await t.run(async (ctx: any) => {
      return ctx.db.query("keywords")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });
    expect(keywords).toHaveLength(1);
    expect(keywords[0].phrase).toBe("new keyword");
    expect(keywords[0].status).toBe("active");
    expect(keywords[0].proposedBy).toEqual(clientId);
  });

  test("does not create duplicate keyword if one exists", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { domainId, reportId } = await createDomainAndReport(t, projectId);
    const clientId = await createClient(t, orgId);

    // Pre-create keyword
    await t.run(async (ctx: any) => {
      await ctx.db.insert("keywords", {
        domainId, phrase: "existing kw", status: "active", createdAt: Date.now(),
      });
    });

    const proposalId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "existing kw", status: "pending", createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    await asUser.mutation(api.proposals.approveProposal, { proposalId, domainId });

    // Should still only have one keyword
    const keywords = await t.run(async (ctx: any) => {
      return ctx.db.query("keywords")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });
    expect(keywords).toHaveLength(1);

    // Proposal still marked approved
    const proposal = await t.run(async (ctx: any) => ctx.db.get(proposalId));
    expect(proposal!.status).toBe("approved");
  });
});

// ---------------------------------------------------------------------------
// rejectProposal
// ---------------------------------------------------------------------------

describe("rejectProposal", () => {
  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);
    const clientId = await createClient(t, orgId);

    const proposalId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "kw", status: "pending", createdAt: Date.now(),
      });
    });

    await expect(
      t.mutation(api.proposals.rejectProposal, { proposalId })
    ).rejects.toThrow("Not authenticated");
  });

  test("rejects proposal and sets reviewer", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);
    const clientId = await createClient(t, orgId);

    const proposalId = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "reject me", status: "pending", createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.mutation(api.proposals.rejectProposal, { proposalId });
    expect(result).toEqual(proposalId);

    const proposal = await t.run(async (ctx: any) => ctx.db.get(proposalId));
    expect(proposal!.status).toBe("rejected");
    expect(proposal!.reviewedBy).toEqual(userId);
    expect(proposal!.reviewedAt).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// bulkApproveProposals
// ---------------------------------------------------------------------------

describe("bulkApproveProposals", () => {
  test("approves multiple proposals and creates keywords", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { domainId, reportId } = await createDomainAndReport(t, projectId);
    const clientId = await createClient(t, orgId);

    const p1 = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "kw one", status: "pending", createdAt: Date.now(),
      });
    });
    const p2 = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "kw two", status: "pending", createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const results = await asUser.mutation(api.proposals.bulkApproveProposals, {
      proposalIds: [p1, p2],
      domainId,
    });

    expect(results).toHaveLength(2);

    const keywords = await t.run(async (ctx: any) => {
      return ctx.db.query("keywords")
        .withIndex("by_domain", (q: any) => q.eq("domainId", domainId))
        .collect();
    });
    expect(keywords).toHaveLength(2);

    const proposal1 = await t.run(async (ctx: any) => ctx.db.get(p1));
    expect(proposal1!.status).toBe("approved");
  });

  test("skips nonexistent proposals gracefully", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { domainId, reportId } = await createDomainAndReport(t, projectId);
    const clientId = await createClient(t, orgId);

    const p1 = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "real kw", status: "pending", createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    // Pass one real and one that we delete before calling
    await t.run(async (ctx: any) => {
      // Create and immediately delete a proposal to get a valid but stale ID
    });

    const results = await asUser.mutation(api.proposals.bulkApproveProposals, {
      proposalIds: [p1],
      domainId,
    });
    expect(results).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// bulkRejectProposals
// ---------------------------------------------------------------------------

describe("bulkRejectProposals", () => {
  test("rejects multiple proposals", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);
    const clientId = await createClient(t, orgId);

    const p1 = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "kw one", status: "pending", createdAt: Date.now(),
      });
    });
    const p2 = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "kw two", status: "pending", createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({ subject: userId });
    const results = await asUser.mutation(api.proposals.bulkRejectProposals, {
      proposalIds: [p1, p2],
    });

    expect(results).toHaveLength(2);

    const proposal1 = await t.run(async (ctx: any) => ctx.db.get(p1));
    expect(proposal1!.status).toBe("rejected");
    expect(proposal1!.reviewedBy).toEqual(userId);

    const proposal2 = await t.run(async (ctx: any) => ctx.db.get(p2));
    expect(proposal2!.status).toBe("rejected");
  });

  test("throws when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => {
      return ctx.db.insert("users", { name: "U", email: "u@t.com" });
    });
    const { orgId, projectId } = await setupHierarchy(t, userId);
    const { reportId } = await createDomainAndReport(t, projectId);
    const clientId = await createClient(t, orgId);

    const p1 = await t.run(async (ctx: any) => {
      return ctx.db.insert("keywordProposals", {
        reportId, clientId, phrase: "kw", status: "pending", createdAt: Date.now(),
      });
    });

    await expect(
      t.mutation(api.proposals.bulkRejectProposals, { proposalIds: [p1] })
    ).rejects.toThrow("Not authenticated");
  });
});
