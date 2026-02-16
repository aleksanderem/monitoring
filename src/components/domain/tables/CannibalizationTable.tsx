"use client";

import { useQuery } from "convex/react";
import { AlertTriangle } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface CannibalizationTableProps {
    domainId: Id<"domains">;
}

export function CannibalizationTable({ domainId }: CannibalizationTableProps) {
    const t = useTranslations('keywords');
    const cannibalization = useQuery(api.keywordMap_queries.getKeywordCannibalization, { domainId });

    if (cannibalization === undefined) {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
                <div className="h-5 w-44 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-48 animate-pulse rounded bg-gray-50 dark:bg-gray-800" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-fg-warning-primary" />
                <div>
                    <h3 className="text-md font-semibold text-primary">{t('keywordCannibalization')}</h3>
                    <p className="text-sm text-tertiary">{t('cannibalizationDescription')}</p>
                </div>
            </div>

            {!cannibalization || cannibalization.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-sm text-tertiary">{t('noCannibalizationDetected')}</p>
                    <p className="mt-1 text-xs text-quaternary">{t('eachUrlRanksUnique')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {cannibalization.slice(0, 10).map((item, i) => (
                        <div key={i} className="rounded-lg border border-secondary p-3">
                            <div className="flex items-center justify-between">
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[500px] truncate text-sm font-medium text-brand-primary hover:underline"
                                >
                                    {item.url}
                                </a>
                                <span className="ml-2 rounded-full bg-utility-warning-50 px-2 py-0.5 text-xs font-medium text-utility-warning-600">
                                    {t('keywordCountLabel', { count: item.keywordCount })}
                                </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.keywords.map((kw, j) => (
                                    <span key={j} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary">
                                        {kw.keyword}
                                        <span className="font-medium text-primary">#{kw.position}</span>
                                    </span>
                                ))}
                            </div>
                            <div className="mt-1.5 text-xs text-tertiary">
                                {t('avgPositionValue', { position: item.avgPosition })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
