"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { Button } from "@/components/base/buttons/button";
import { toast } from "sonner";
import { Plus, Stars01 } from "@untitledui/icons";
import { DialogTrigger, ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { Heading as AriaHeading } from "react-aria-components";

interface AddKeywordsModalProps {
  domainId: Id<"domains">;
  isOpen: boolean;
  onClose: () => void;
}

export function AddKeywordsModal({ domainId, isOpen, onClose }: AddKeywordsModalProps) {
  const t = useTranslations('keywords');
  const tc = useTranslations('common');
  const [keywordsText, setKeywordsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const addKeywordsMutation = useMutation(api.keywords.addKeywords);
  const discoveredKeywords = useQuery(api.dataforseo.getDiscoveredKeywords, { domainId });
  const limitStatus = useQuery(api.limits.checkAddKeywordsLimit, isOpen ? { domainId } : "skip");

  // Client-side validation matching server rules (convex/lib/keywordValidation.ts)
  const validatePhrase = (phrase: string): string | null => {
    if (phrase.length < 2) return t('validationTooShort');
    if (phrase.length > 80) return t('validationTooLong');
    if (/^https?:\/\//i.test(phrase)) return t('validationLooksLikeUrl');
    if (/^[a-z0-9-]+\.[a-z]{2,}(\/\S*)?$/i.test(phrase) && !phrase.includes(" ")) return t('validationLooksLikeDomain');
    if (/^\d+$/.test(phrase)) return t('validationJustNumbers');
    const nonAlpha = phrase.replace(/[a-z0-9\s]/gi, "").length;
    const nonSpace = phrase.replace(/\s/g, "").length;
    if (nonSpace > 0 && nonAlpha / nonSpace > 0.3) return t('validationTooManySpecialChars');
    return null;
  };

  const handleSubmit = async () => {
    const lines = keywordsText
      .split("\n")
      .map(line => line.trim().toLowerCase())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      toast.error(t('pleaseEnterKeyword'));
      return;
    }

    // Client-side validation + deduplication
    const valid: string[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();

    for (const phrase of lines) {
      if (seen.has(phrase)) continue; // Skip duplicates within input
      seen.add(phrase);
      const error = validatePhrase(phrase);
      if (error) {
        invalid.push(phrase);
      } else {
        valid.push(phrase);
      }
    }

    if (valid.length === 0) {
      toast.error(t('allKeywordsInvalid', { count: invalid.length }));
      return;
    }

    try {
      setIsSubmitting(true);
      const addedIds = await addKeywordsMutation({ domainId, phrases: valid });
      const addedCount = addedIds.length;
      const skippedCount = valid.length - addedCount;

      if (invalid.length > 0 || skippedCount > 0) {
        // Some were filtered — show detailed toast
        toast.success(t('addedKeywordsDetailed', {
          added: addedCount,
          skipped: skippedCount,
          invalid: invalid.length,
        }));
      } else {
        toast.success(t('addedKeywordsToMonitoring', { count: addedCount }));
      }

      setKeywordsText("");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('failedToAddKeywords'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuggestKeywords = () => {
    setIsLoadingSuggestions(true);

    // Get top keywords by ranking (position 1-20) and high search volume
    const suggested = (discoveredKeywords || [])
      .filter(kw =>
        kw.bestPosition > 0 &&
        kw.bestPosition <= 20 &&
        kw.bestPosition !== 999 &&
        (kw.searchVolume || 0) >= 100
      )
      .sort((a, b) => {
        // Prioritize by position, then volume
        const posA = a.bestPosition;
        const posB = b.bestPosition;
        if (posA !== posB) return posA - posB;
        return (b.searchVolume || 0) - (a.searchVolume || 0);
      })
      .slice(0, 10)
      .map(kw => kw.keyword);

    if (suggested.length === 0) {
      toast.info(t('noSuggestionsAvailable'));
      setIsLoadingSuggestions(false);
      return;
    }

    setKeywordsText(suggested.join("\n"));
    toast.success(t('suggestedKeywords', { count: suggested.length }));
    setIsLoadingSuggestions(false);
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModalOverlay isDismissable>
        <Modal className="max-w-2xl">
          <Dialog>
            <div className="relative w-full overflow-hidden rounded-2xl bg-primary shadow-xl sm:max-w-2xl">
              <CloseButton onPress={onClose} theme="light" size="lg" className="absolute top-3 right-3 z-10" />

              {/* Header with FeaturedIcon */}
              <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                <div className="relative w-max">
                  <FeaturedIcon color="brand" size="lg" theme="light" icon={Plus} />
                  <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="z-10 flex flex-col gap-0.5">
                  <AriaHeading slot="title" className="text-md font-semibold text-primary">
                    {t('addKeywordsToMonitor')}
                  </AriaHeading>
                  <p className="text-sm text-tertiary">{t('addKeywordsDescription')}</p>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 pt-4 sm:px-6">
                {/* Suggestions Button */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-primary">
                    {t('keywordsOnePerLine')}
                  </label>
                  <Button
                    size="sm"
                    color="secondary"
                    iconLeading={Stars01}
                    onClick={handleSuggestKeywords}
                    disabled={isLoadingSuggestions || !discoveredKeywords}
                  >
                    {isLoadingSuggestions ? tc('loading') : t('suggestKeywords')}
                  </Button>
                </div>

                {/* Textarea */}
                <textarea
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder={t('keywordsPlaceholder')}
                  className="mt-4 w-full h-64 px-3 py-2 rounded-lg border border-secondary bg-primary text-primary placeholder-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                />

                {/* Info */}
                <div className="mt-4 rounded-lg border border-utility-blue-200 bg-utility-blue-50 p-3">
                  <p className="text-xs text-utility-blue-900">
                    {t('suggestedKeywordsInfo')}
                  </p>
                </div>

                {/* Keyword limit warning */}
                {limitStatus && !limitStatus.allowed && (
                  <div className="mt-3 rounded-lg border border-utility-error-200 bg-utility-error-50 p-3">
                    <p className="text-xs font-medium text-utility-error-700">
                      {t('keywordLimitReached', {
                        current: limitStatus.currentCount,
                        limit: limitStatus.limit,
                        remaining: limitStatus.remaining ?? 0,
                      })}
                    </p>
                  </div>
                )}
                {limitStatus && limitStatus.allowed && limitStatus.remaining !== undefined && limitStatus.remaining <= 10 && (
                  <div className="mt-3 rounded-lg border border-utility-warning-200 bg-utility-warning-50 p-3">
                    <p className="text-xs font-medium text-utility-warning-700">
                      {t('keywordLimitWarning', { remaining: limitStatus.remaining })}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="z-10 flex flex-1 flex-col-reverse gap-3 p-4 pt-6 *:grow sm:grid sm:grid-cols-2 sm:px-6 sm:pt-8 sm:pb-6">
                <Button color="secondary" size="lg" onClick={onClose} disabled={isSubmitting}>
                  {tc('cancel')}
                </Button>
                <Button color="primary" size="lg" iconLeading={Plus} onClick={handleSubmit} disabled={isSubmitting || keywordsText.trim().length === 0 || (limitStatus !== undefined && !limitStatus?.allowed)}>
                  {isSubmitting ? t('adding') : t('addKeywords')}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
