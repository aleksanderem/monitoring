"use client";

interface CoreWebVitalsCardProps {
  vitals?: {
    largestContentfulPaint: number;
    firstInputDelay: number;
    timeToInteractive: number;
    domComplete: number;
    cumulativeLayoutShift?: number;
  };
}

function cwvStatus(metric: string, value: number): "good" | "needs-improvement" | "poor" {
  switch (metric) {
    case "lcp": return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
    case "fid": return value <= 100 ? "good" : value <= 300 ? "needs-improvement" : "poor";
    case "tti": return value <= 3800 ? "good" : value <= 7300 ? "needs-improvement" : "poor";
    case "cls": return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
    default: return "good";
  }
}

function CwvMetricCard({ label, fullName, num, unit, target, metric, rawValue }: {
  label: string;
  fullName: string;
  num: string;
  unit: string;
  target: string;
  metric: string;
  rawValue: number;
}) {
  const status = cwvStatus(metric, rawValue);
  const valueColor = status === "good"
    ? "text-utility-success-600"
    : status === "needs-improvement"
      ? "text-utility-warning-600"
      : "text-utility-error-600";
  const dotColor = status === "good"
    ? "bg-utility-success-500"
    : status === "needs-improvement"
      ? "bg-utility-warning-500"
      : "bg-utility-error-500";

  return (
    <div className="flex flex-col rounded-lg border border-secondary bg-secondary/20 p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-xs font-semibold text-tertiary uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-bold tabular-nums ${valueColor}`}>
        {num}<span className="text-[10px] font-medium ml-0.5">{unit}</span>
      </div>
      <p className="text-xs text-tertiary mt-2">{fullName}</p>
      <p className="text-[10px] text-quaternary mt-auto pt-1">T: {target}</p>
    </div>
  );
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

  const formatValue = (key: string, value: number): { num: string; unit: string } => {
    if (key === "cls") return { num: value.toFixed(3), unit: "" };
    if (value >= 1000) return { num: (value / 1000).toFixed(2), unit: "s" };
    return { num: value.toFixed(0), unit: "ms" };
  };

  const metrics = [
    {
      label: "LCP",
      fullName: "Largest Contentful Paint",
      key: "lcp",
      value: vitals.largestContentfulPaint,
      target: "\u2264 2.5s",
    },
    {
      label: "FID",
      fullName: "First Input Delay",
      key: "fid",
      value: vitals.firstInputDelay,
      target: "\u2264 100ms",
    },
    {
      label: "TTI",
      fullName: "Time to Interactive",
      key: "tti",
      value: vitals.timeToInteractive,
      target: "\u2264 3.8s",
    },
    {
      label: "CLS",
      fullName: "Cumulative Layout Shift",
      key: "cls",
      value: vitals.cumulativeLayoutShift ?? 0,
      target: "\u2264 0.1",
    },
  ];

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
          Learn more
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const { num, unit } = formatValue(m.key, m.value);
          return (
            <CwvMetricCard
              key={m.key}
              label={m.label}
              fullName={m.fullName}
              num={num}
              unit={unit}
              target={m.target}
              metric={m.key}
              rawValue={m.value}
            />
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-secondary">
        <p className="text-xs font-medium text-tertiary mb-2">Status Guide:</p>
        <div className="flex flex-wrap gap-4 text-xs text-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-utility-success-500" />
            Good
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-utility-warning-500" />
            Needs Improvement
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-utility-error-500" />
            Poor
          </span>
        </div>
      </div>
    </div>
  );
}
