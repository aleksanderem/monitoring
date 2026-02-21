import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import Google from "@auth/core/providers/google";
import { Resend } from "resend";
import { generateRandomString, type RandomReader } from "@oslojs/crypto/random";
import { query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

function buildPasswordResetEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Reset hasła</h2>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#475467;">
        Twój kod weryfikacyjny:
      </p>
      <div style="margin:16px 0 24px;padding:16px 24px;background:#f9fafb;border-radius:8px;border:1px solid #eaecf0;text-align:center;">
        <span style="font-size:32px;font-family:'Courier New',monospace;font-weight:700;letter-spacing:4px;color:#101828;">${code}</span>
      </div>
      <p style="margin:0 0 0;font-size:13px;color:#98a2b3;">
        Kod jest ważny przez 1 godzinę. Jeśli nie prosiłeś o reset hasła, zignoruj tego maila.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body>
</html>`;
}

function buildEmailVerificationHtml(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Weryfikacja email</h2>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#475467;">
        Twój kod weryfikacyjny:
      </p>
      <div style="margin:16px 0 24px;padding:16px 24px;background:#f9fafb;border-radius:8px;border:1px solid #eaecf0;text-align:center;">
        <span style="font-size:32px;font-family:'Courier New',monospace;font-weight:700;letter-spacing:4px;color:#101828;">${code}</span>
      </div>
      <p style="margin:0 0 0;font-size:13px;color:#98a2b3;">
        Kod jest ważny przez 1 godzinę. Jeśli nie zakładałeś konta w doseo, zignoruj tego maila.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body>
</html>`;
}

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      verify: Email({
        id: "email-verification",
        async generateVerificationToken() {
          const random: RandomReader = {
            read(bytes: Uint8Array) {
              crypto.getRandomValues(bytes);
            },
          };
          return generateRandomString(random, "0123456789", 8);
        },
        sendVerificationRequest: async ({ identifier, token }) => {
          const key = process.env.RESEND_API_KEY;
          if (!key) throw new Error("RESEND_API_KEY not configured");
          const resend = new Resend(key);
          await resend.emails.send({
            from: "doseo <noreply@kolabogroup.pl>",
            to: identifier,
            subject: "Kod weryfikacyjny — doseo",
            html: buildEmailVerificationHtml(token),
          });
        },
      }),
      reset: Email({
        id: "password-reset",
        sendVerificationRequest: async ({ identifier, token }) => {
          const key = process.env.RESEND_API_KEY;
          if (!key) throw new Error("RESEND_API_KEY not configured");
          const resend = new Resend(key);
          await resend.emails.send({
            from: "doseo <noreply@kolabogroup.pl>",
            to: identifier,
            subject: "Kod resetowania hasła — doseo",
            html: buildPasswordResetEmailHtml(token),
          });
        },
      }),
      validatePasswordRequirements: (password: string) => {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        if (!/[A-Z]/.test(password)) throw new Error("Password must contain an uppercase letter");
        if (!/[a-z]/.test(password)) throw new Error("Password must contain a lowercase letter");
        if (!/[0-9]/.test(password)) throw new Error("Password must contain a number");
      },
    }),
    Google,
  ],
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

      // Find default plan and assign
      const defaultPlan = await ctx.db
        .query("plans")
        .filter((q) => q.eq(q.field("isDefault"), true))
        .first();

      if (defaultPlan) {
        await ctx.db.patch(orgId, {
          planId: defaultPlan._id,
          limits: defaultPlan.limits,
        });
      }

      // Schedule welcome email
      if (email && email !== "user") {
        await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendWelcome, {
          to: email,
          userName: name,
        });
      }
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
