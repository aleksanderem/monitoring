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
            <div className="w-full rounded-xl bg-primary p-6 shadow-xl">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-secondary bg-primary shadow-xs">
                  <Link03 className="h-5 w-5 text-fg-quaternary" />
                </div>
                <CloseButton onPress={() => setIsOpen(false)} />
              </div>

              <h2 className="text-lg font-semibold text-primary">
                {t("shareLink")}
              </h2>
              <p className="mt-1 text-sm text-tertiary">
                {t("shareLinkDescription")}
              </p>

              <div className="mt-5">
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
