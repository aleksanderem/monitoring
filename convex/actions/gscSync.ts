import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

export const syncGscData = internalAction({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    // Get connection
    const connection = await ctx.runQuery(
      internal.gsc.getConnectionInternal,
      { organizationId }
    );
    if (!connection || connection.status !== "active") return;

    // Placeholder for actual GSC API call
    // In production: use connection.accessToken to call GSC Search Analytics API
    // For now, just update the sync time

    await ctx.runMutation(internal.gsc.updateConnectionSyncTime, {
      connectionId: connection._id,
      lastSyncAt: Date.now(),
    });
  },
});

export const syncAllGscConnections = internalAction({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.runQuery(
      internal.gsc.getAllActiveConnections,
      {}
    );
    for (const conn of connections) {
      try {
        await ctx.runAction(internal.actions.gscSync.syncGscData, {
          organizationId: conn.organizationId,
        });
      } catch (error) {
        console.error(
          `GSC sync failed for org ${conn.organizationId}:`,
          error
        );
      }
    }
  },
});
