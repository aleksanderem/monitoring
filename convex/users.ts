import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

/**
 * Get current user's profile information with role from team memberships
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    // Get user's primary team role (first team membership)
    const teamMembership = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      ...user,
      role: teamMembership?.role || "member",
      joinedAt: teamMembership?.joinedAt,
    };
  },
});

/**
 * Update user profile
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Validate email format if provided
    if (args.email !== undefined && args.email.trim() !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(args.email)) {
        throw new Error("Invalid email format");
      }

      // Check email uniqueness
      const existingUser = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", args.email))
        .first();

      if (existingUser && existingUser._id !== userId) {
        throw new Error("Email is already in use");
      }
    }

    await ctx.db.patch(userId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.email !== undefined && { email: args.email }),
      ...(args.image !== undefined && { image: args.image }),
    });
  },
});

/**
 * Change user password
 */
export const changePassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Validate new password requirements
    if (args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(args.newPassword)) {
      throw new Error("Password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(args.newPassword)) {
      throw new Error("Password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(args.newPassword)) {
      throw new Error("Password must contain at least one number");
    }

    // Note: Actual password verification and update would be handled by @convex-dev/auth
    // This is a placeholder for the validation logic
    // In a real implementation, you would verify currentPassword and update via the auth system

    throw new Error("Password change functionality requires integration with authentication provider");
  },
});

// Note: Notification preferences moved to convex/userSettings.ts
// This file now only contains user profile-related queries and mutations

/**
 * Get user's API keys
 */
export const getAPIKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const keys = await ctx.db
      .query("userAPIKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return keys.map((key) => ({
      _id: key._id,
      name: key.name,
      key: `${key.key.substring(0, 8)}...${key.key.substring(key.key.length - 4)}`, // Masked key
      scopes: key.scopes,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    }));
  },
});

/**
 * Generate a new API key
 */
export const generateAPIKey = mutation({
  args: {
    name: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Generate a random API key
    const key = `sk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    const keyId = await ctx.db.insert("userAPIKeys", {
      userId,
      name: args.name,
      key,
      scopes: args.scopes,
      createdAt: Date.now(),
      lastUsedAt: null,
    });

    // Return the full key only on creation
    const fullKey = await ctx.db.get(keyId);
    return {
      _id: fullKey!._id,
      name: fullKey!.name,
      key: fullKey!.key, // Full key returned only once
      scopes: fullKey!.scopes,
      createdAt: fullKey!.createdAt,
    };
  },
});

/**
 * Revoke an API key
 */
export const revokeAPIKey = mutation({
  args: {
    keyId: v.id("userAPIKeys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== userId) {
      throw new Error("API key not found or unauthorized");
    }

    await ctx.db.delete(args.keyId);
  },
});

/**
 * Get usage statistics for API keys
 */
export const getAPIKeyUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { totalKeys: 0, activeKeys: 0 };

    const keys = await ctx.db
      .query("userAPIKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    return {
      totalKeys: keys.length,
      activeKeys: keys.filter((k) => k.lastUsedAt && k.lastUsedAt > thirtyDaysAgo).length,
    };
  },
});
