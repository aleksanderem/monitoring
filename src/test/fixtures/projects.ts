/**
 * Test fixtures for project-related data.
 */

export const PROJECT_ACTIVE = {
  _id: "project_1" as any,
  _creationTime: Date.now() - 60 * 24 * 60 * 60 * 1000,
  teamId: "team_1" as any,
  name: "Main Project",
  createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
  domainCount: 3,
  keywordCount: 120,
  limits: undefined,
};

export const PROJECT_SECOND = {
  ...PROJECT_ACTIVE,
  _id: "project_2" as any,
  name: "Blog Project",
  domainCount: 1,
  keywordCount: 15,
};

export const PROJECT_LIST = [PROJECT_ACTIVE, PROJECT_SECOND];
