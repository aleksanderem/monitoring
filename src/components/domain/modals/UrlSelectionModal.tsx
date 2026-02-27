"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dialog, Modal, ModalOverlay, DialogTrigger } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Button } from "@/components/base/buttons/button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { AlertCircle, Globe01 } from "@untitledui/icons";
import { Heading as AriaHeading } from "react-aria-components";
import { toast } from "sonner";
import { UrlSelectionTable } from "../tables/UrlSelectionTable";

interface UrlSelectionModalProps {
  domainId: Id<"domains">;
  isOpen: boolean;
  onClose: () => void;
  onScanStarted: () => void;
}

export function UrlSelectionModal({
  domainId,
  isOpen,
  onClose,
  onScanStarted
}: UrlSelectionModalProps) {
  const t = useTranslations('domains');
  const [urls, setUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customSitemapUrl, setCustomSitemapUrl] = useState("");
  const [sitemapSource, setSitemapSource] = useState<"auto" | "custom" | "manual">("auto");

  const fetchUrls = useAction(api.seoAudit_actions.fetchAvailableUrlsV2);
  const triggerInstantPagesScan = useMutation(api.seoAudit_actions.triggerInstantPagesScan);
  const scanUrls = useAction(api.seoAudit_actions.scanSelectedUrlsV2);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function doFetch() {
      console.log("[UrlSelectionModal] Starting fetch URLs...");
      setLoading(true);
      setError(null);

      try {
        console.log("[UrlSelectionModal] Calling fetchUrls action with domainId:", domainId);
        const result = await fetchUrls({
          domainId,
          sitemapUrl: customSitemapUrl || undefined
        });

        if (cancelled) return;

        console.log("[UrlSelectionModal] fetchUrls result:", result);

        if (result.error) {
          console.error("[UrlSelectionModal] Error from fetchUrls:", result.error);
          setError(result.error);
          setSitemapSource("manual");
        } else {
          console.log("[UrlSelectionModal] Got", result.urls.length, "URLs");
          setUrls(result.urls);
          setSitemapSource(result.source === "custom_sitemap" ? "custom" : "auto");

          const firstTwenty = new Set(result.urls.slice(0, 20));
          setSelectedUrls(firstTwenty);
          console.log("[UrlSelectionModal] Auto-selected first", firstTwenty.size, "URLs");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[UrlSelectionModal] Exception in handleFetchUrls:", err);
        setError(err instanceof Error ? err.message : t('failedToFetchUrls'));
        setSitemapSource("manual");
      } finally {
        if (!cancelled) {
          setLoading(false);
          console.log("[UrlSelectionModal] Fetch complete, loading =", false);
        }
      }
    }

    doFetch();
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleFetchUrls = async () => {
    console.log("[UrlSelectionModal] Starting fetch URLs...");
    setLoading(true);
    setError(null);

    try {
      console.log("[UrlSelectionModal] Calling fetchUrls action with domainId:", domainId);
      const result = await fetchUrls({
        domainId,
        sitemapUrl: customSitemapUrl || undefined
      });

      console.log("[UrlSelectionModal] fetchUrls result:", result);

      if (result.error) {
        console.error("[UrlSelectionModal] Error from fetchUrls:", result.error);
        setError(result.error);
        setSitemapSource("manual");
      } else {
        console.log("[UrlSelectionModal] Got", result.urls.length, "URLs");
        setUrls(result.urls);
        setSitemapSource(result.source === "custom_sitemap" ? "custom" : "auto");

        // Auto-select first 20 URLs
        const firstTwenty = new Set(result.urls.slice(0, 20));
        setSelectedUrls(firstTwenty);
        console.log("[UrlSelectionModal] Auto-selected first", firstTwenty.size, "URLs");
      }
    } catch (err) {
      console.error("[UrlSelectionModal] Exception in handleFetchUrls:", err);
      setError(err instanceof Error ? err.message : t('failedToFetchUrls'));
      setSitemapSource("manual");
    } finally {
      setLoading(false);
      console.log("[UrlSelectionModal] Fetch complete, loading =", false);
    }
  };

  const handleScan = async () => {
    if (selectedUrls.size === 0) {
      toast.error(t('selectAtLeastOneUrl'));
      return;
    }

    setScanning(true);

    try {
      // First create the scan record (WITHOUT starting full site crawl)
      console.log("[UrlSelectionModal] Creating Instant Pages scan record...");
      const scanId = await triggerInstantPagesScan({ domainId });
      console.log("[UrlSelectionModal] Got scanId:", scanId);

      // Then start scanning the selected URLs
      console.log("[UrlSelectionModal] Starting URL scan...");
      await scanUrls({
        domainId,
        scanId,
        urls: Array.from(selectedUrls),
      });

      toast.success(
        t('scanStartedToast', { count: selectedUrls.size }),
      );

      onScanStarted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('failedToStartScan'));
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const toggleUrl = (url: string) => {
    const newSelected = new Set(selectedUrls);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedUrls(newSelected);
  };

  const toggleAll = (urlsToToggle: string[]) => {
    const allSelected = urlsToToggle.every((url) => selectedUrls.has(url));
    const newSelected = new Set(selectedUrls);

    if (allSelected) {
      // Deselect all
      urlsToToggle.forEach((url) => newSelected.delete(url));
    } else {
      // Select all
      urlsToToggle.forEach((url) => newSelected.add(url));
    }

    setSelectedUrls(newSelected);
  };

  const handleManualInput = () => {
    const manualUrls = prompt("Enter URLs (one per line):");
    if (manualUrls) {
      const urlList = manualUrls.split("\n").filter(u => u.trim());
      setUrls(urlList);
      setSelectedUrls(new Set(urlList));
      setSitemapSource("manual");
    }
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalOverlay isDismissable>
        <Modal>
          <Dialog className="overflow-hidden">
            <div className="relative w-full overflow-hidden rounded-2xl bg-primary shadow-xl sm:max-w-6xl">
              <CloseButton
                onPress={onClose}
                theme="light"
                size="lg"
                className="absolute top-3 right-3 z-10"
              />

              {/* Header */}
              <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                <div className="relative w-max">
                  <FeaturedIcon color="brand" size="lg" theme="light" icon={Globe01} />
                  <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="z-10 flex flex-col gap-0.5">
                  <AriaHeading slot="title" className="text-md font-semibold text-primary">
                    {t('selectUrlsToScan')}
                  </AriaHeading>
                  <p className="text-sm text-tertiary">
                    {sitemapSource === "auto" && t('sitemapSourceAuto')}
                    {sitemapSource === "custom" && t('sitemapSourceCustom')}
                    {sitemapSource === "manual" && t('sitemapSourceManual')}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="max-h-[700px] overflow-y-auto px-6 py-4">
                {loading && (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                    <p className="mt-4 text-sm text-tertiary">{t('fetchingUrlsFromSitemap')}</p>
                  </div>
                )}

                {error && (
                  <div className="mb-4 rounded-lg border border-error-primary bg-error-secondary p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-error-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-primary mb-1">
                          {t('couldNotFetchSitemap')}
                        </h3>
                        <p className="text-sm text-secondary mb-3">{error}</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={t('enterCustomSitemapUrl')}
                            value={customSitemapUrl}
                            onChange={(e) => setCustomSitemapUrl(e.target.value)}
                            className="flex-1 px-3 py-2 border border-secondary bg-primary rounded-lg text-sm text-primary placeholder:text-quaternary focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
                          />
                          <Button
                            size="sm"
                            color="secondary"
                            onClick={handleFetchUrls}
                          >
                            {t('tryAgain')}
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          color="tertiary"
                          onClick={handleManualInput}
                          className="mt-2"
                        >
                          {t('orEnterUrlsManually')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {!loading && !error && urls.length > 0 && (
                  <UrlSelectionTable
                    urls={urls}
                    selectedUrls={selectedUrls}
                    onToggleUrl={toggleUrl}
                    onToggleAll={toggleAll}
                  />
                )}
              </div>

              {/* Footer */}
              {!loading && urls.length > 0 && (
                <div className="border-t border-secondary px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-tertiary">
                      {selectedUrls.size} of {urls.length} {t('urlsSelected')}
                      {selectedUrls.size > 20 && (
                        <span className="ml-2 text-warning-primary">
                          {t('scanBatchDescription')}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        color="secondary"
                        size="sm"
                        onClick={onClose}
                      >
                        {t('cancel')}
                      </Button>
                      <Button
                        color="primary"
                        size="sm"
                        onClick={handleScan}
                        isDisabled={selectedUrls.size === 0 || scanning}
                      >
                        {scanning ? t('startingScan') : t('scanCountUrls', { count: selectedUrls.size })}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
