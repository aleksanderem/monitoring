"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Modal } from "@/components/base/modal/modal";

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("bulkMoveToGroupTitle")}
      description={t("bulkMoveToGroupDescription", { count })}
      size="sm"
      footer={
        <>
          <Button size="sm" color="secondary" onClick={onClose} disabled={isSubmitting}>
            {tc("cancel")}
          </Button>
          <Button
            size="sm"
            color="primary"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? tc("loading") : tc("confirm")}
          </Button>
        </>
      }
    >
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
    </Modal>
  );
}
