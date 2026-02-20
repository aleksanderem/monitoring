import { expect, test, describe } from "vitest";

// =====================================================================
// crons module import verification
// =====================================================================
describe("crons", () => {
  test("module imports without errors", async () => {
    // The crons module only defines cron schedules via cronJobs() and exports
    // the default cron configuration. We verify it imports cleanly.
    const cronModule = await import("./crons");
    expect(cronModule).toBeDefined();
    expect(cronModule.default).toBeDefined();
  });
});
