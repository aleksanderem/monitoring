// Suppress known convex-test "Write outside of transaction" errors
// that occur when mutations call ctx.scheduler.runAfter — the scheduled
// function fires outside the transaction boundary in convex-test's
// in-memory implementation. These are not real failures.
process.on("unhandledRejection", (reason: unknown) => {
  if (
    reason instanceof Error &&
    reason.message.includes("Write outside of transaction")
  ) {
    return; // swallow harmless convex-test scheduler artifact
  }
  // Re-throw anything else so vitest still catches real issues
  throw reason;
});
