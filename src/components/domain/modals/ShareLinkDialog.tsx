"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DialogTrigger, ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Button } from "@/components/base/buttons/button";
import { Copy01, Link03, Trash01 } from "@untitledui/icons";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { Heading as AriaHeading } from "react-aria-components";

interface ShareLinkDialogProps {
  domainId: Id<"domains">;
  children: React.ReactNode;
}

export function ShareLinkDialog({ domainId, children }: ShareLinkDialogProps) {
  const t = useTranslations("share");
  const [isOpen, setIsOpen] = useState(false);

  const existingLink = useQuery(api.reports.getShareLinkForDomain, { domainId });
  const createShareLink = useMutation(api.reports.createShareLink);
  const deleteReport = useMutation(api.reports.deleteReport);
  const [isCreating, setIsCreating] = useState(false);

  const shareUrl = existingLink?.token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${existingLink.token}`
    : null;

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const result = await createShareLink({ domainId });
      toast.success(t("linkCopied"));
      const url = `${window.location.origin}/share/${result.token}`;
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error(error);
      toast.error(t("shareLinkFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("linkCopied"));
    }
  };

  const handleDelete = async () => {
    if (existingLink?.reportId) {
      await deleteReport({ reportId: existingLink.reportId });
      toast.success(t("linkDeleted"));
    }
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {children}
      <ModalOverlay>
        <Modal className="max-w-md">
          <Dialog>
            <div className="relative w-full overflow-hidden rounded-2xl bg-primary shadow-xl sm:max-w-md">
              <CloseButton onPress={() => setIsOpen(false)} theme="light" size="lg" className="absolute top-3 right-3 z-10" />

              {/* Header */}
              <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                <div className="relative w-max">
                  <FeaturedIcon color="brand" size="lg" theme="light" icon={Link03} />
                  <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="z-10 flex flex-col gap-0.5">
                  <AriaHeading slot="title" className="text-md font-semibold text-primary">
                    {t("shareLink")}
                  </AriaHeading>
                  <p className="text-sm text-tertiary">
                    {t("shareLinkDescription")}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 pb-6 pt-4 sm:px-6">
                {shareUrl ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-secondary bg-secondary_subtle px-3 py-2.5">
                      <input
                        readOnly
                        value={shareUrl}
                        className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="md"
                        iconLeading={Copy01}
                        onClick={handleCopy}
                        className="flex-1"
                      >
                        {t("copyLink")}
                      </Button>
                      <Button
                        size="md"
                        color="tertiary"
                        iconLeading={Trash01}
                        onClick={handleDelete}
                      >
                        {t("deleteLink")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="md"
                    iconLeading={Link03}
                    onClick={handleCreate}
                    isLoading={isCreating}
                    className="w-full"
                  >
                    {t("generateLink")}
                  </Button>
                )}
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
