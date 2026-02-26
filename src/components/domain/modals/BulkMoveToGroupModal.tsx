"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Folder } from "@untitledui/icons";
import { Heading as AriaHeading } from "react-aria-components";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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

interface BulkMoveToGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (groupId: Id<"keywordGroups"> | undefined) => Promise<void>;
  domainId: Id<"domains">;
  count: number;
}

export function BulkMoveToGroupModal({
  isOpen,
  onClose,
  onConfirm,
  domainId,
  count,
}: BulkMoveToGroupModalProps) {
  const t = useTranslations("keywords");
  const tc = useTranslations("common");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const groups = useQuery(
    api.keywordGroups_queries.getGroupsByDomain,
    isOpen ? { domainId } : "skip"
  );

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(
        selectedGroupId ? (selectedGroupId as Id<"keywordGroups">) : undefined
      );
      onClose();
      setSelectedGroupId("");
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
                    color="brand"
                    size="lg"
                    theme="light"
                    icon={Folder}
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
                    {t("bulkMoveToGroupTitle")}
                  </AriaHeading>
                  <p className="text-sm text-tertiary">
                    {t("bulkMoveToGroupDescription", { count })}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 sm:px-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-secondary">
                    {t("selectGroup")}
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full rounded-md border border-secondary bg-primary px-3 py-2 text-sm text-primary"
                  >
                    <option value="">{t("noGroup")}</option>
                    {groups?.map((group) => (
                      <option key={group._id} value={group._id}>
                        {group.name} ({group.keywordCount})
                      </option>
                    ))}
                  </select>
                  {!groups && (
                    <p className="text-xs text-tertiary">{tc("loading")}</p>
                  )}
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
                  color="primary"
                  size="lg"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
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
