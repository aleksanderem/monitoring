import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Find project root (traverse up from test file)
function findProjectRoot(): string {
  let dir = __dirname;
  while (dir !== "/") {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("Could not find project root");
}

describe("R28: CI/CD Pipeline", () => {
  const root = findProjectRoot();

  describe("CI Workflow", () => {
    const ciPath = path.join(root, ".github/workflows/ci.yml");

    it("CI workflow file exists", () => {
      expect(fs.existsSync(ciPath)).toBe(true);
    });

    it("CI workflow contains build step", () => {
      const content = fs.readFileSync(ciPath, "utf-8");
      expect(content).toContain("next build");
    });

    it("CI workflow contains test step", () => {
      const content = fs.readFileSync(ciPath, "utf-8");
      expect(content).toContain("npm test");
    });

    it("CI workflow triggers on pull_request to main", () => {
      const content = fs.readFileSync(ciPath, "utf-8");
      expect(content).toContain("pull_request");
      expect(content).toContain("main");
    });

    it("CI workflow triggers on push to main", () => {
      const content = fs.readFileSync(ciPath, "utf-8");
      expect(content).toContain("push");
    });

    it("CI workflow uses Node.js 20", () => {
      const content = fs.readFileSync(ciPath, "utf-8");
      expect(content).toContain("node-version");
      expect(content).toContain("20");
    });

    it("CI workflow has concurrency settings", () => {
      const content = fs.readFileSync(ciPath, "utf-8");
      expect(content).toContain("concurrency");
      expect(content).toContain("cancel-in-progress");
    });
  });

  describe("Deploy Workflow", () => {
    const deployPath = path.join(root, ".github/workflows/deploy.yml");

    it("Deploy workflow file exists", () => {
      expect(fs.existsSync(deployPath)).toBe(true);
    });

    it("Deploy workflow has environment input", () => {
      const content = fs.readFileSync(deployPath, "utf-8");
      expect(content).toContain("environment");
      expect(content).toContain("staging");
      expect(content).toContain("production");
    });

    it("Deploy workflow triggers on workflow_dispatch", () => {
      const content = fs.readFileSync(deployPath, "utf-8");
      expect(content).toContain("workflow_dispatch");
    });
  });
});
