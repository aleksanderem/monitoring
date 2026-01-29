"use client";

import { useState } from "react";
import { Plus } from "@untitledui/icons";
import { DialogTrigger as AriaDialogTrigger, Heading as AriaHeading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

interface CreateProjectDialogProps {
  onSuccess?: () => void;
}

export function CreateProjectDialog({ onSuccess }: CreateProjectDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createProject = useMutation(api.projects.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a project name");
      return;
    }

    try {
      setIsSubmitting(true);
      await createProject({ name: name.trim() });
      toast.success("Project created successfully");
      setIsOpen(false);
      setName("");
      onSuccess?.();
    } catch (error) {
      toast.error("Failed to create project");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AriaDialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button iconLeading={Plus} size="md">
        New Project
      </Button>

      <ModalOverlay isDismissable={!isSubmitting}>
        <Modal>
          <Dialog>
            <form
              onSubmit={handleSubmit}
              className="relative w-full overflow-hidden rounded-xl bg-primary shadow-xl sm:max-w-lg"
            >
              <CloseButton
                onClick={() => setIsOpen(false)}
                theme="light"
                size="lg"
                className="absolute top-3 right-3"
                isDisabled={isSubmitting}
              />

              <div className="flex flex-col gap-5 p-4 sm:p-6">
                <div className="flex flex-col gap-1">
                  <AriaHeading slot="title" className="text-lg font-semibold text-primary">
                    Create new project
                  </AriaHeading>
                  <p className="text-sm text-tertiary">
                    Add a new project to organize your SEO monitoring.
                  </p>
                </div>

                <Input
                  size="md"
                  label="Project name"
                  placeholder="e.g. Company Website"
                  value={name}
                  onChange={(value) => setName(value)}
                  isRequired
                  autoFocus
                  isDisabled={isSubmitting}
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-secondary p-4 sm:flex-row sm:justify-end sm:p-6">
                <Button
                  size="lg"
                  color="secondary"
                  onClick={() => setIsOpen(false)}
                  type="button"
                  isDisabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  size="lg"
                  color="primary"
                  type="submit"
                  isDisabled={isSubmitting || !name.trim()}
                >
                  {isSubmitting ? "Creating..." : "Create project"}
                </Button>
              </div>
            </form>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </AriaDialogTrigger>
  );
}
