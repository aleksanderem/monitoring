"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { DialogTrigger, Heading } from "react-aria-components";
import { Plus, Edit05, Trash01, Folder } from "@untitledui/icons";
import { toast } from "sonner";
import { BadgeWithIcon } from "@/components/base/badges/badges";
import { DeleteConfirmationDialog } from "@/components/application/modals/delete-confirmation-dialog";
import { useTranslations } from "next-intl";

interface GroupManagementModalProps {
  domainId: Id<"domains">;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLOR_OPTIONS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Red", value: "#EF4444" },
  { name: "Orange", value: "#F59E0B" },
  { name: "Pink", value: "#EC4899" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Indigo", value: "#6366F1" },
];

export function GroupManagementModal({
  domainId,
  isOpen,
  onOpenChange,
}: GroupManagementModalProps) {
  const t = useTranslations("keywords");
  const tc = useTranslations("common");
  const groups = useQuery(api.keywordGroups_queries.getGroupsByDomain, { domainId });
  const createGroup = useMutation(api.keywordGroups_mutations.createGroup);
  const updateGroup = useMutation(api.keywordGroups_mutations.updateGroup);
  const deleteGroup = useMutation(api.keywordGroups_mutations.deleteGroup);

  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(COLOR_OPTIONS[0].value);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error(t("groupNameRequired"));
      return;
    }

