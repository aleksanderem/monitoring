"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import {
  XClose,
  Eye,
  Lightbulb02,
  Target04,
  TrendUp02,
  SearchLg,
  BarChartSquare02,
  LinkExternal01,
  CheckCircle,
  AlertTriangle,
  Zap,
  FileSearch02,
  Edit05,
  HelpCircle,
} from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { toast } from "sonner";

interface ContentGapDetailModalProps {
  opportunity: any;
  isOpen: boolean;
  onClose: () => void;
  domainId: Id<"domains">;
}

function formatNumber(num: number | null | undefined): string {
  if (!num && num !== 0) return "—";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getPriorityBadgeColor(priority: string): "success" | "warning" | "gray" {
  if (priority === "high") return "success";
  if (priority === "medium") return "warning";
  return "gray";
}

function getStatusBadgeColor(status: string): "success" | "warning" | "gray" | "brand" {
  if (status === "ranking") return "success";
  if (status === "monitoring") return "brand";
  if (status === "identified") return "warning";
  return "gray";
}

function getDifficultyLabel(difficulty: number): { labelKey: string; color: string } {
  if (difficulty >= 70) return { labelKey: "recBadgeHard", color: "text-utility-error-600" };
  if (difficulty >= 40) return { labelKey: "recBadgeMedium", color: "text-utility-warning-600" };
  return { labelKey: "recBadgeEasy", color: "text-utility-success-600" };
}

interface Recommendation {
  titleKey: string;
  descriptionKey: string;
  descriptionParams?: Record<string, any>;
  icon: typeof Lightbulb02;
  badgeColor: "success" | "warning" | "error" | "brand" | "gray" | "blue";
}

function getRecommendations(opportunity: any): Recommendation[] {
  const recs: Recommendation[] = [];

  // Difficulty-based recommendation
  if (opportunity.difficulty < 30) {
    recs.push({
      titleKey: "recEasyWin",
      descriptionKey: "recEasyWinDesc",
      icon: Zap,
      badgeColor: "success",
    });
  } else if (opportunity.difficulty < 50) {
    recs.push({
      titleKey: "recModerateEffort",
      descriptionKey: "recModerateEffortDesc",
      icon: Edit05,
      badgeColor: "warning",
    });
  } else {
    recs.push({
      titleKey: "recHighCompetition",
      descriptionKey: "recHighCompetitionDesc",
      icon: AlertTriangle,
      badgeColor: "error",
    });
  }

  // High-value target
  if (opportunity.competitorPosition <= 3 && opportunity.searchVolume > 1000) {
    recs.push({
      titleKey: "recHighValueTarget",
      descriptionKey: "recHighValueTargetDesc",
      icon: Target04,
      badgeColor: "brand",
    });
  }

  // Traffic opportunity
  if (opportunity.searchVolume > 5000) {
    recs.push({
      titleKey: "recSignificantTraffic",
      descriptionKey: "recSignificantTrafficDesc",
      icon: TrendUp02,
      badgeColor: "blue",
    });
  }

  // New content needed
  if (opportunity.yourPosition === null || opportunity.yourPosition === undefined) {
    recs.push({
      titleKey: "recCreateNewContent",
      descriptionKey: "recCreateNewContentDesc",
      icon: FileSearch02,
      badgeColor: "gray",
    });
  } else if (opportunity.yourPosition > 20) {
    recs.push({
      titleKey: "recImproveExisting",
      descriptionKey: "recImproveExistingDesc",
      descriptionParams: { position: opportunity.yourPosition },
      icon: Edit05,
      badgeColor: "warning",
    });
  }

  // Low volume but easy
  if (opportunity.searchVolume < 500 && opportunity.difficulty < 20) {
    recs.push({
      titleKey: "recQuickContentPiece",
      descriptionKey: "recQuickContentPieceDesc",
      icon: CheckCircle,
      badgeColor: "success",
    });
  }

  return recs;
}

export function ContentGapDetailModal({
  opportunity,
  isOpen,
  onClose,
  domainId,
}: ContentGapDetailModalProps) {
  const [isActioning, setIsActioning] = useState(false);
  const t = useTranslations('competitors');
  const tc = useTranslations('common');
  const translateStatus = (status: string) => {
    const key = `status${status.charAt(0).toUpperCase()}${status.slice(1)}` as any;
    try { return tc(key); } catch { return status; }
  };
  useEscapeClose(onClose, isOpen);

  const markAsMonitoring = useMutation(api.contentGap.markOpportunityAsMonitoring);
  const dismissOpportunity = useMutation(api.contentGap.dismissOpportunity);

  if (!isOpen || !opportunity) return null;

  // Score breakdown calculation (must match backend formula in contentGap.ts)
  const volumeScore = Math.min(((opportunity.searchVolume ?? 0) / 10000) * 50, 50);
  const difficultyScore = Math.max(50 - (opportunity.difficulty ?? 50) / 2, 0);
  const compPos = opportunity.competitorPosition;
  const positionBonus =
    compPos !== null && compPos !== undefined && compPos > 0
      ? (compPos <= 3 ? 20 : compPos <= 10 ? 10 : 0)
      : 0;
  const totalCalculated = Math.min(
    Math.round(volumeScore + difficultyScore + positionBonus),
    100
  );

  const recommendations = getRecommendations(opportunity);
  const difficultyInfo = getDifficultyLabel(opportunity.difficulty);

  const handleMonitor = async () => {
    setIsActioning(true);
    try {
      await markAsMonitoring({ gapId: opportunity._id });
      toast.success(t('toastMonitoringStarted', { keyword: opportunity.keywordPhrase }));
      onClose();
    } catch (error: any) {
      toast.error(error.message || t('toastMonitoringFailed'));
    } finally {
      setIsActioning(false);
    }
  };

  const handleDismiss = async () => {
    setIsActioning(true);
    try {
      await dismissOpportunity({ gapId: opportunity._id });
      toast.success(t('toastDismissed', { keyword: opportunity.keywordPhrase }));
      onClose();
    } catch (error: any) {
      toast.error(error.message || t('toastDismissFailed'));
    } finally {
      setIsActioning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-overlay/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="relative rounded-xl border border-secondary bg-primary dark:bg-[#1f2530] shadow-xl">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          {/* Header */}
          <div className="flex items-center justify-between border-b border-secondary p-6">
            <div>
              <h2 className="text-xl font-semibold text-primary">
                {opportunity.keywordPhrase || t('contentGapDetailKeywordDetails')}
              </h2>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge color={getPriorityBadgeColor(opportunity.priority)} size="sm">
                  {opportunity.priority} {t('priority')}
                </Badge>
                <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                  {t('contentGapDetailScore', { score: opportunity.opportunityScore })}
                </span>
                <span className="text-sm text-tertiary">
                  vs {opportunity.competitorDomain || opportunity.competitorName}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              color="secondary"
              iconLeading={XClose}
              onClick={onClose}
            >
              {t('close')}
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Section: Why This Is An Opportunity */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb02 className="h-5 w-5 text-utility-warning-500" />
                <h3 className="text-base font-semibold text-primary">
                  {t('contentGapDetailWhyOpportunity')}
                </h3>
                <Tooltip
                  title={t('contentGapDetailScoreBreakdown')}
                  description={t('contentGapDetailScoreBreakdownDesc')}
                >
                  <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                    <HelpCircle className="size-4" />
                  </TooltipTrigger>
                </Tooltip>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Volume Score */}
                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-tertiary">{t('contentGapDetailVolumeScore')}</p>
                    <span className="text-lg font-semibold text-primary">
                      {Math.round(volumeScore)}/50
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full bg-utility-blue-500"
                      style={{ width: `${(volumeScore / 50) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-tertiary">
                    {t('contentGapDetailVolumeDesc', { volume: formatNumber(opportunity.searchVolume) })}
                  </p>
                </div>

                {/* Difficulty Score */}
                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-tertiary">{t('contentGapDetailDifficultyBonus')}</p>
                    <span className="text-lg font-semibold text-primary">
                      {Math.round(difficultyScore)}/50
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full bg-utility-success-500"
                      style={{ width: `${(difficultyScore / 50) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-tertiary">
                    {t('contentGapDetailDifficultyDesc', { difficulty: opportunity.difficulty, label: t(difficultyInfo.labelKey) })}
                  </p>
                </div>

                {/* Position Bonus */}
                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-tertiary">{t('contentGapDetailPositionBonus')}</p>
                    <span className="text-lg font-semibold text-primary">
                      +{positionBonus}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full bg-utility-purple-500"
                      style={{ width: `${(positionBonus / 20) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-tertiary">
                    {t('contentGapDetailCompetitorRanks', { position: opportunity.competitorPosition })}{' '}
                    {positionBonus === 20
                      ? t('contentGapDetailPositionTop3')
                      : positionBonus === 10
                        ? t('contentGapDetailPositionTop10')
                        : t('contentGapDetailPositionOutside')}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-secondary/20 px-4 py-2.5">
                <p className="text-sm text-secondary">
                  <span className="font-medium">{t('contentGapDetailTotal')}</span>{" "}
                  {Math.round(volumeScore)} + {Math.round(difficultyScore)} + {positionBonus} ={" "}
                  <span className="font-semibold text-brand-secondary">{totalCalculated}</span>/100
                </p>
              </div>
            </div>

            {/* Section: Competitor Analysis */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target04 className="h-5 w-5 text-utility-error-500" />
                <h3 className="text-base font-semibold text-primary">
                  {t('contentGapDetailCompetitorAnalysis')}
                </h3>
                <Tooltip
                  title={t('contentGapDetailWhoRanks')}
                  description={t('contentGapDetailWhoRanksDesc')}
                >
                  <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                    <HelpCircle className="size-4" />
                  </TooltipTrigger>
                </Tooltip>
              </div>

              <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-utility-error-50 flex items-center justify-center">
                    <span className="text-sm font-bold text-utility-error-700">
                      #{opportunity.competitorPosition}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-primary">
                        {opportunity.competitorDomain || opportunity.competitorName}
                      </span>
                      <Badge color="error" size="sm">
                        {t('contentGapDetailCompPosition')} #{opportunity.competitorPosition}
                      </Badge>
                    </div>
                    {opportunity.competitorUrl && (
                      <a
                        href={opportunity.competitorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-utility-blue-600 hover:text-utility-blue-700 hover:underline break-all"
                      >
                        <LinkExternal01 className="h-3 w-3 flex-shrink-0" />
                        {opportunity.competitorUrl}
                      </a>
                    )}
                  </div>
                </div>

                {/* Your position comparison */}
                {opportunity.yourPosition !== null &&
                  opportunity.yourPosition !== undefined && (
                    <div className="mt-4 pt-4 border-t border-secondary">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-tertiary">{t('contentGapDetailYourPosition')}</span>
                          <Badge color="warning" size="sm">
                            #{opportunity.yourPosition}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-tertiary">{t('contentGapDetailGap')}</span>
                          <span className="text-sm font-medium text-utility-error-600">
                            {t('contentGapDetailPositionsBehind', { count: opportunity.yourPosition - opportunity.competitorPosition })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {(opportunity.yourPosition === null ||
                  opportunity.yourPosition === undefined) && (
                  <div className="mt-4 pt-4 border-t border-secondary">
                    <p className="text-xs text-tertiary">
                      {t('contentGapDetailNoRankingDesc')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Section: Keyword Metrics */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChartSquare02 className="h-5 w-5 text-utility-blue-500" />
                <h3 className="text-base font-semibold text-primary">
                  {t('contentGapDetailKeywordMetrics')}
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <p className="text-xs font-medium text-tertiary mb-1">{t('contentGapDetailSearchVolume')}</p>
                  <p className="text-lg font-semibold text-primary">
                    {formatNumber(opportunity.searchVolume)}
                  </p>
                  <p className="text-xs text-tertiary">{t('contentGapDetailMonthlySearches')}</p>
                </div>

                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <p className="text-xs font-medium text-tertiary mb-1">{t('contentGapDetailDifficulty')}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-primary">
                      {opportunity.difficulty}
                    </p>
                    <span className={`text-xs font-medium ${difficultyInfo.color}`}>
                      {t(difficultyInfo.labelKey)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        opportunity.difficulty >= 70
                          ? "bg-utility-error-500"
                          : opportunity.difficulty >= 40
                            ? "bg-utility-warning-500"
                            : "bg-utility-success-500"
                      }`}
                      style={{ width: `${opportunity.difficulty}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <p className="text-xs font-medium text-tertiary mb-1">{t('contentGapDetailEstTraffic')}</p>
                  <p className="text-lg font-semibold text-primary">
                    {formatNumber(opportunity.estimatedTrafficValue)}
                  </p>
                  <p className="text-xs text-tertiary">{t('contentGapDetailPotentialMonthly')}</p>
                </div>

                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <p className="text-xs font-medium text-tertiary mb-1">{t('columnStatus')}</p>
                  <Badge color={getStatusBadgeColor(opportunity.status)} size="sm">
                    {translateStatus(opportunity.status)}
                  </Badge>
                </div>

                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <p className="text-xs font-medium text-tertiary mb-1">{t('contentGapDetailIdentified')}</p>
                  <p className="text-sm text-primary">
                    {opportunity.identifiedAt
                      ? new Date(opportunity.identifiedAt).toLocaleDateString()
                      : "—"}
                  </p>
                </div>

                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <p className="text-xs font-medium text-tertiary mb-1">{t('contentGapDetailLastChecked')}</p>
                  <p className="text-sm text-primary">
                    {opportunity.lastChecked
                      ? new Date(opportunity.lastChecked).toLocaleDateString()
                      : "—"}
                  </p>
                </div>

                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <p className="text-xs font-medium text-tertiary mb-1">{t('contentGapDetailCompPosition')}</p>
                  <p className="text-lg font-semibold text-primary">
                    #{opportunity.competitorPosition}
                  </p>
                </div>

                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <p className="text-xs font-medium text-tertiary mb-1">{t('contentGapDetailOpportunityScore')}</p>
                  <p className="text-lg font-semibold text-brand-secondary">
                    {opportunity.opportunityScore}/100
                  </p>
                </div>
              </div>
            </div>

            {/* Section: Recommended Actions */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-5 w-5 text-utility-success-500" />
                <h3 className="text-base font-semibold text-primary">
                  {t('contentGapDetailRecommendedActions')}
                </h3>
                <Tooltip
                  title={t('contentGapDetailWhatToDo')}
                  description={t('contentGapDetailWhatToDoDesc')}
                >
                  <TooltipTrigger className="text-fg-quaternary hover:text-fg-quaternary_hover">
                    <HelpCircle className="size-4" />
                  </TooltipTrigger>
                </Tooltip>
              </div>

              <div className="space-y-3">
                {recommendations.map((rec, idx) => {
                  const Icon = rec.icon;
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-secondary p-4"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <Icon className="h-5 w-5 text-tertiary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-primary">
                            {t(rec.titleKey)}
                          </span>
                          <Badge color={rec.badgeColor} size="sm">
                            {rec.badgeColor === "success"
                              ? t('recBadgeEasy')
                              : rec.badgeColor === "warning"
                                ? t('recBadgeMedium')
                                : rec.badgeColor === "error"
                                  ? t('recBadgeHard')
                                  : t('recBadgeInfo')}
                          </Badge>
                        </div>
                        <p className="text-sm text-tertiary">{t(rec.descriptionKey, rec.descriptionParams)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-secondary">
              {opportunity.status === "identified" && (
                <Button
                  size="md"
                  color="primary"
                  iconLeading={Eye}
                  onClick={handleMonitor}
                  disabled={isActioning}
                >
                  {isActioning ? t('contentGapDetailProcessing') : t('contentGapDetailStartMonitoring')}
                </Button>
              )}
              {opportunity.status !== "dismissed" && (
                <Button
                  size="md"
                  color="secondary"
                  iconLeading={XClose}
                  onClick={handleDismiss}
                  disabled={isActioning}
                >
                  {t('contentGapDetailDismiss')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
