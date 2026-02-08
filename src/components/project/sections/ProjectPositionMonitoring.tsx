"use client";

import { useQuery } from "convex/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";

interface ProjectPositionMonitoringProps {
    projectId: Id<"projects">;
}

const BUCKET_COLORS: Record<string, string> = {
    top3: "#10b981",
    top10: "#22c55e",
    top20: "#f59e0b",
    top50: "#f97316",
    top100: "#ef4444",
    beyond: "#6b7280",
};

const BUCKET_LABELS: Record<string, string> = {
    top3: "Top 3",
    top10: "Top 4-10",
    top20: "Top 11-20",
    top50: "Top 21-50",
    top100: "Top 51-100",
    beyond: "100+",
};

export function ProjectPositionMonitoring({ projectId }: ProjectPositionMonitoringProps) {
    const t = useTranslations("projects");
    const distribution = useQuery(api.projectDashboard_queries.getProjectPositionDistribution, { projectId });
    const trend = useQuery(api.projectDashboard_queries.getProjectMovementTrend, { projectId });
    const performers = useQuery(api.projectDashboard_queries.getProjectTopPerformers, { projectId });

    return (
        <div className="flex flex-col gap-6">
            {/* Position Distribution */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-secondary bg-primary p-6">
                    <h3 className="text-md font-semibold text-primary">{t("positionDistribution")}</h3>
                    <p className="mb-4 text-sm text-tertiary">{t("positionDistributionDescription")}</p>
                    {distribution === undefined ? (
                        <div className="h-48 animate-pulse rounded bg-gray-50" />
                    ) : distribution && distribution.some((d) => d.count > 0) ? (
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={distribution}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} tickFormatter={(v) => BUCKET_LABELS[v] || v} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(value: any) => [value, t("columnKeywords")]} labelFormatter={(label) => BUCKET_LABELS[label] || label} />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                        {distribution.map((entry) => (
                                            <Bar key={entry.bucket} dataKey="count" fill={BUCKET_COLORS[entry.bucket] || "#6b7280"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex h-48 items-center justify-center">
                            <p className="text-sm text-tertiary">{t("noPositionData")}</p>
                        </div>
                    )}
                </div>

                {/* Movement Trend */}
                <div className="rounded-xl border border-secondary bg-primary p-6">
                    <h3 className="text-md font-semibold text-primary">{t("visibilityTrend")}</h3>
                    <p className="mb-4 text-sm text-tertiary">{t("visibilityTrendDescription")}</p>
                    {trend === undefined ? (
                        <div className="h-48 animate-pulse rounded bg-gray-50" />
                    ) : trend && trend.length > 0 ? (
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="etv" name={t("chartEtv")} stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="count" name={t("columnKeywords")} stroke="#3b82f6" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex h-48 items-center justify-center">
                            <p className="text-sm text-tertiary">{t("noTrendData")}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Performers */}
            {performers && (performers.gainers.length > 0 || performers.losers.length > 0) && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Gainers */}
                    <div className="rounded-xl border border-secondary bg-primary p-6">
                        <h3 className="text-md font-semibold text-utility-success-600">{t("topGainers")}</h3>
                        <p className="mb-3 text-sm text-tertiary">{t("topGainersDescription")}</p>
                        <div className="space-y-2">
                            {performers.gainers.slice(0, 10).map((item, i) => (
                                <div key={i} className="flex items-center justify-between rounded-lg border border-secondary p-2.5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-primary">{item.keyword}</span>
                                        <span className="text-xs text-tertiary">{item.domain}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-tertiary">#{item.previousPosition}</span>
                                        <span className="text-xs text-tertiary">&rarr;</span>
                                        <span className="text-sm font-medium text-primary">#{item.currentPosition}</span>
                                        <span className="rounded-full bg-utility-success-50 px-1.5 py-0.5 text-xs font-medium text-utility-success-600">+{item.change}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Losers */}
                    <div className="rounded-xl border border-secondary bg-primary p-6">
                        <h3 className="text-md font-semibold text-utility-error-600">{t("topLosers")}</h3>
                        <p className="mb-3 text-sm text-tertiary">{t("topLosersDescription")}</p>
                        <div className="space-y-2">
                            {performers.losers.slice(0, 10).map((item, i) => (
                                <div key={i} className="flex items-center justify-between rounded-lg border border-secondary p-2.5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-primary">{item.keyword}</span>
                                        <span className="text-xs text-tertiary">{item.domain}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-tertiary">#{item.previousPosition}</span>
                                        <span className="text-xs text-tertiary">&rarr;</span>
                                        <span className="text-sm font-medium text-primary">#{item.currentPosition}</span>
                                        <span className="rounded-full bg-utility-error-50 px-1.5 py-0.5 text-xs font-medium text-utility-error-600">{item.change}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
