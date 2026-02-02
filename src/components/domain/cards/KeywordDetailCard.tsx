"use client";

import {
  TrendUp01,
  TrendDown01,
  Target04,
  SearchLg,
  BarChart03,
  Link03,
  Star01,
  Award01
} from "@untitledui/icons";

interface KeywordDetailCardProps {
  keyword: any; // Full keyword object with all rich data
}

export function KeywordDetailCard({ keyword }: KeywordDetailCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* SEO Metrics Card */}
      <div className="rounded-lg border border-secondary bg-primary p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target04 className="h-5 w-5 text-utility-blue-600" />
          <h4 className="text-sm font-semibold text-primary">SEO Metrics</h4>
        </div>
        <dl className="space-y-2">
          {keyword.difficulty !== undefined && (
            <div className="flex justify-between items-center">
              <dt className="text-xs text-tertiary">Difficulty</dt>
              <dd className={`text-sm font-medium ${
                keyword.difficulty < 30 ? 'text-utility-success-600' :
                keyword.difficulty < 70 ? 'text-utility-warning-600' :
                'text-utility-error-600'
              }`}>
                {keyword.difficulty}/100
              </dd>
            </div>
          )}
          {keyword.competitionLevel && (
            <div className="flex justify-between items-center">
              <dt className="text-xs text-tertiary">Competition</dt>
              <dd>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  keyword.competitionLevel === 'LOW' ? 'bg-utility-success-50 text-utility-success-700' :
                  keyword.competitionLevel === 'MEDIUM' ? 'bg-utility-warning-50 text-utility-warning-700' :
                  'bg-utility-error-50 text-utility-error-700'
                }`}>
                  {keyword.competitionLevel}
                </span>
              </dd>
            </div>
          )}
          {keyword.cpc !== undefined && (
            <div className="flex justify-between items-center">
              <dt className="text-xs text-tertiary">CPC</dt>
              <dd className="text-sm font-medium text-primary">
                ${keyword.cpc.toFixed(2)}
              </dd>
            </div>
          )}
          {keyword.intent && (
            <div className="flex justify-between items-center">
              <dt className="text-xs text-tertiary">Intent</dt>
              <dd>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  keyword.intent === 'commercial' ? 'bg-utility-purple-50 text-utility-purple-700' :
                  keyword.intent === 'informational' ? 'bg-utility-blue-50 text-utility-blue-700' :
                  keyword.intent === 'navigational' ? 'bg-utility-cyan-50 text-utility-cyan-700' :
                  'bg-utility-pink-50 text-utility-pink-700'
                }`}>
                  {keyword.intent}
                </span>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Traffic Value Card */}
      <div className="rounded-lg border border-secondary bg-primary p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart03 className="h-5 w-5 text-utility-success-600" />
          <h4 className="text-sm font-semibold text-primary">Traffic Value</h4>
        </div>
        <dl className="space-y-2">
          {keyword.etv !== undefined && (
            <div className="flex justify-between items-center">
              <dt className="text-xs text-tertiary">ETV</dt>
              <dd className="text-sm font-medium text-primary">{keyword.etv.toFixed(2)}</dd>
            </div>
          )}
          {keyword.estimatedPaidTrafficCost !== undefined && (
            <div className="flex justify-between items-center">
              <dt className="text-xs text-tertiary">Paid Traffic Cost</dt>
              <dd className="text-sm font-medium text-primary">
                ${keyword.estimatedPaidTrafficCost.toFixed(2)}
              </dd>
            </div>
          )}
          {keyword.searchVolume && (
            <div className="flex justify-between items-center">
              <dt className="text-xs text-tertiary">Search Volume</dt>
              <dd className="text-sm font-medium text-primary">
                {keyword.searchVolume.toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Ranking Info Card */}
      <div className="rounded-lg border border-secondary bg-primary p-4">
        <div className="flex items-center gap-2 mb-3">
          <Award01 className="h-5 w-5 text-utility-warning-600" />
          <h4 className="text-sm font-semibold text-primary">Ranking Info</h4>
        </div>
        <dl className="space-y-2">
          {(keyword.position || keyword.bestPosition) && (
            <div className="flex justify-between items-center">
              <dt className="text-xs text-tertiary">Current Position</dt>
              <dd className="text-sm font-semibold text-primary">#{keyword.position || keyword.bestPosition}</dd>
            </div>
          )}
          {(keyword.previousRankAbsolute || keyword.previousPosition) && (
            <div className="flex justify-between items-center">
              <dt className="text-xs text-tertiary">Previous Position</dt>
              <dd className="text-sm text-tertiary">#{keyword.previousRankAbsolute || keyword.previousPosition}</dd>
            </div>
          )}
          {keyword.pageRank && (
            <div className="flex justify-between items-center">
              <dt className="text-xs text-tertiary">Page Rank</dt>
              <dd className="text-sm text-primary">{keyword.pageRank}</dd>
            </div>
          )}
          {keyword.mainDomainRank && (
            <div className="flex justify-between items-center">
              <dt className="text-xs text-tertiary">Domain Rank</dt>
              <dd className="text-sm text-primary">{keyword.mainDomainRank}</dd>
            </div>
          )}
          {(keyword.isNew || keyword.isUp || keyword.isDown) && (
            <div className="flex gap-1 mt-2">
              {keyword.isNew && (
                <span className="inline-flex items-center rounded-full bg-utility-blue-50 px-2 py-0.5 text-xs font-medium text-utility-blue-700">
                  New
                </span>
              )}
              {keyword.isUp && (
                <span className="inline-flex items-center gap-1 rounded-full bg-utility-success-50 px-2 py-0.5 text-xs font-medium text-utility-success-700">
                  <TrendUp01 className="h-3 w-3" /> Up
                </span>
              )}
              {keyword.isDown && (
                <span className="inline-flex items-center gap-1 rounded-full bg-utility-error-50 px-2 py-0.5 text-xs font-medium text-utility-error-700">
                  <TrendDown01 className="h-3 w-3" /> Down
                </span>
              )}
            </div>
          )}
        </dl>
      </div>

      {/* SERP Features */}
      {keyword.serpFeatures && keyword.serpFeatures.length > 0 && (
        <div className="rounded-lg border border-secondary bg-primary p-4">
          <div className="flex items-center gap-2 mb-3">
            <SearchLg className="h-5 w-5 text-utility-purple-600" />
            <h4 className="text-sm font-semibold text-primary">SERP Features</h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {keyword.serpFeatures.map((feature: string) => (
              <span
                key={feature}
                className="inline-flex items-center rounded-full bg-utility-gray-100 px-2 py-0.5 text-xs text-utility-gray-700"
              >
                {feature.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Backlinks Info */}
      {keyword.backlinksInfo && (
        <div className="rounded-lg border border-secondary bg-primary p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link03 className="h-5 w-5 text-utility-cyan-600" />
            <h4 className="text-sm font-semibold text-primary">Backlinks</h4>
          </div>
          <dl className="space-y-2">
            {keyword.backlinksInfo.referringDomains !== undefined && (
              <div className="flex justify-between items-center">
                <dt className="text-xs text-tertiary">Referring Domains</dt>
                <dd className="text-sm font-medium text-primary">
                  {keyword.backlinksInfo.referringDomains}
                </dd>
              </div>
            )}
            {keyword.backlinksInfo.referringPages !== undefined && (
              <div className="flex justify-between items-center">
                <dt className="text-xs text-tertiary">Referring Pages</dt>
                <dd className="text-sm font-medium text-primary">
                  {keyword.backlinksInfo.referringPages}
                </dd>
              </div>
            )}
            {keyword.backlinksInfo.dofollow !== undefined && (
              <div className="flex justify-between items-center">
                <dt className="text-xs text-tertiary">Dofollow</dt>
                <dd className="text-sm font-medium text-primary">
                  {keyword.backlinksInfo.dofollow}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Rating */}
      {keyword.rating && (
        <div className="rounded-lg border border-secondary bg-primary p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star01 className="h-5 w-5 text-utility-warning-500" />
            <h4 className="text-sm font-semibold text-primary">Rating</h4>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[...Array(keyword.rating.ratingMax)].map((_, i) => (
                <Star01
                  key={i}
                  className={`h-4 w-4 ${
                    i < keyword.rating.value
                      ? 'fill-utility-warning-500 text-utility-warning-500'
                      : 'text-utility-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-primary">
              {keyword.rating.value}/{keyword.rating.ratingMax}
            </span>
            <span className="text-xs text-tertiary">
              ({keyword.rating.votesCount} {keyword.rating.votesCount === 1 ? 'vote' : 'votes'})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
