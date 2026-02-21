import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
          server: { deps: { inline: ["convex-test"] } },
          setupFiles: ["./convex/test-setup.ts"],
        },
      },
      {
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/test/e2e/**"],
          setupFiles: ["./src/test/setup.ts"],
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
            "@convex": path.resolve(__dirname, "convex"),
          },
        },
      },
      {
        test: {
          name: "e2e",
          environment: "node",
          include: ["src/test/e2e/**/*.test.ts"],
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
          },
        },
      },
      {
        test: {
          name: "e2e",
          environment: "node",
          include: ["src/test/e2e/**/*.test.{ts,tsx}"],
          testTimeout: 30000,
        },
        resolve: {
          alias: { "@": path.resolve(__dirname, "src") },
        },
      },
    ],
  },
});
