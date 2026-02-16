"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SearchLg, Globe01, Plus } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Dialog, Modal, ModalOverlay, DialogTrigger } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Heading } from "react-aria-components";

interface AddCompetitorModalProps {
  domainId: Id<"domains">;
  isOpen: boolean;
  onClose: () => void;
  /** Called after a competitor is successfully added. Receives the new competitorId. */
  onCompetitorAdded?: (competitorId: Id<"competitors">, domain: string) => void;
}

export function AddCompetitorModal({
  domainId,
  isOpen,
  onClose,
  onCompetitorAdded,
}: AddCompetitorModalProps) {
  const t = useTranslations('competitors');
  const tc = useTranslations('common');
  const [addTab, setAddTab] = useState<"serp" | "dfs" | "manual">("serp");
  const [competitorDomain, setCompetitorDomain] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [addingSuggestion, setAddingSuggestion] = useState<string | null>(null);
  const [dfsLoading, setDfsLoading] = useState(false);
  const [dfsSuggestions, setDfsSuggestions] = useState<Array<{
    domain: string;
    intersections: number;
    avgPosition: number | null;
    etv: number;
  }> | null>(null);

  const addCompetitor = useMutation(api.competitors.addCompetitor);
  const suggestCompetitors = useAction(api.competitors_actions.suggestCompetitors);

  const serpSuggestions = useQuery(
    api.competitors.getCompetitorSuggestionsFromSerp,
    isOpen ? { domainId } : "skip"
  );

  function handleClose() {
    onClose();
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setDfsSuggestions(null);
      setAddTab("serp");
      setCompetitorDomain("");
      setCompetitorName("");
      handleClose();
    }
  }

  async function handleFetchDfsSuggestions() {
    setDfsLoading(true);
    try {
      const result = await suggestCompetitors({ domainId });
      if (result.success) {
        setDfsSuggestions(result.competitors);
      } else {
        toast.error(result.error || t('addCompetitorToastFailed'));
      }
    } catch (error: any) {
      toast.error(error?.message || t('addCompetitorToastFailed'));
    } finally {
      setDfsLoading(false);
    }
  }

  async function handleAddSuggestion(domain: string) {
    setAddingSuggestion(domain);
    try {
      const competitorId = await addCompetitor({
        domainId,
        competitorDomain: domain,
      });
      toast.success(t('addCompetitorToastAdded'));
      onCompetitorAdded?.(competitorId, domain);
    } catch (error: any) {
      toast.error(error?.message || t('addCompetitorToastFailed'));
    } finally {
      setAddingSuggestion(null);
    }
  }

  async function handleAddManual() {
    if (!competitorDomain.trim()) {
      toast.error(t('addCompetitorToastFailed'));
      return;
    }
    try {
      const competitorId = await addCompetitor({
        domainId,
        competitorDomain: competitorDomain.trim(),
        name: competitorName.trim() || undefined,
      });
      toast.success(t('addCompetitorToastAdded'));
      setCompetitorDomain("");
      setCompetitorName("");
      handleClose();
      onCompetitorAdded?.(competitorId, competitorDomain.trim());
    } catch (error: any) {
      toast.error(error?.message || t('addCompetitorToastFailed'));
    }
  }

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <ModalOverlay isDismissable>
        <Modal>
          <Dialog className="overflow-hidden">
            <div className="relative w-full overflow-hidden rounded-xl bg-primary shadow-xl sm:max-w-2xl">
              <CloseButton
                onClick={handleClose}
                theme="light"
                size="lg"
                className="absolute top-3 right-3 z-10"
              />
              <div className="border-b border-secondary px-6 py-4">
                <Heading slot="title" className="text-lg font-semibold text-primary">
                  {t('addCompetitorTitle')}
                </Heading>
                <p className="mt-1 text-sm text-tertiary">
                  {t('addCompetitorSubtitle')}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-secondary">
                {([
                  { key: "serp" as const, label: t('addCompetitorTabSerp'), Icon: SearchLg },
                  { key: "dfs" as const, label: t('addCompetitorTabSuggest'), Icon: Globe01 },
                  { key: "manual" as const, label: t('addCompetitorTabManual'), Icon: Plus },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setAddTab(tab.key)}
                    className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                      addTab === tab.key
                        ? "border-b-2 border-brand-primary text-brand-primary"
                        : "text-tertiary hover:text-primary"
                    }`}
                  >
                    <tab.Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="min-h-[320px]">
                {/* SERP Discovery Tab */}
                {addTab === "serp" && (
                  <div className="px-6 py-4">
                    <p className="mb-3 text-sm text-tertiary">
                      {t('addCompetitorSerpDesc')}
                    </p>
                    {serpSuggestions === undefined ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800" />
                        ))}
                      </div>
                    ) : serpSuggestions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <SearchLg className="mb-2 h-8 w-8 text-fg-quaternary" />
                        <p className="text-sm text-tertiary">{t('addCompetitorSerpEmpty')}</p>
                        <p className="mt-1 text-xs text-quaternary">{t('addCompetitorSerpEmptyHint')}</p>
                      </div>
                    ) : (
                      <div className="max-h-[340px] space-y-1 overflow-y-auto">
                        {serpSuggestions.map((s) => (
                          <div
                            key={s.domain}
                            className="flex items-center justify-between rounded-lg border border-secondary px-3 py-2 hover:bg-primary_hover"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-primary">{s.domain}</span>
                                <span className="rounded-full bg-utility-brand-50 px-1.5 py-0.5 text-xs font-medium text-utility-brand-600">
                                  {s.keywordOverlap} keywords
                                </span>
                                <span className="text-xs text-tertiary">
                                  avg #{s.avgPosition}
                                </span>
                              </div>
                              <div className="mt-0.5 flex gap-1">
                                {s.sampleKeywords.map((kw, i) => (
                                  <span key={i} className="truncate text-xs text-quaternary">
                                    {kw}{i < s.sampleKeywords.length - 1 ? "," : ""}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <Button
                              color="secondary"
                              size="sm"
                              onClick={() => handleAddSuggestion(s.domain)}
                              isDisabled={addingSuggestion === s.domain}
                              className="ml-3 shrink-0"
                            >
                              {addingSuggestion === s.domain ? tc('loading') : tc('add')}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Suggest Competitors Tab */}
                {addTab === "dfs" && (
                  <div className="px-6 py-4">
                    <p className="mb-3 text-sm text-tertiary">
                      {t('addCompetitorSuggestDesc')}
                    </p>
                    {!dfsSuggestions && !dfsLoading && (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Globe01 className="mb-2 h-8 w-8 text-fg-quaternary" />
                        <p className="mb-3 text-sm text-tertiary">{t('clickToDiscoverCompetitors')}</p>
                        <Button color="primary" size="md" onClick={handleFetchDfsSuggestions}>
                          <SearchLg className="h-4 w-4" />
                          {t('addCompetitorSuggestFind')}
                        </Button>
                      </div>
                    )}
                    {dfsLoading && !dfsSuggestions && (
                      <div className="space-y-2">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800" />
                        ))}
                        <p className="mt-2 text-center text-xs text-tertiary">{t('addCompetitorSuggestAnalyzing')}</p>
                      </div>
                    )}
                    {dfsSuggestions && dfsSuggestions.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12">
                        <p className="text-sm text-tertiary">{t('addCompetitorSuggestEmpty')}</p>
                      </div>
                    )}
                    {dfsSuggestions && dfsSuggestions.length > 0 && (
                      <div className="max-h-[340px] space-y-1 overflow-y-auto">
                        {dfsSuggestions.map((s) => (
                          <div
                            key={s.domain}
                            className="flex items-center justify-between rounded-lg border border-secondary px-3 py-2 hover:bg-primary_hover"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-primary">{s.domain}</span>
                                <span className="rounded-full bg-utility-success-50 px-1.5 py-0.5 text-xs font-medium text-utility-success-600">
                                  {s.intersections} common keywords
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-3 text-xs text-tertiary">
                                {s.avgPosition && <span>avg position #{s.avgPosition}</span>}
                                {s.etv > 0 && <span>~{s.etv.toLocaleString()} monthly visits</span>}
                              </div>
                            </div>
                            <Button
                              color="secondary"
                              size="sm"
                              onClick={() => handleAddSuggestion(s.domain)}
                              isDisabled={addingSuggestion === s.domain}
                              className="ml-3 shrink-0"
                            >
                              {addingSuggestion === s.domain ? tc('loading') : tc('add')}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Add Manually Tab */}
                {addTab === "manual" && (
                  <div className="px-6 py-4">
                    <p className="mb-4 text-sm text-tertiary">
                      {t('addCompetitorManualDesc')}
                    </p>
                    <div className="space-y-3">
                      <Input
                        size="md"
                        label={t('addCompetitorManualDomain')}
                        placeholder={t('addCompetitorManualDomainHint')}
                        value={competitorDomain}
                        onChange={(value: string) => setCompetitorDomain(value)}
                        hint={t('addCompetitorManualDomainNote')}
                        isRequired
                      />
                      <Input
                        size="md"
                        label={t('addCompetitorManualDisplayName')}
                        placeholder={t('addCompetitorManualDisplayNameHint')}
                        value={competitorName}
                        onChange={(value: string) => setCompetitorName(value)}
                      />
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-3">
                      <Button color="secondary" size="md" onClick={handleClose}>
                        {tc('cancel')}
                      </Button>
                      <Button color="primary" size="md" onClick={handleAddManual}>
                        {t('competitorMgmtAddCompetitor')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
