"use client";

interface LighthouseScoresCardProps {
  scores?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
}

export function LighthouseScoresCard({ scores }: LighthouseScoresCardProps) {
  if (!scores) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">
          Lighthouse Scores
        </h3>
        <p className="text-sm text-gray-500">
          No Lighthouse data available. Run an Instant Pages scan to get detailed performance metrics.
        </p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-success-600 bg-success-50";
    if (score >= 50) return "text-warning-600 bg-warning-50";
    return "text-error-600 bg-error-50";
  };

  const getScoreRing = (score: number) => {
    if (score >= 90) return "stroke-success-600";
    if (score >= 50) return "stroke-warning-600";
    return "stroke-error-600";
  };

  const categories = [
    { name: "Performance", key: "performance" as const, icon: "⚡" },
    { name: "Accessibility", key: "accessibility" as const, icon: "♿" },
    { name: "Best Practices", key: "bestPractices" as const, icon: "✓" },
    { name: "SEO", key: "seo" as const, icon: "🔍" },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-md font-semibold text-gray-900 mb-6">
        Lighthouse Scores
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map((category) => {
          const score = scores[category.key];
          const radius = 40;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (score / 100) * circumference;

          return (
            <div key={category.key} className="flex flex-col items-center">
              {/* Circular progress */}
              <div className="relative w-24 h-24 mb-3">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-200"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className={getScoreRing(score)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${getScoreColor(score).split(' ')[0]}`}>
                    {score}
                  </span>
                </div>
              </div>

              {/* Label */}
              <div className="text-center">
                <div className="text-lg mb-1">{category.icon}</div>
                <div className="text-sm font-medium text-gray-900">{category.name}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success-600"></span>
            90-100: Good
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-warning-600"></span>
            50-89: Needs Improvement
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-error-600"></span>
            0-49: Poor
          </span>
        </div>
      </div>
    </div>
  );
}
