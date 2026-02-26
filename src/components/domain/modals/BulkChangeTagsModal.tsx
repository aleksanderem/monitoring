"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tag01 } from "@untitledui/icons";
import { Heading as AriaHeading } from "react-aria-components";
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

interface BulkChangeTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tags: string[], operation: "set" | "add" | "remove") => Promise<void>;
  count: number;
}

export function BulkChangeTagsModal({
  isOpen,
  onClose,
  onConfirm,
  count,
}: BulkChangeTagsModalProps) {
  const t = useTranslations("keywords");
  const tc = useTranslations("common");
  const [tagsInput, setTagsInput] = useState("");
  const [operation, setOperation] = useState<"set" | "add" | "remove">("add");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (tags.length === 0) return;

    setIsSubmitting(true);
    try {
      await onConfirm(tags, operation);
      onClose();
      setTagsInput("");
      setOperation("add");
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
                  <FeaturedIcon color="brand" size="lg" theme="light" icon={Tag01} />
                  <BackgroundPattern
                    pattern="circle"
                    size="sm"
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  />
                </div>
                <div className="z-10 flex flex-col gap-0.5">
                  <AriaHeading slot="title" className="text-md font-semibold text-primary">
                    {t("bulkChangeTagsTitle")}
                  </AriaHeading>
                  <p className="text-sm text-tertiary">
                    {t("bulkChangeTagsDescription", { count })}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 sm:px-6">
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-secondary">
                      {t("tagsLabel")}
                    </label>
                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder={t("tagsPlaceholder")}
                      className="w-full rounded-md border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-tertiary"
                    />
                    <p className="mt-1 text-xs text-tertiary">{t("tagsHint")}</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-secondary">
                      {t("tagOperation")}
                    </label>
                    <div className="flex flex-col gap-2">
                      {(["add", "remove", "set"] as const).map((op) => (
                        <label key={op} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="tagOperation"
                            value={op}
                            checked={operation === op}
                            onChange={() => setOperation(op)}
                            className="h-4 w-4 border-secondary"
                          />
                          <span className="text-sm text-primary">{t(`tagOp_${op}`)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="z-10 flex flex-1 flex-col-reverse gap-3 p-4 pt-6 *:grow sm:grid sm:grid-cols-2 sm:px-6 sm:pt-8 sm:pb-6">
                <Button size="lg" color="secondary" onClick={onClose} disabled={isSubmitting}>
                  {tc("cancel")}
                </Button>
                <Button
                  size="lg"
                  color="primary"
                  onClick={handleConfirm}
                  disabled={isSubmitting || !tagsInput.trim()}
                >
                  {isSubmitting ? tc("loading") : tc("confirm")}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
