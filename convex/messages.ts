import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Get messages for a report (authenticated or by token)
export const getMessages = query({
  args: {
    reportId: v.optional(v.id("reports")),
    reportToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let reportId = args.reportId;

    // If token provided, find report by token
    if (args.reportToken) {
      const report = await ctx.db
        .query("reports")
        .withIndex("by_token", (q) => q.eq("token", args.reportToken!))
        .unique();

      if (!report) {
        throw new Error("Report not found");
      }

      if (report.expiresAt && report.expiresAt < Date.now()) {
        throw new Error("Report has expired");
      }

      reportId = report._id;
    }

    if (!reportId) {
      throw new Error("Report ID or token required");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_report", (q) => q.eq("reportId", reportId!))
      .collect();

    // Get author info for each message
    const messagesWithAuthors = await Promise.all(
      messages.map(async (message) => {
        let authorName = "Unknown";

        if (message.authorType === "user") {
          const user = await ctx.db.get(message.authorId as Id<"users">);
          authorName = user?.name || user?.email || "Team Member";
        } else if (message.authorType === "client") {
          const client = await ctx.db.get(message.authorId as Id<"clients">);
          authorName = client?.name || "Client";
        }

        return {
          ...message,
          authorName,
        };
      })
    );

    return messagesWithAuthors.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// Send message from authenticated user
export const sendUserMessage = mutation({
  args: {
    reportId: v.id("reports"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    return await ctx.db.insert("messages", {
      reportId: args.reportId,
      authorType: "user",
      authorId: userId,
      content: args.content.trim(),
      createdAt: Date.now(),
    });
  },
});

// Send message from public report (client)
export const sendClientMessage = mutation({
  args: {
    reportToken: v.string(),
    content: v.string(),
    clientEmail: v.string(),
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

    // Get project to find organization
    const project = await ctx.db.get(report.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const team = await ctx.db.get(project.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Find or create client
    let client = await ctx.db
      .query("clients")
      .withIndex("by_email", (q) => q.eq("email", args.clientEmail))
      .first();

    if (!client) {
      const clientId = await ctx.db.insert("clients", {
        organizationId: team.organizationId,
        email: args.clientEmail,
        name: args.clientName || args.clientEmail.split("@")[0],
        hasAccount: false,
        createdAt: Date.now(),
      });
      client = await ctx.db.get(clientId);
    }

    if (!client) {
      throw new Error("Failed to create client");
    }

    return await ctx.db.insert("messages", {
      reportId: report._id,
      authorType: "client",
      authorId: client._id,
      content: args.content.trim(),
      createdAt: Date.now(),
    });
  },
});

// Get unread message count for a project (authenticated)
export const getUnreadMessageCount = query({
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
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_report", (q) => q.eq("reportId", report._id))
        .filter((q) => q.eq(q.field("authorType"), "client"))
        .collect();
      count += messages.length;
    }

    return count;
  },
});
