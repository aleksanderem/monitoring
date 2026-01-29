"use client";

import { Badge } from "@/components/base/badges/badges";
import { TrendUp02, TrendDown02 } from "@untitledui/icons";

interface TopKeyword {
  _id: string;
  phrase: string;
  position: number | null;
  previousPosition: number | null;
  change: number | null;
  volume: number;
  difficulty: number;
}

interface TopKeywordsTableProps {
  keywords: TopKeyword[];
  title: string;
  description: string;
  isLoading?: boolean;
}

function getPositionBadgeColor(position: number | null): "blue" | "success" | "warning" | "error" | "gray" {
  if (position === null) return "gray";
  if (position <= 3) return "blue";
  if (position <= 10) return "success";
  if (position <= 20) return "warning";
  if (position <= 50) return "error";
  return "gray";
}

export function TopKeywordsTable({ keywords, title, description, isLoading }: TopKeywordsTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
          <div className="mt-1 h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
        <div>
          <h3 className="text-md font-semibold text-primary">{title}</h3>
          <p className="text-sm text-tertiary">{description}</p>
        </div>
        <div className="py-8 text-center">
          <p className="text-sm text-tertiary">No keywords found in this range</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <div>
        <h3 className="text-md font-semibold text-primary">{title}</h3>
        <p className="text-sm text-tertiary">{description}</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-secondary">
        <table className="w-full">
          <thead className="bg-secondary-subtle">
            <tr className="border-b border-secondary">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-secondary">
                Position
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-secondary">
                Keyword
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-secondary">
                Change
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-secondary">
                Volume
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-secondary">
                Difficulty
              </th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((keyword, index) => (
              <tr
                key={keyword._id}
                className={`border-b border-secondary ${
                  index % 2 === 0 ? "bg-primary" : "bg-secondary-subtle"
                } hover:bg-secondary-subtle`}
              >
                <td className="px-4 py-3">
                  <Badge
                    size="sm"
                    color={getPositionBadgeColor(keyword.position)}
                    className="text-lg font-semibold"
                  >
                    {keyword.position ?? "—"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-primary">{keyword.phrase}</p>
                </td>
                <td className="px-4 py-3">
                  {keyword.change !== null && keyword.change !== 0 ? (
                    <div className="flex items-center gap-1">
                      {keyword.change > 0 ? (
                        <>
                          <TrendUp02 className="h-4 w-4 text-success-600" />
                          <span className="text-sm font-medium text-success-600">
                            {Math.abs(keyword.change)}
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendDown02 className="h-4 w-4 text-error-600" />
                          <span className="text-sm font-medium text-error-600">
                            {Math.abs(keyword.change)}
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-tertiary">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-secondary">
                    {keyword.volume.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Badge
                    size="sm"
                    color={
                      keyword.difficulty < 30
                        ? "success"
                        : keyword.difficulty < 60
                        ? "warning"
                        : "error"
                    }
                  >
                    {keyword.difficulty}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
