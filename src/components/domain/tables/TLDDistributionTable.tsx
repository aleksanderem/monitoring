"use client";

import { Globe01 } from "@untitledui/icons";

interface TLDDistributionTableProps {
  data: Record<string, number>;
  isLoading?: boolean;
}

export function TLDDistributionTable({ data, isLoading }: TLDDistributionTableProps) {
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

  const tableData = Object.entries(data)
    .map(([tld, count]) => ({
      tld: `.${tld}`,
      count,
      percentage: 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const total = tableData.reduce((sum, item) => sum + item.count, 0);
  tableData.forEach((item) => {
    item.percentage = (item.count / total) * 100;
  });

  if (tableData.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <h3 className="text-md font-semibold text-primary">TLD Distribution</h3>
          <p className="text-sm text-tertiary">Top level domains of referring sites</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <Globe01 className="h-10 w-10 text-fg-quaternary" />
          <p className="mt-2 text-sm text-tertiary">No TLD data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div>
        <h3 className="text-md font-semibold text-primary">TLD Distribution</h3>
        <p className="text-sm text-tertiary">Top 10 domains by backlink count</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-secondary">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-tertiary">TLD</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">
                Backlinks
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-tertiary">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary">
            {tableData.map((item, index) => (
              <tr key={item.tld} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-primary">{item.tld}</td>
                <td className="px-4 py-3 text-right text-sm text-primary">
                  {item.count.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-sm text-tertiary">
                  {item.percentage.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
