import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Submit keyword proposal from public report (no auth required)
export const submitProposal = mutation({
  args: {
    reportToken: v.string(),
    phrase: v.string(),
    clientEmail: v.optional(v.string()),
    clientName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find report by token
    const report = await ctx.db
      .query("reports")
      .withIndex("by_token", (q) => q.eq("token", args.reportToken))
      .unique();

    if (!report) {
      throw new Error("Report not found");
    }

    if (report.expiresAt && report.expiresAt < Date.now()) {
      throw new Error("Report has expired");
    }

    if (!report.settings.allowKeywordProposals) {
      throw new Error("Keyword proposals are not allowed for this report");
    }

    // Get project to find organization
    const project = await ctx.db.get(report.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const team = await ctx.db.get(project.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Find or create anonymous client
    let clientId: Id<"clients"> | undefined;
    if (args.clientEmail) {
      const existingClient = await ctx.db
        .query("clients")
        .withIndex("by_email", (q) => q.eq("email", args.clientEmail!))
        .first();

      if (existingClient) {
        clientId = existingClient._id;
      } else {
        clientId = await ctx.db.insert("clients", {
          organizationId: team.organizationId,
          email: args.clientEmail,
          name: args.clientName || args.clientEmail.split("@")[0],
          hasAccount: false,
          createdAt: Date.now(),
        });
      }
    }

    // Create proposal
    return await ctx.db.insert("keywordProposals", {
      reportId: report._id,
      clientId: clientId!,
      phrase: args.phrase.toLowerCase().trim(),
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Get proposals for a report (authenticated)
export const getProposals = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const proposals = await ctx.db
      .query("keywordProposals")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();

    // Get client info for each proposal
    const proposalsWithClient = await Promise.all(
      proposals.map(async (proposal) => {
        const client = await ctx.db.get(proposal.clientId);
        return {
          ...proposal,
          clientName: client?.name || "Anonymous",
          clientEmail: client?.email,
        };
      })
    );

    return proposalsWithClient.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get all proposals for a project (across all reports)
export const getProjectProposals = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get all reports for this project
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get all proposals for these reports
    const allProposals = await Promise.all(
      reports.map(async (report) => {
        const proposals = await ctx.db
          .query("keywordProposals")
          .withIndex("by_report", (q) => q.eq("reportId", report._id))
          .collect();

        return Promise.all(
          proposals.map(async (proposal) => {
            const client = await ctx.db.get(proposal.clientId);
            return {
              ...proposal,
              clientName: client?.name || "Anonymous",
              clientEmail: client?.email,
              reportName: report.name,
            };
          })
        );
      })
    );

    return allProposals.flat().sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get pending proposals count for a project
export const getPendingProposalsCount = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    let count = 0;
    for (const report of reports) {
      const proposals = await ctx.db
        .query("keywordProposals")
        .withIndex("by_report", (q) => q.eq("reportId", report._id))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect();
      count += proposals.length;
    }

    return count;
  },
});

// Approve proposal (adds keyword to domain)
export const approveProposal = mutation({
  args: {
    proposalId: v.id("keywordProposals"),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) {
      throw new Error("Proposal not found");
    }

    // Check if keyword already exists
    const existing = await ctx.db
      .query("keywords")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .filter((q) => q.eq(q.field("phrase"), proposal.phrase))
      .unique();

    if (!existing) {
      // Add keyword
      await ctx.db.insert("keywords", {
        domainId: args.domainId,
        phrase: proposal.phrase,
        status: "active",
        createdAt: Date.now(),
        proposedBy: proposal.clientId,
      });
    }

    // Update proposal status
    const userId = identity.subject as Id<"users">;
    await ctx.db.patch(args.proposalId, {
      status: "approved",
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });

    return args.proposalId;
  },
});

// Reject proposal
export const rejectProposal = mutation({
  args: { proposalId: v.id("keywordProposals") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject as Id<"users">;
    await ctx.db.patch(args.proposalId, {
      status: "rejected",
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });

    return args.proposalId;
  },
});

// Bulk approve proposals
export const bulkApproveProposals = mutation({
  args: {
    proposalIds: v.array(v.id("keywordProposals")),
    domainId: v.id("domains"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject as Id<"users">;
    const results: Id<"keywordProposals">[] = [];

    for (const proposalId of args.proposalIds) {
      const proposal = await ctx.db.get(proposalId);
      if (!proposal) continue;

      // Check if keyword already exists
      const existing = await ctx.db
        .query("keywords")
        .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
        .filter((q) => q.eq(q.field("phrase"), proposal.phrase))
        .unique();

      if (!existing) {
        // Add keyword
        await ctx.db.insert("keywords", {
          domainId: args.domainId,
          phrase: proposal.phrase,
          status: "active",
          createdAt: Date.now(),
          proposedBy: proposal.clientId,
        });
      }

      // Update proposal status
      await ctx.db.patch(proposalId, {
        status: "approved",
        reviewedBy: userId,
        reviewedAt: Date.now(),
      });

      results.push(proposalId);
    }

    return results;
  },
});

// Bulk reject proposals
export const bulkRejectProposals = mutation({
  args: {
    proposalIds: v.array(v.id("keywordProposals")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject as Id<"users">;
    const results: Id<"keywordProposals">[] = [];

    for (const proposalId of args.proposalIds) {
      await ctx.db.patch(proposalId, {
        status: "rejected",
        reviewedBy: userId,
        reviewedAt: Date.now(),
      });
      results.push(proposalId);
    }

    return results;
  },
});
