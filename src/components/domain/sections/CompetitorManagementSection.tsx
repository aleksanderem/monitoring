"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Dialog, Modal, ModalOverlay, DialogTrigger } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { Plus, Trash01, Edit05, Target04, Link03 } from "@untitledui/icons";
import { toast } from "sonner";
import { Heading } from "react-aria-components";
import { AddCompetitorModal } from "../modals/AddCompetitorModal";

interface CompetitorManagementSectionProps {
  domainId: Id<"domains">;
}

export function CompetitorManagementSection({ domainId }: CompetitorManagementSectionProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<{ id: Id<"competitors">; name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<Id<"competitors">>>(new Set());

  const competitors = useQuery(api.competitors.getCompetitors, { domainId });
  const updateCompetitor = useMutation(api.competitors.updateCompetitor);
  const removeCompetitor = useMutation(api.competitors.removeCompetitor);
  const createContentGapJob = useMutation(api.competitorContentGapJobs.createContentGapJob);
  const createBacklinksJob = useMutation(api.competitorBacklinksJobs.createBacklinksJob);

  // Get all active jobs for this domain (called at top level, not in loop)
  const contentGapJobs = useQuery(api.competitorContentGapJobs.getActiveJobsForDomain, { domainId });
  const backlinksJobs = useQuery(api.competitorBacklinksJobs.getActiveJobsForDomain, { domainId });

  // Only show active competitors
  const activeCompetitors = competitors?.filter(c => c.status === "active") ?? [];

  const handleRemove = async (competitorId: Id<"competitors">) => {
    if (!confirm("Are you sure you want to remove this competitor? It will be hidden from tracking.")) {
      return;
    }

    try {
      await removeCompetitor({ competitorId });
      setSelectedCompetitors(prev => {
        const next = new Set(prev);
        next.delete(competitorId);
        return next;
      });
      toast.success("Competitor removed");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove competitor");
    }
  };

  const handleEditCompetitor = (competitorId: Id<"competitors">, currentName: string) => {
    setEditingCompetitor({ id: competitorId, name: currentName });
    setEditName(currentName);
  };

  const handleSaveEdit = async () => {
    if (!editingCompetitor || !editName.trim()) return;

    try {
      await updateCompetitor({
        competitorId: editingCompetitor.id,
        name: editName.trim(),
      });
      toast.success("Competitor updated");
      setEditingCompetitor(null);
      setEditName("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update competitor");
    }
  };

  const handleAnalyzeContentGap = async (competitorId: Id<"competitors">, competitorName: string) => {
    try {
      await createContentGapJob({ domainId, competitorId });
      toast.success(`Content gap analysis job started for ${competitorName}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to start content gap analysis");
    }
  };

  const handleFetchBacklinks = async (competitorId: Id<"competitors">, competitorName: string) => {
    try {
      await createBacklinksJob({ domainId, competitorId });
      toast.success(`Backlinks fetch job started for ${competitorName}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to start backlinks fetch");
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedCompetitors.size === activeCompetitors.length) {
      setSelectedCompetitors(new Set());
    } else {
      setSelectedCompetitors(new Set(activeCompetitors.map(c => c._id)));
    }
  };

  const handleToggleSelect = (competitorId: Id<"competitors">) => {
    const newSelected = new Set(selectedCompetitors);
    if (newSelected.has(competitorId)) {
      newSelected.delete(competitorId);
    } else {
      newSelected.add(competitorId);
    }
    setSelectedCompetitors(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedCompetitors.size === 0) return;

    if (!confirm(`Are you sure you want to remove ${selectedCompetitors.size} competitor(s)?`)) {
      return;
    }

    try {
      for (const competitorId of selectedCompetitors) {
        await removeCompetitor({ competitorId });
      }
      toast.success(`Removed ${selectedCompetitors.size} competitor(s)`);
      setSelectedCompetitors(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to remove competitors");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {selectedCompetitors.size > 0 && (
          <Button onClick={handleBulkDelete} size="sm" color="tertiary-destructive" iconLeading={Trash01}>
            Delete ({selectedCompetitors.size})
          </Button>
        )}
        <Button onClick={() => setShowAddDialog(true)} size="sm" color="primary" iconLeading={Plus}>
          Add Competitor
        </Button>
      </div>

      {competitors === undefined ? (
        <div className="text-center py-8 text-tertiary">Loading...</div>
      ) : activeCompetitors.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-secondary rounded-lg">
          <p className="text-tertiary mb-4">No competitors added yet</p>
          <Button onClick={() => setShowAddDialog(true)} color="secondary" size="sm" iconLeading={Plus}>
            Add Your First Competitor
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Select All Header */}
          <div className="flex items-center gap-3 px-4 py-2 border border-secondary rounded-lg bg-secondary/30">
            <input
              type="checkbox"
              checked={activeCompetitors.length > 0 && selectedCompetitors.size === activeCompetitors.length}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 rounded border-utility-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-tertiary">
              Select All ({activeCompetitors.length})
            </span>
          </div>

          {/* Competitor List */}
          {activeCompetitors.map((competitor) => {
            const contentGapJob = contentGapJobs?.find(job => job.competitorId === competitor._id);
            const backlinksJob = backlinksJobs?.find(job => job.competitorId === competitor._id);

            return (
            <div
              key={competitor._id}
              className="flex items-center justify-between p-4 border border-secondary rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <input
                  type="checkbox"
                  checked={selectedCompetitors.has(competitor._id)}
                  onChange={() => handleToggleSelect(competitor._id)}
                  className="w-4 h-4 rounded border-utility-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-primary">
                      {competitor.name || competitor.competitorDomain}
                    </h4>
                  </div>
                <p className="text-sm text-tertiary">{competitor.competitorDomain}</p>
                {competitor.lastCheckedAt && (
                  <div className="flex items-center gap-4 mt-2 text-xs text-tertiary">
                    <span>
                      Last checked: {new Date(competitor.lastCheckedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Job Progress Indicators */}
                {(contentGapJob || backlinksJob) && (
                  <div className="mt-2 space-y-1">
                    {contentGapJob && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-primary transition-all duration-300"
                            style={{ width: contentGapJob.status === "completed" ? "100%" : "50%" }}
                          />
                        </div>
                        <span className="text-xs text-tertiary min-w-[100px]">
                          {contentGapJob.status === "processing" && "Analyzing gaps..."}
                          {contentGapJob.status === "completed" && `${contentGapJob.opportunitiesFound || 0} opportunities`}
                          {contentGapJob.status === "failed" && "Analysis failed"}
                        </span>
                      </div>
                    )}
                    {backlinksJob && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-utility-blue-600 transition-all duration-300"
                            style={{ width: backlinksJob.status === "completed" ? "100%" : "50%" }}
                          />
                        </div>
                        <span className="text-xs text-tertiary min-w-[100px]">
                          {backlinksJob.status === "processing" && "Fetching backlinks..."}
                          {backlinksJob.status === "completed" && `${backlinksJob.backlinksFound || 0} backlinks`}
                          {backlinksJob.status === "failed" && "Fetch failed"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  color="secondary"
                  size="sm"
                  onClick={() => handleAnalyzeContentGap(competitor._id, competitor.name || competitor.competitorDomain)}
                  isDisabled={!!contentGapJob}
                  title="Analyze content gaps"
                  iconLeading={Target04}
                >
                  Content Gap
                </Button>
                <Button
                  color="secondary"
                  size="sm"
                  onClick={() => handleFetchBacklinks(competitor._id, competitor.name || competitor.competitorDomain)}
                  isDisabled={!!backlinksJob}
                  title="Fetch backlinks"
                  iconLeading={Link03}
                >
                  Backlinks
                </Button>
                <Button
                  color="tertiary"
                  size="sm"
                  onClick={() => handleEditCompetitor(competitor._id, competitor.name || competitor.competitorDomain)}
                  title="Edit competitor"
                  iconLeading={Edit05}
                />
                <Button
                  color="tertiary-destructive"
                  size="sm"
                  onClick={() => handleRemove(competitor._id)}
                  title="Remove competitor"
                  iconLeading={Trash01}
                />
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* Add Competitor Dialog (shared 3-tab modal) */}
      <AddCompetitorModal
        domainId={domainId}
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />

      {/* Edit Competitor Dialog */}
      <DialogTrigger isOpen={editingCompetitor !== null} onOpenChange={(open) => { if (!open) setEditingCompetitor(null); }}>
        <ModalOverlay isDismissable>
          <Modal>
            <Dialog className="overflow-hidden">
              <div className="relative w-full overflow-hidden rounded-xl bg-primary shadow-xl sm:max-w-lg">
                <CloseButton
                  onClick={() => setEditingCompetitor(null)}
                  theme="light"
                  size="lg"
                  className="absolute top-3 right-3 z-10"
                />

                {/* Header */}
                <div className="border-b border-secondary px-6 py-4">
                  <Heading slot="title" className="text-lg font-semibold text-primary">
                    Edit Competitor
                  </Heading>
                  <p className="mt-1 text-sm text-tertiary">
                    Update the competitor display name
                  </p>
                </div>

                {/* Content */}
                <div className="space-y-4 px-6 py-4">
                  <Input
                    size="md"
                    label="Display Name"
                    placeholder="Competitor name"
                    value={editName}
                    onChange={(value: string) => setEditName(value)}
                    isRequired
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-secondary px-6 py-4">
                  <Button color="secondary" size="md" onClick={() => setEditingCompetitor(null)}>
                    Cancel
                  </Button>
                  <Button color="primary" size="md" onClick={handleSaveEdit}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </div>
  );
}
