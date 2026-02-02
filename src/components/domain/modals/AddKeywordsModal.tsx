"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { toast } from "sonner";
import { X, Plus, Stars01 } from "@untitledui/icons";

interface AddKeywordsModalProps {
  domainId: Id<"domains">;
  isOpen: boolean;
  onClose: () => void;
}

export function AddKeywordsModal({ domainId, isOpen, onClose }: AddKeywordsModalProps) {
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
      toast.error("Please enter at least one keyword");
      return;
    }

    try {
      setIsSubmitting(true);
      await addKeywordsMutation({ domainId, phrases });
      toast.success(`Added ${phrases.length} keyword${phrases.length > 1 ? 's' : ''} to monitoring`);
      setKeywordsText("");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add keywords");
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
      toast.info("No keyword suggestions available. Try refreshing visibility data first.");
      setIsLoadingSuggestions(false);
      return;
    }

    setKeywordsText(suggested.join("\n"));
    toast.success(`Suggested ${suggested.length} keywords based on rankings and volume`);
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
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-secondary">
            <div>
              <h2 className="text-lg font-semibold text-primary">Add Keywords to Monitor</h2>
              <p className="text-sm text-tertiary mt-1">Enter keywords manually or get AI suggestions</p>
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
                Keywords (one per line)
              </label>
              <Button
                size="sm"
                color="secondary"
                iconLeading={Stars01}
                onClick={handleSuggestKeywords}
                disabled={isLoadingSuggestions || !discoveredKeywords}
              >
                {isLoadingSuggestions ? "Loading..." : "Suggest Keywords"}
              </Button>
            </div>

            {/* Textarea */}
            <textarea
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="Enter keywords, one per line:&#10;example keyword 1&#10;example keyword 2&#10;example keyword 3"
              className="w-full h-64 px-3 py-2 rounded-lg border border-secondary bg-primary text-primary placeholder-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            {/* Info */}
            <div className="rounded-lg border border-utility-blue-200 bg-utility-blue-50 p-3">
              <p className="text-xs text-utility-blue-900">
                <strong>Suggested keywords</strong> are based on your current rankings (top 20 positions) and search volume.
                These keywords are already performing well and worth monitoring closely.
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
              Cancel
            </Button>
            <Button
              size="md"
              color="primary"
              iconLeading={Plus}
              onClick={handleSubmit}
              disabled={isSubmitting || keywordsText.trim().length === 0}
            >
              {isSubmitting ? "Adding..." : "Add Keywords"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