    try {
      await createGroup({
        domainId,
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
        color: newGroupColor,
      });

      toast.success(t("groupCreated", { name: newGroupName }));
      setNewGroupName("");
      setNewGroupDescription("");
      setNewGroupColor(COLOR_OPTIONS[0].value);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("groupCreateFailed");
      toast.error(errorMessage);
    }
  };

  const handleUpdateGroup = async (groupId: Id<"keywordGroups">) => {
    if (!editName.trim()) {
      toast.error(t("groupNameRequired"));
      return;
    }

    try {
      await updateGroup({
        groupId,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        color: editColor,
      });

      toast.success(t("groupUpdated"));
      setEditingGroup(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("groupUpdateFailed");
      toast.error(errorMessage);
    }
  };

  const handleDeleteGroup = async (groupId: Id<"keywordGroups">, groupName: string) => {
    try {
      await deleteGroup({ groupId });
      toast.success(t("groupDeleted", { name: groupName }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("groupDeleteFailed");
      toast.error(errorMessage);
    }
  };

  const startEditing = (group: any) => {
    setEditingGroup(group._id);
    setEditName(group.name);
    setEditDescription(group.description || "");
    setEditColor(group.color);
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalOverlay isDismissable>
        <Modal>
          <Dialog className="overflow-hidden">
            <div className="relative w-full overflow-hidden rounded-2xl bg-primary shadow-xl sm:max-w-2xl">
              <CloseButton
                onPress={() => onOpenChange(false)}
                theme="light"
                size="lg"
                className="absolute top-3 right-3 z-10"
              />

              {/* Header */}
              <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
                <div className="relative w-max">
                  <FeaturedIcon color="brand" size="lg" theme="light" icon={Folder} />
                  <BackgroundPattern pattern="circle" size="sm" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="z-10 flex flex-col gap-0.5">
                  <Heading slot="title" className="text-md font-semibold text-primary">
                    {t("groupManagement")}
                  </Heading>
                  <p className="text-sm text-tertiary">
                    {t("groupManagementDescription")}
                  </p>
                </div>
              </div>

              {/* Create New Group Section */}
              <div className="border-b border-secondary bg-secondary-subtle px-6 py-4">
                <h3 className="mb-3 text-sm font-semibold text-primary">{t("createNewGroup")}</h3>
                <div className="grid gap-3">
                  <Input
                    size="md"
                    label={t("groupNameLabel")}
                    value={newGroupName}
                    onChange={(value: string) => setNewGroupName(value)}
                    placeholder={t("groupNamePlaceholder")}
                  />
                  <Input
                    size="md"
                    label={t("groupDescriptionLabel")}
                    value={newGroupDescription}
                    onChange={(value: string) => setNewGroupDescription(value)}
                    placeholder={t("groupDescriptionPlaceholder")}
                  />
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-primary">{t("colorLabel")}</label>
                    <div className="flex gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setNewGroupColor(color.value)}
                          className={`h-8 w-8 rounded-md border-2 transition-all ${
                            newGroupColor === color.value
                              ? "border-brand-600 scale-110"
                              : "border-secondary hover:border-brand-300"
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    size="md"
                    color="primary"
                    iconLeading={Plus}
                    onClick={handleCreateGroup}
                    className="w-full"
                  >
                    {t("createGroupButton")}
                  </Button>
                </div>
              </div>

              {/* Existing Groups List */}
              <div className="max-h-96 overflow-y-auto px-6 py-4">
                <h3 className="mb-3 text-sm font-semibold text-primary">
                  {t("existingGroups")} ({groups?.length || 0})
                </h3>
                {!groups || groups.length === 0 ? (
                  <div className="py-8 text-center text-sm text-tertiary">
                    {t("noGroupsYet")}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {groups.map((group) => (
                      <div
                        key={group._id}
                        className="flex items-center gap-3 rounded-lg border border-secondary bg-primary p-3"
                      >
                        {editingGroup === group._id ? (
                          // Edit Mode
                          <div className="flex-1 grid gap-2">
                            <Input
                              size="sm"
                              value={editName}
                              onChange={(value: string) => setEditName(value)}
                              placeholder={t("groupNameEditPlaceholder")}
                            />
                            <Input
                              size="sm"
                              value={editDescription}
                              onChange={(value: string) => setEditDescription(value)}
                              placeholder={t("groupDescEditPlaceholder")}
                            />
                            <div className="flex gap-2">
                              {COLOR_OPTIONS.map((color) => (
                                <button
                                  key={color.value}
                                  type="button"
                                  onClick={() => setEditColor(color.value)}
                                  className={`h-6 w-6 rounded border-2 transition-all ${
                                    editColor === color.value
                                      ? "border-brand-600 scale-110"
                                      : "border-secondary"
                                  }`}
                                  style={{ backgroundColor: color.value }}
                                />
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                color="primary"
                                onClick={() => handleUpdateGroup(group._id as Id<"keywordGroups">)}
                                className="flex-1"
                              >
                                {tc("save")}
                              </Button>
                              <Button
                                size="sm"
                                color="secondary"
                                onClick={() => setEditingGroup(null)}
                                className="flex-1"
                              >
                                {tc("cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <>
                            <div
                              className="h-10 w-10 rounded-md border border-secondary"
                              style={{ backgroundColor: group.color }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-primary">{group.name}</span>
                                <BadgeWithIcon type="pill-color" color="gray" size="sm">
                                  {t("keywordsCount", { count: group.keywordCount })}
                                </BadgeWithIcon>
                              </div>
                              {group.description && (
                                <p className="mt-1 text-sm text-tertiary">{group.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                color="secondary"
                                iconLeading={Edit05}
                                onClick={() => startEditing(group)}
                              >
                                {tc("edit")}
                              </Button>
                              <DeleteConfirmationDialog
                                title={t("deleteGroupTitle", { name: group.name })}
                                description={t("deleteGroupDescription", { count: group.keywordCount })}
                                confirmLabel={t("deleteGroupConfirm")}
                                onConfirm={() =>
                                  handleDeleteGroup(group._id as Id<"keywordGroups">, group.name)
                                }
                              >
                                <Button size="sm" color="secondary-destructive" iconLeading={Trash01}>
                                  {tc("delete")}
                                </Button>
                              </DeleteConfirmationDialog>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-secondary px-6 py-4">
                <Button size="md" color="secondary" onClick={() => onOpenChange(false)} className="w-full">
                  {tc("close")}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
