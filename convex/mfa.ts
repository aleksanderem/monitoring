import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get MFA status for current user
export const getMfaStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const settings = await ctx.db
      .query("userMfaSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!settings) {
      return { isEnabled: false, hasBackupCodes: false, enabledAt: null };
    }

    const unusedBackupCodes = (settings.backupCodes || []).filter(c => !c.usedAt);

    return {
      isEnabled: settings.isEnabled,
      hasBackupCodes: unusedBackupCodes.length > 0,
      backupCodesRemaining: unusedBackupCodes.length,
      enabledAt: settings.enabledAt || null,
    };
  },
});

// Initialize TOTP setup — generate secret
export const initializeTotpSetup = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Generate a random 20-byte secret encoded as base32
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let secret = "";
    for (let i = 0; i < 32; i++) {
      secret += chars[Math.floor(Math.random() * chars.length)];
    }

    // Get user email for the otpauth URL
    const user = await ctx.db.get(userId);
    const email = user?.email || "user";

    // Store or update settings
    const existing = await ctx.db
      .query("userMfaSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { totpSecret: secret, isEnabled: false });
    } else {
      await ctx.db.insert("userMfaSettings", {
        userId,
        totpSecret: secret,
        isEnabled: false,
      });
    }

    const issuer = "DSEO";
    const otpauthUrl = `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

    return { secret, otpauthUrl };
  },
});

// Confirm TOTP setup with verification code
export const confirmTotpSetup = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const settings = await ctx.db
      .query("userMfaSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!settings || !settings.totpSecret) {
      throw new Error("TOTP not initialized");
    }

    // Simple verification: accept any 6-digit code for now
    // In production, this would verify against the TOTP algorithm
    if (!/^\d{6}$/.test(code)) {
      throw new Error("Invalid code format");
    }

    // Generate 10 backup codes
    const backupCodes = Array.from({ length: 10 }, () => {
      const chars = "0123456789abcdef";
      let backupCode = "";
      for (let i = 0; i < 8; i++) {
        backupCode += chars[Math.floor(Math.random() * chars.length)];
      }
      return { code: backupCode };
    });

    await ctx.db.patch(settings._id, {
      isEnabled: true,
      enabledAt: Date.now(),
      lastVerifiedAt: Date.now(),
      backupCodes,
    });

    return { backupCodes: backupCodes.map(c => c.code) };
  },
});

// Disable TOTP
export const disableTotp = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const settings = await ctx.db
      .query("userMfaSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!settings) throw new Error("MFA not configured");

    await ctx.db.patch(settings._id, {
      isEnabled: false,
      totpSecret: undefined,
      backupCodes: undefined,
      enabledAt: undefined,
    });
  },
});

// Regenerate backup codes
export const regenerateBackupCodes = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const settings = await ctx.db
      .query("userMfaSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!settings || !settings.isEnabled) {
      throw new Error("MFA not enabled");
    }

    const backupCodes = Array.from({ length: 10 }, () => {
      const chars = "0123456789abcdef";
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return { code };
    });

    await ctx.db.patch(settings._id, { backupCodes });

    return { backupCodes: backupCodes.map(c => c.code) };
  },
});

// Get backup codes
export const getBackupCodes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const settings = await ctx.db
      .query("userMfaSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!settings || !settings.backupCodes) return null;

    return settings.backupCodes.map(c => ({
      code: c.code,
      used: !!c.usedAt,
    }));
  },
});
