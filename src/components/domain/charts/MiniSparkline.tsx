"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

interface MiniSparklineProps {
  data: Array<{ date: number; position: number | null }>;
  className?: string;
}

export function MiniSparkline({ data, className }: MiniSparklineProps) {
  if (!data || data.length === 0) {
    return <div className={className} />;
  }

  const chartData = data
    .filter(point => point.position !== null)
    .map(point => ({ value: point.position as number }));

  return (
    <ResponsiveContainer width={60} height={24} className={className}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke="currentColor"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
