"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Globe02 } from "@untitledui/icons";

interface CountriesDistributionChartProps {
  data: Record<string, number>;
  isLoading?: boolean;
}

export function CountriesDistributionChart({ data, isLoading }: CountriesDistributionChartProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
            <div className="mt-1 h-4 w-64 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
        <div className="h-[300px] animate-pulse rounded bg-gray-50" />
      </div>
    );
  }

  // Convert object to array and sort by count
  const chartData = Object.entries(data)
    .map(([country, count]) => ({
      country: country || "Unknown",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 countries

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <h3 className="text-md font-semibold text-primary">Countries Distribution</h3>
          <p className="text-sm text-tertiary">Geographic distribution of backlinks</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <Globe02 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">No country data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div>
        <h3 className="text-md font-semibold text-primary">Countries Distribution</h3>
        <p className="text-sm text-tertiary">Top 10 countries by backlinks</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis type="number" stroke="#6B7280" fontSize={12} />
          <YAxis
            dataKey="country"
            type="category"
            stroke="#6B7280"
            fontSize={12}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
            formatter={(value) => [(value || 0).toLocaleString(), "Backlinks"]}
          />
          <Bar dataKey="count" fill="#10B981" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
