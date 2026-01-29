import { internalMutation } from "../_generated/server";

export const cleanOldBacklinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete all old backlinks records that don't match new schema
    const allBacklinks = await ctx.db.query("domainBacklinks").collect();

    let deletedCount = 0;
    for (const backlink of allBacklinks) {
      // Check if it has old field names
      const doc = backlink as any;
      if (doc.nofollow !== undefined || doc.inlinkRank !== undefined || doc.domainInlinkRank !== undefined) {
        await ctx.db.delete(backlink._id);
        deletedCount++;
      }
    }

    return { deletedCount, message: `Deleted ${deletedCount} old backlinks records` };
  },
});
