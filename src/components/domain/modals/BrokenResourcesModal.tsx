"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dialog, Modal, ModalOverlay, DialogTrigger } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Button } from "@/components/base/buttons/button";
import { AlertCircle, Link01, Image01, File01, ArrowUpRight } from "@untitledui/icons";
import { Heading } from "react-aria-components";

interface BrokenResourcesModalProps {
  scanId: Id<"onSiteScans">;
  isOpen: boolean;
  onClose: () => void;
}

export function BrokenResourcesModal({ scanId, isOpen, onClose }: BrokenResourcesModalProps) {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchBrokenResources = useAction(api.onSite_actions.getBrokenResourcesDetails);

  const handleOpen = async () => {
    if (loaded) return; // Already loaded

    setLoading(true);
    setError(null);

    try {
      const result = await fetchBrokenResources({ scanId });

      if (result.error) {
        setError(result.error);
      } else {
        setResources(result.resources || []);
        setLoaded(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch broken resources");
    } finally {
      setLoading(false);
    }
  };

  const getResourceIcon = (resourceType: string) => {
    if (resourceType === "image") return Image01;
    if (resourceType === "script" || resourceType === "stylesheet") return File01;
    return Link01;
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode === 404) return "text-error-600";
    if (statusCode >= 500) return "text-error-700";
    return "text-warning-600";
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => {
      if (open) {
        handleOpen();
      } else {
        onClose();
      }
    }}>
      <ModalOverlay isDismissable>
        <Modal>
          <Dialog className="overflow-hidden">
            <div className="relative w-full overflow-hidden rounded-xl bg-white shadow-xl sm:max-w-3xl">
              <CloseButton
                onClick={onClose}
                theme="light"
                size="lg"
                className="absolute top-3 right-3 z-10"
              />

              {/* Header */}
              <div className="border-b border-gray-200 px-6 py-4">
                <Heading slot="title" className="text-lg font-semibold text-gray-900">
                  Broken Resources Details
                </Heading>
                <p className="mt-1 text-sm text-gray-600">
                  List of broken links and resources found during the scan
                </p>
              </div>

              {/* Content */}
              <div className="max-h-[600px] overflow-y-auto px-6 py-4">
                {loading && (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <p className="mt-4 text-sm text-gray-600">Loading broken resources...</p>
                  </div>
                )}

                {error && (
                  <div className="text-center py-12">
                    <div className="bg-error-50 rounded-full p-4 mb-4 inline-block">
                      <AlertCircle className="w-8 h-8 text-error-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Error Loading Resources
                    </h3>
                    <p className="text-sm text-gray-600">{error}</p>
                  </div>
                )}

                {!loading && !error && resources.length === 0 && (
                  <div className="text-center py-12">
                    <div className="bg-success-50 rounded-full p-4 mb-4 inline-block">
                      <AlertCircle className="w-8 h-8 text-success-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      No Broken Resources
                    </h3>
                    <p className="text-sm text-gray-600">
                      All resources are accessible.
                    </p>
                  </div>
                )}

                {!loading && !error && resources.length > 0 && (
                  <div className="space-y-2">
                    {resources.map((resource, index) => {
                      const ResourceIcon = getResourceIcon(resource.resource_type);
                      const statusColor = getStatusColor(resource.status_code);

                      return (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <div className="bg-error-50 rounded-full p-2 flex-shrink-0">
                            <ResourceIcon className="w-4 h-4 text-error-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <a
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-gray-900 hover:text-primary-600 flex items-center gap-1 group"
                              >
                                <span className="truncate">{resource.url}</span>
                                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                              </a>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-error-100 ${statusColor} flex-shrink-0`}>
                                {resource.status_code}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                              <span className="capitalize">{resource.resource_type}</span>
                              {resource.size && (
                                <span>{(resource.size / 1024).toFixed(1)} KB</span>
                              )}
                              {resource.fetch_time && (
                                <span>{new Date(resource.fetch_time).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              {!loading && !error && resources.length > 0 && (
                <div className="border-t border-gray-200 px-6 py-4">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Total: {resources.length} broken resources</span>
                    <Button
                      color="secondary"
                      size="sm"
                      onClick={onClose}
                    >
                      Close
                    </Button>
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
