"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DialogTrigger as AriaDialogTrigger, Heading as AriaHeading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { toast } from "sonner";

interface CreateDomainDialogProps {
  defaultProjectId?: Id<"projects">;
  children?: React.ReactNode;
}

export function CreateDomainDialog({ defaultProjectId, children }: CreateDomainDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [projectId, setProjectId] = useState<Id<"projects"> | "">(defaultProjectId || "");
  const [searchEngine, setSearchEngine] = useState("google.com");
  const [refreshFrequency, setRefreshFrequency] = useState<"daily" | "weekly" | "on_demand">("weekly");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const projects = useQuery(api.projects.list);
  const createDomain = useMutation(api.domains.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!domain.trim()) {
      toast.error("Please enter a domain name");
      return;
    }

    if (!projectId) {
      toast.error("Please select a project");
      return;
    }

    try {
      setIsSubmitting(true);
      await createDomain({
        projectId: projectId as Id<"projects">,
        domain: domain.trim(),
        searchEngine,
        refreshFrequency,
      });

      toast.success("Domain added successfully");
      setIsOpen(false);
      setDomain("");
      setProjectId(defaultProjectId || "");
      setSearchEngine("google.com");
      setRefreshFrequency("weekly");
    } catch (error) {
      toast.error("Failed to add domain");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AriaDialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {children || (
        <Button size="md">
          Add Domain
        </Button>
      )}

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
                    Add domain
                  </AriaHeading>
                  <p className="text-sm text-tertiary">
                    Add a new domain to track keyword rankings.
                  </p>
                </div>

                {/* Auto-discovery info */}
                <div className="rounded-lg border border-utility-blue-200 bg-utility-blue-50 p-3">
                  <div className="flex gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="h-4 w-4 text-utility-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-utility-blue-900">
                        Automatic keyword discovery
                      </p>
                      <p className="mt-1 text-xs text-utility-blue-700">
                        After adding the domain, we'll automatically discover relevant keywords and fetch visibility history. This may take a few moments.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  <Input
                    size="md"
                    label="Domain name"
                    placeholder="example.com"
                    value={domain}
                    onChange={setDomain}
                    isRequired
                    isDisabled={isSubmitting}
                    autoFocus
                  />

                  <Select
                    size="md"
                    label="Project"
                    placeholder="Select a project"
                    selectedKey={projectId}
                    onSelectionChange={(key) => setProjectId(key as Id<"projects"> | "")}
                    isRequired
                    isDisabled={isSubmitting || projects === undefined}
                  >
                    {projects?.map((project) => (
                      <Select.Item key={project._id} id={project._id}>
                        {project.name}
                      </Select.Item>
                    ))}
                  </Select>

                  <Select
                    size="md"
                    label="Search engine"
                    selectedKey={searchEngine}
                    onSelectionChange={(key) => setSearchEngine(key as string)}
                    isDisabled={isSubmitting}
                  >
                    <Select.Item id="google.com">Google</Select.Item>
                    <Select.Item id="google.pl">Google Poland</Select.Item>
                    <Select.Item id="bing.com">Bing</Select.Item>
                  </Select>

                  <Select
                    size="md"
                    label="Refresh frequency"
                    selectedKey={refreshFrequency}
                    onSelectionChange={(key) => setRefreshFrequency(key as "daily" | "weekly" | "on_demand")}
                    isDisabled={isSubmitting}
                  >
                    <Select.Item id="daily">Daily</Select.Item>
                    <Select.Item id="weekly">Weekly</Select.Item>
                    <Select.Item id="on_demand">On demand</Select.Item>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-secondary p-4 sm:flex-row sm:justify-end sm:p-6">
                <Button
                  type="button"
                  color="secondary"
                  size="lg"
                  onClick={() => setIsOpen(false)}
                  isDisabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  size="lg"
                  isDisabled={isSubmitting || !domain.trim() || !projectId}
                >
                  {isSubmitting ? "Adding..." : "Add domain"}
                </Button>
              </div>
            </form>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </AriaDialogTrigger>
  );
}
