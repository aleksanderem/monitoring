"use client";

import { useState } from "react";
import { AlertTriangle } from "@untitledui/icons";
import { DialogTrigger as AriaDialogTrigger, Heading as AriaHeading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";

interface DeleteConfirmationDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void>;
  children: React.ReactNode;
  isDestructive?: boolean;
}

export function DeleteConfirmationDialog({
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  children,
  isDestructive = true,
}: DeleteConfirmationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
      setIsOpen(false);
    } catch (error) {
      // Error handling is done by the parent
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AriaDialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {children}

      <ModalOverlay isDismissable={!isSubmitting}>
        <Modal>
          <Dialog>
            <div className="relative w-full overflow-hidden rounded-xl bg-primary shadow-xl sm:max-w-sm">
              <CloseButton
                onClick={() => setIsOpen(false)}
                theme="light"
                size="lg"
                className="absolute top-3 right-3"
                isDisabled={isSubmitting}
              />

              <div className="flex flex-col gap-5 p-4 sm:p-6">
                <FeaturedIcon
                  color={isDestructive ? "error" : "warning"}
                  size="lg"
                  theme="modern"
                  icon={AlertTriangle}
                />

                <div className="flex flex-col gap-2">
                  <AriaHeading slot="title" className="text-lg font-semibold text-primary">
                    {title}
                  </AriaHeading>
                  <p className="text-sm text-tertiary">{description}</p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-secondary p-4 sm:flex-row sm:justify-end sm:p-6">
                <Button
                  size="lg"
                  color="secondary"
                  onClick={() => setIsOpen(false)}
                  type="button"
                  isDisabled={isSubmitting}
                >
                  {cancelLabel}
                </Button>
                <Button
                  size="lg"
                  color={isDestructive ? "primary-destructive" : "primary"}
                  onClick={handleConfirm}
                  type="button"
                  isDisabled={isSubmitting}
                >
                  {isSubmitting ? "Deleting..." : confirmLabel}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </AriaDialogTrigger>
  );
}
