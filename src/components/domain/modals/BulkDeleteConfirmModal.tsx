"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Heading as AriaHeading } from "react-aria-components";
import { Trash01 } from "@untitledui/icons";
import {
  DialogTrigger,
  ModalOverlay,
  Modal,
  Dialog,
} from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Button } from "@/components/base/buttons/button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";

interface BulkDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  count: number;
}

export function BulkDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  count,
}: BulkDeleteConfirmModalProps) {
  const t = useTranslations("keywords");
  const tc = useTranslations("common");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // errors handled by caller via toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ModalOverlay isDismissable>
        <Modal className="max-w-lg">
          <Dialog>
            <div className="relative w-full overflow-hidden rounded-2xl bg-primary shadow-xl sm:max-w-lg">
              <CloseButton
                onPress={onClose}
                theme="light"
                size="lg"
                className="absolute top-3 right-3 z-10"
              />

              {/* Header */}
              <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                <div className="relative w-max">
                  <FeaturedIcon
                    color="error"
                    size="lg"
                    theme="light"
                    icon={Trash01}
                  />
                  <BackgroundPattern
                    pattern="circle"
                    size="sm"
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  />
                </div>
                <div className="z-10 flex flex-col gap-0.5">
                  <AriaHeading
                    slot="title"
                    className="text-md font-semibold text-primary"
                  >
                    {t("bulkDeleteTitle")}
                  </AriaHeading>
                  <p className="text-sm text-tertiary">
                    {t("bulkDeleteConfirm", { count })}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 pt-3 sm:px-6">
                <div className="rounded-lg border border-utility-error-200 bg-utility-error-50 px-3 py-2">
                  <p className="text-sm text-utility-error-700">
                    {t("bulkDeleteWarning")}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="z-10 flex flex-1 flex-col-reverse gap-3 p-4 pt-6 *:grow sm:grid sm:grid-cols-2 sm:px-6 sm:pt-8 sm:pb-6">
                <Button
                  color="secondary"
                  size="lg"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  color="primary-destructive"
                  size="lg"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? tc("deleting") : tc("delete")}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
