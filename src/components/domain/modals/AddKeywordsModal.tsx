"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { Button } from "@/components/base/buttons/button";
import { toast } from "sonner";
import { X, Plus, Stars01 } from "@untitledui/icons";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface AddKeywordsModalProps {
  domainId: Id<"domains">;
  isOpen: boolean;
  onClose: () => void;
}

export function AddKeywordsModal({ domainId, isOpen, onClose }: AddKeywordsModalProps) {
  const t = useTranslations('keywords');
  const tc = useTranslations('common');
  useEscapeClose(onClose, isOpen);
  const [keywordsText, setKeywordsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const addKeywordsMutation = useMutation(api.keywords.addKeywords);
  const discoveredKeywords = useQuery(api.dataforseo.getDiscoveredKeywords, { domainId });

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const phrases = keywordsText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (phrases.length === 0) {
      toast.error(t('pleaseEnterKeyword'));
      return;
    }

    try {
      setIsSubmitting(true);
      await addKeywordsMutation({ domainId, phrases });
      toast.success(t('addedKeywordsToMonitoring', { count: phrases.length }));
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative bg-primary rounded-xl border border-secondary shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-secondary">
            <div>
              <h2 className="text-lg font-semibold text-primary">{t('addKeywordsToMonitor')}</h2>
              <p className="text-sm text-tertiary mt-1">{t('addKeywordsDescription')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-tertiary hover:text-primary transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
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
              className="w-full h-64 px-3 py-2 rounded-lg border border-secondary bg-primary text-primary placeholder-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            {/* Info */}
            <div className="rounded-lg border border-utility-blue-200 bg-utility-blue-50 p-3">
              <p className="text-xs text-utility-blue-900">
                {t('suggestedKeywordsInfo')}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-secondary">
            <Button
              size="md"
              color="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {tc('cancel')}
            </Button>
            <Button
              size="md"
              color="primary"
              iconLeading={Plus}
              onClick={handleSubmit}
              disabled={isSubmitting || keywordsText.trim().length === 0}
            >
              {isSubmitting ? t('adding') : t('addKeywords')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
