"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations } from "next-intl";

interface MonthlySearchTrendChartProps {
  monthlySearches: Array<{
    year: number;
    month: number;
    search_volume: number;
  }>;
}

export function MonthlySearchTrendChart({ monthlySearches }: MonthlySearchTrendChartProps) {
  const t = useTranslations("keywords");
  if (!monthlySearches || monthlySearches.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-tertiary">
        {t("noTrendDataAvailable")}
      </div>
    );
  }

  // Sort by date (oldest first) and format for chart
  const chartData = [...monthlySearches]
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    })
    .map((item) => ({
      ...item,
      label: `${item.year}-${String(item.month).padStart(2, '0')}`,
      displayLabel: new Date(item.year, item.month - 1).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit'
      })
    }));

  const maxVolume = Math.max(...chartData.map(d => d.search_volume));
  const minVolume = Math.min(...chartData.map(d => d.search_volume));
  const avgVolume = chartData.reduce((sum, d) => sum + d.search_volume, 0) / chartData.length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-secondary bg-secondary/30 p-3">
          <p className="text-xs text-tertiary mb-1">{t("avgVolume")}</p>
          <p className="text-lg font-semibold text-primary">{Math.round(avgVolume).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-secondary bg-secondary/30 p-3">
          <p className="text-xs text-tertiary mb-1">{t("peakVolume")}</p>
          <p className="text-lg font-semibold text-utility-success-600">{maxVolume.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-secondary bg-secondary/30 p-3">
          <p className="text-xs text-tertiary mb-1">{t("lowVolume")}</p>
          <p className="text-lg font-semibold text-utility-warning-600">{minVolume.toLocaleString()}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-secondary))" />
            <XAxis
              dataKey="displayLabel"
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#F9FAFB',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}
              labelStyle={{ color: '#F9FAFB', fontWeight: 600, marginBottom: '4px' }}
              itemStyle={{ color: '#E5E7EB' }}
              formatter={(value: number | undefined) => [value ? value.toLocaleString() : '0', t("searchVolume")]}
            />
            <Line
              type="monotone"
              dataKey="search_volume"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trend indicator */}
      <div className="flex items-center justify-center gap-2 text-sm">
        {chartData.length >= 2 && (
          <>
            {chartData[chartData.length - 1].search_volume > chartData[0].search_volume ? (
              <span className="flex items-center gap-1 text-utility-success-600 font-medium">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                {t("trendingUp")}
              </span>
            ) : chartData[chartData.length - 1].search_volume < chartData[0].search_volume ? (
              <span className="flex items-center gap-1 text-utility-error-600 font-medium">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t("trendingDown")}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-utility-gray-600 font-medium">
                → {t("trendStable")}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
