/**
 * Test fixtures for user/auth-related data.
 */

export const CURRENT_USER = {
  _id: "user_1" as any,
  _creationTime: Date.now() - 90 * 24 * 60 * 60 * 1000,
  name: "Test User",
  email: "test@example.com",
  role: "admin",
};

export const PERMISSIONS = {
  "domains.create": true,
  "domains.edit": true,
  "domains.delete": true,
  "keywords.add": true,
  "keywords.refresh": true,
  "reports.create": true,
  "reports.share": true,
  "projects.create": true,
  "projects.edit": true,
  "projects.delete": true,
};
