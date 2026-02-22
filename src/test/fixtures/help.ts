/**
 * Test fixtures for product tours and knowledge base (R32).
 */

// Tour progress fixtures
export const TOUR_PROGRESS_NOT_STARTED = null;

export const TOUR_PROGRESS_IN_PROGRESS = {
  _id: "tp_1" as any,
  _creationTime: Date.now(),
  userId: "user_1" as any,
  tourId: "getting-started",
  completedSteps: ["welcome", "add-domain"],
  isCompleted: false,
  startedAt: Date.now() - 60_000,
};

export const TOUR_PROGRESS_COMPLETED = {
  _id: "tp_2" as any,
  _creationTime: Date.now(),
  userId: "user_1" as any,
  tourId: "getting-started",
  completedSteps: ["welcome", "add-domain", "add-keywords", "view-positions", "check-competitors"],
  isCompleted: true,
  startedAt: Date.now() - 300_000,
  completedAt: Date.now() - 60_000,
};

export const TOUR_PROGRESS_DISMISSED = {
  _id: "tp_3" as any,
  _creationTime: Date.now(),
  userId: "user_1" as any,
  tourId: "getting-started",
  completedSteps: ["welcome"],
  isCompleted: false,
  dismissedAt: Date.now() - 60_000,
  startedAt: Date.now() - 120_000,
};

// KB Article fixtures
export function makeKbArticle(overrides: Record<string, unknown> = {}) {
  return {
    _id: "kb_1" as any,
    _creationTime: Date.now(),
    slug: "getting-started-with-doseo",
    category: "getting-started",
    title: "Getting Started with doseo",
    content: "## Welcome to doseo\n\ndoseo helps you monitor SEO positions.\n\n### Quick Start\n\n- Add a domain\n- Add keywords\n- Check positions",
    tags: ["getting-started", "onboarding"],
    order: 1,
    isPublished: true,
    createdAt: Date.now() - 86_400_000,
    updatedAt: Date.now() - 86_400_000,
    ...overrides,
  };
}

export const KB_ARTICLE_GETTING_STARTED = makeKbArticle();

export const KB_ARTICLE_KEYWORD_POSITIONS = makeKbArticle({
  _id: "kb_2" as any,
  slug: "understanding-keyword-positions",
  category: "features",
  title: "Understanding Keyword Positions",
  content: "## Keyword Position Tracking\n\nPositions show where your website ranks in search results.\n\n- Current Position\n- Previous Position\n- Change indicator",
  tags: ["keywords", "positions"],
  order: 2,
});

export const KB_ARTICLE_COMPETITORS = makeKbArticle({
  _id: "kb_3" as any,
  slug: "setting-up-competitor-tracking",
  category: "features",
  title: "Setting Up Competitor Tracking",
  content: "## Competitor Tracking\n\nMonitor competitor rankings alongside yours.",
  tags: ["competitors", "tracking"],
  order: 3,
});

export const KB_ARTICLE_ALERTS = makeKbArticle({
  _id: "kb_4" as any,
  slug: "managing-alert-rules",
  category: "features",
  title: "Managing Alert Rules",
  content: "## Alert Rules\n\nStay informed about ranking changes.",
  tags: ["alerts", "notifications"],
  order: 4,
});

export const KB_ARTICLE_EXPORT = makeKbArticle({
  _id: "kb_5" as any,
  slug: "exporting-your-data",
  category: "how-to",
  title: "Exporting Your Data",
  content: "## Data Export\n\nExport your data in PDF, CSV, or Excel formats.",
  tags: ["export", "reports"],
  order: 5,
});

export const KB_ARTICLES_ALL = [
  KB_ARTICLE_GETTING_STARTED,
  KB_ARTICLE_KEYWORD_POSITIONS,
  KB_ARTICLE_COMPETITORS,
  KB_ARTICLE_ALERTS,
  KB_ARTICLE_EXPORT,
];

export const KB_ARTICLES_FEATURES = [
  KB_ARTICLE_KEYWORD_POSITIONS,
  KB_ARTICLE_COMPETITORS,
  KB_ARTICLE_ALERTS,
];

export const KB_ARTICLES_EMPTY: typeof KB_ARTICLES_ALL = [];

export const KB_CATEGORIES = [
  { category: "getting-started", count: 1 },
  { category: "features", count: 3 },
  { category: "how-to", count: 1 },
];

export const KB_CATEGORIES_EMPTY: typeof KB_CATEGORIES = [];
