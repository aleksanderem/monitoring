"use client";

interface KeywordTooltipProps {
  keyword: any;
  position: { x: number; y: number };
}

export function KeywordTooltip({ keyword, position }: KeywordTooltipProps) {
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-100%, -50%) translateX(-10px)',
      }}
    >
      <div className="rounded-lg border border-secondary bg-primary shadow-xl p-3 min-w-[280px] max-w-[320px]">
        <h4 className="text-sm font-semibold text-primary mb-3 truncate">{keyword.keyword}</h4>

        <div className="space-y-2">
          {/* Primary Metrics */}
          <div className="grid grid-cols-2 gap-2">
            {keyword.searchVolume !== undefined && (
              <div>
                <p className="text-xs text-tertiary">Volume</p>
                <p className="text-sm font-medium text-primary">{keyword.searchVolume.toLocaleString()}</p>
              </div>
            )}
            {keyword.difficulty !== undefined && (
              <div>
                <p className="text-xs text-tertiary">Difficulty</p>
                <p className={`text-sm font-medium ${
                  keyword.difficulty < 30 ? 'text-utility-success-600' :
                  keyword.difficulty < 70 ? 'text-utility-warning-600' :
                  'text-utility-error-600'
                }`}>
                  {keyword.difficulty}/100
                </p>
              </div>
            )}
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-2 gap-2">
            {keyword.cpc !== undefined && (
              <div>
                <p className="text-xs text-tertiary">CPC</p>
                <p className="text-sm font-medium text-primary">${keyword.cpc.toFixed(2)}</p>
              </div>
            )}
            {keyword.etv !== undefined && (
              <div>
                <p className="text-xs text-tertiary">ETV</p>
                <p className="text-sm font-medium text-primary">{keyword.etv.toFixed(2)}</p>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1 pt-2 border-t border-secondary">
            {keyword.competitionLevel && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                keyword.competitionLevel === 'LOW' ? 'bg-utility-success-50 text-utility-success-700' :
                keyword.competitionLevel === 'MEDIUM' ? 'bg-utility-warning-50 text-utility-warning-700' :
                'bg-utility-error-50 text-utility-error-700'
              }`}>
                {keyword.competitionLevel}
              </span>
            )}
            {keyword.intent && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                keyword.intent === 'commercial' ? 'bg-utility-purple-50 text-utility-purple-700' :
                keyword.intent === 'informational' ? 'bg-utility-blue-50 text-utility-blue-700' :
                keyword.intent === 'navigational' ? 'bg-utility-cyan-50 text-utility-cyan-700' :
                'bg-utility-pink-50 text-utility-pink-700'
              }`}>
                {keyword.intent}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
