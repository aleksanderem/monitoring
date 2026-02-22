import { mutation } from "./_generated/server";

/**
 * Seed the knowledge base with initial articles.
 * Run once via the Convex dashboard or CLI.
 */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if articles already exist
    const existing = await ctx.db.query("kbArticles").first();
    if (existing) return "Articles already seeded";

    const now = Date.now();
    const articles = [
      {
        slug: "getting-started-with-doseo",
        category: "getting-started",
        title: "Getting Started with doseo",
        content: `## Welcome to doseo

doseo is a comprehensive SEO monitoring platform that helps you track keyword positions, analyze competitors, and improve your search engine visibility.

### Quick Start Guide

- Create your first project and add a domain
- Add keywords you want to monitor (manually or via AI suggestions)
- Run your first position check to see current rankings
- Add competitors to compare performance
- Set up alerts for ranking changes

### What You Can Track

doseo monitors keyword positions across search engines, tracks competitor rankings, analyzes on-site SEO health, and generates comprehensive reports for clients.

### Need More Help?

Browse our knowledge base articles below or contact support for personalized assistance.`,
        tags: ["getting-started", "onboarding", "basics"],
        order: 1,
      },
      {
        slug: "understanding-keyword-positions",
        category: "features",
        title: "Understanding Keyword Positions",
        content: `## Keyword Position Tracking

Keyword positions tell you where your website ranks in search engine results for specific search terms.

### How Positions Are Tracked

doseo checks your keyword rankings daily (or on-demand) using search engine APIs. Positions range from 1 (top result) to 100+.

### Reading the Position Table

- Current Position: Where you rank right now
- Previous Position: Where you ranked during the last check
- Change: The difference (green = improved, red = declined)
- Search Volume: Estimated monthly searches for this keyword
- Difficulty: How competitive this keyword is (0-100)

### Position History

Click on any keyword to see its position history chart. This shows trends over time and helps identify patterns.

### Tips for Improving Positions

- Focus on keywords where you rank between positions 4-20 (quick wins)
- Monitor position changes after publishing new content
- Use the SERP analysis to understand what top-ranking pages do differently`,
        tags: ["keywords", "positions", "tracking"],
        order: 2,
      },
      {
        slug: "setting-up-competitor-tracking",
        category: "features",
        title: "Setting Up Competitor Tracking",
        content: `## Competitor Tracking

Monitor how your competitors rank for the same keywords you are tracking.

### Adding Competitors

Navigate to your domain's Competitors tab and click "Add Competitor". Enter the competitor's domain name and a friendly name.

### What Gets Tracked

- Keyword-by-keyword position comparison
- Overall visibility score comparison
- Backlink profile comparison
- Content gap analysis (keywords they rank for that you don't)

### Content Gap Analysis

The content gap feature identifies keywords where competitors rank well but you don't. These represent opportunities to create new content and capture additional search traffic.

### Best Practices

- Track 3-5 direct competitors for best insights
- Include both larger and similar-sized competitors
- Review competitor data weekly for new opportunities`,
        tags: ["competitors", "tracking", "analysis"],
        order: 3,
      },
      {
        slug: "managing-alert-rules",
        category: "features",
        title: "Managing Alert Rules",
        content: `## Alert Rules and Notifications

Stay informed about important changes to your keyword rankings and SEO metrics.

### Types of Alerts

- Position drop alerts: Get notified when a keyword drops below a threshold
- Position improvement alerts: Celebrate when keywords enter the top positions
- Competitor alerts: Know when competitors overtake your rankings
- Audit alerts: Receive notifications when site health issues are detected

### Configuring Notifications

Go to Settings > Notifications to configure which alerts you receive and how often. Options include immediate, daily digest, and weekly summary.

### Viewing Notification History

All notifications are available in the notification bell at the top of the dashboard. Click to view recent alerts and mark them as read.`,
        tags: ["alerts", "notifications", "monitoring"],
        order: 4,
      },
      {
        slug: "exporting-your-data",
        category: "how-to",
        title: "Exporting Your Data",
        content: `## Data Export Options

doseo provides multiple ways to export your SEO data for reporting and analysis.

### Export Formats

- PDF: Professional reports ready for client presentations
- CSV: Raw data for analysis in spreadsheets
- Excel: Formatted spreadsheets with charts and summaries

### Generating Reports

Navigate to the Reports section to create shareable reports. You can customize which sections to include, add your branding, and set up automatic report generation.

### Sharing with Clients

Create shareable report links that clients can access without needing a doseo account. Control what data is visible and allow clients to propose new keywords to track.

### Scheduling Reports

Set up automatic report generation on a daily, weekly, or monthly basis. Reports are generated and available for download or sharing automatically.`,
        tags: ["export", "reports", "data"],
        order: 5,
      },
    ];

    for (const article of articles) {
      await ctx.db.insert("kbArticles", {
        ...article,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return `Seeded ${articles.length} articles`;
  },
});
