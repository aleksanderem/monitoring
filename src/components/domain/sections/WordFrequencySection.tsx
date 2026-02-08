"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface WordFrequencySectionProps {
  domainId: Id<"domains">;
}

export function WordFrequencySection({ domainId }: WordFrequencySectionProps) {
  const t = useTranslations('onsite');
  const [phraseLength, setPhraseLength] = useState(1);

  const wordFreqData = useQuery(api.seoAudit_queries.getWordFrequency, {
    domainId,
    phraseLength,
  });

  const latestData = wordFreqData?.[0];
  if (!latestData) return null;

  const topWords = latestData.data.slice(0, 20);
  const maxFreq = topWords[0]?.absFreq || 1;

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-tertiary">
          {t('totalWordsAnalyzed')}: <strong className="text-primary">{latestData.totalWords.toLocaleString()}</strong>
        </div>
        <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
          <button
            onClick={() => setPhraseLength(1)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              phraseLength === 1
                ? "bg-primary text-primary font-medium shadow-sm"
                : "text-tertiary hover:text-secondary"
            }`}
          >
            {t('singleWords')}
          </button>
          <button
            onClick={() => setPhraseLength(2)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              phraseLength === 2
                ? "bg-primary text-primary font-medium shadow-sm"
                : "text-tertiary hover:text-secondary"
            }`}
          >
            {t('twoWordPhrases')}
          </button>
        </div>
      </div>

      {/* Horizontal bar chart */}
      <div className="space-y-2">
        {topWords.map((item, i) => {
          const percentage = (item.absFreq / maxFreq) * 100;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm text-primary w-40 truncate font-medium" title={item.word}>
                {item.word}
              </span>
              <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-sm text-tertiary w-12 text-right tabular-nums">
                {item.absFreq}
              </span>
            </div>
          );
        })}
      </div>

      {topWords.length === 0 && (
        <div className="text-center py-8 text-sm text-tertiary">
          {t('noWordFrequencyData')}
        </div>
      )}
    </div>
  );
}
