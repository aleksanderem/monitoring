"use client";

import { CheckCircle, AlertCircle, XCircle } from "@untitledui/icons";
import { RadialBarChart, RadialBar, Label, PolarGrid, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartConfig } from "@/components/ui/chart";

interface CoreWebVitalsCardProps {
  vitals?: {
    largestContentfulPaint: number;
    firstInputDelay: number;
    timeToInteractive: number;
    domComplete: number;
    cumulativeLayoutShift?: number;
  };
}

export function CoreWebVitalsCard({ vitals }: CoreWebVitalsCardProps) {
  if (!vitals) {
    return (
      <div className="bg-primary rounded-lg border border-secondary p-6">
        <h3 className="text-md font-semibold text-primary mb-4">
          Core Web Vitals
        </h3>
        <p className="text-sm text-tertiary">
          No Core Web Vitals data available. Run an Instant Pages scan to get performance metrics.
        </p>
      </div>
    );
  }

  const getMetricScore = (metric: string, value: number): { score: number; status: string; chartKey: string } => {
    const thresholds = {
      lcp: { good: 2500, poor: 4000 }, // ms
      fid: { good: 100, poor: 300 }, // ms
      tti: { good: 3800, poor: 7300 }, // ms
      cls: { good: 0.1, poor: 0.25 }, // score
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return { score: 50, status: "needs-improvement", chartKey: "chart-4" };

    // Calculate percentage score (inverted - lower is better)
    let score: number;
    let status: string;
    let chartKey: string;

    if (value <= threshold.good) {
      score = 100 - (value / threshold.good) * 25; // 75-100% range for good
      status = "good";
      chartKey = "chart-2"; // Green
    } else if (value <= threshold.poor) {
      score = 50 - ((value - threshold.good) / (threshold.poor - threshold.good)) * 25; // 25-75% range
      status = "needs-improvement";
      chartKey = "chart-4"; // Yellow/Orange
    } else {
      score = Math.max(0, 25 - ((value - threshold.poor) / threshold.poor) * 25); // 0-25% range for poor
      status = "poor";
      chartKey = "chart-1"; // Red
    }

    return { score: Math.round(score), status, chartKey };
  };

  const metrics = [
    {
      name: "Largest Contentful Paint",
      abbreviation: "LCP",
      key: "lcp",
      value: vitals.largestContentfulPaint,
      unit: "ms",
      description: "How quickly the main content loads",
      goodThreshold: "≤ 2.5s",
    },
    {
      name: "First Input Delay",
      abbreviation: "FID",
      key: "fid",
      value: vitals.firstInputDelay,
      unit: "ms",
      description: "Time until page becomes interactive",
      goodThreshold: "≤ 100ms",
    },
    {
      name: "Time to Interactive",
      abbreviation: "TTI",
      key: "tti",
      value: vitals.timeToInteractive,
      unit: "ms",
      description: "Time until page is fully interactive",
      goodThreshold: "≤ 3.8s",
    },
    {
      name: "Cumulative Layout Shift",
      abbreviation: "CLS",
      key: "cls",
      value: vitals.cumulativeLayoutShift ?? 0,
      unit: "",
      description: "Visual stability during page load",
      goodThreshold: "≤ 0.1",
    },
  ];

  const getStatusIcon = (status: string) => {
    if (status === "good") return <CheckCircle className="w-4 h-4 text-success-primary" />;
    if (status === "needs-improvement") return <AlertCircle className="w-4 h-4 text-warning-primary" />;
    return <XCircle className="w-4 h-4 text-error-primary" />;
  };

  return (
    <div className="bg-primary rounded-lg border border-secondary p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-md font-semibold text-primary">
          Core Web Vitals
        </h3>
        <a
          href="https://web.dev/vitals/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-600 hover:text-brand-700"
        >
          Learn more →
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        {metrics.map((metric) => {
          const { score, status, chartKey } = getMetricScore(metric.key, metric.value);
          const displayValue = metric.key === "cls"
            ? metric.value.toFixed(3)
            : metric.value >= 1000
            ? `${(metric.value / 1000).toFixed(2)}s`
            : `${metric.value.toFixed(0)}ms`;

          const chartConfig = {
            value: {
              label: metric.abbreviation,
              color: `hsl(var(--${chartKey}))`,
            },
          } satisfies ChartConfig;

          const chartData = [{ value: score, fill: `var(--color-value)` }];

          return (
            <div key={metric.key} className="flex flex-col items-center">
              <ChartContainer
                config={chartConfig}
                className="mx-auto aspect-square h-[140px] w-[140px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    data={chartData}
                    startAngle={90}
                    endAngle={450}
                    innerRadius={55}
                    outerRadius={70}
                  >
                    <PolarGrid
                      gridType="circle"
                      radialLines={false}
                      stroke="none"
                      className="first:fill-muted last:fill-background"
                      polarRadius={[58, 52]}
                    />
                    <RadialBar dataKey="value" background cornerRadius={10} />
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={viewBox.cy}
                                className="fill-foreground text-2xl font-bold"
                              >
                                {displayValue}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 20}
                                className="fill-muted-foreground text-xs"
                              >
                                {metric.abbreviation}
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </ChartContainer>

              <div className="mt-3 flex items-center gap-1.5">
                {getStatusIcon(status)}
                <span className="text-xs font-medium text-secondary">{metric.name}</span>
              </div>
              <p className="text-xs text-quaternary text-center mt-1">{metric.description}</p>
              <p className="text-xs text-tertiary mt-1">Target: {metric.goodThreshold}</p>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-secondary">
        <div className="text-xs text-tertiary">
          <p className="mb-2 font-medium">Status Guide:</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-success-primary" />
              <span>Good</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 text-warning-primary" />
              <span>Needs Improvement</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-3 h-3 text-error-primary" />
              <span>Poor</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
