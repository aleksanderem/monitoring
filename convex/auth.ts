import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (existingUserId) {
        // User already exists, no need to create org
        return;
      }

      // Cast userId to the correct type
      const typedUserId = userId as Id<"users">;

      // Check if user already has an organization
      const existingMembership = await ctx.db
        .query("organizationMembers")
        .filter((q) => q.eq(q.field("userId"), typedUserId))
        .first();

      if (existingMembership) return;

      // Get the user that was just created by Convex Auth
      const authUser = await ctx.db.get(typedUserId);
      if (!authUser) return;

      // Create organization for new user
      const email = (authUser as any).email || "user";
      const name = (authUser as any).name || email.split("@")[0];
      const orgSlug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");

      const orgId = await ctx.db.insert("organizations", {
        name: `${name}'s Organization`,
        slug: orgSlug + "-" + Date.now(),
        createdAt: Date.now(),
        settings: {
          defaultRefreshFrequency: "daily",
        },
      });

      // Make user the owner
      await ctx.db.insert("organizationMembers", {
        organizationId: orgId,
        userId: typedUserId,
        role: "owner",
        joinedAt: Date.now(),
      });

      // Create default team
      const teamId = await ctx.db.insert("teams", {
        organizationId: orgId,
        name: "Default Team",
        createdAt: Date.now(),
      });

      // Add user to default team
      await ctx.db.insert("teamMembers", {
        teamId: teamId,
        userId: typedUserId,
        joinedAt: Date.now(),
      });
    },
  },
});

// Get current user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});

// Get current user with organization
export const getCurrentUserWithOrg = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) return null;

    // Get user's organizations
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const organizations = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.organizationId);
        return org ? { ...org, role: m.role } : null;
      })
    );

    return {
      ...user,
      organizations: organizations.filter(Boolean),
    };
  },
});
