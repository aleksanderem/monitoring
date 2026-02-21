"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Dialog, Modal, ModalOverlay, DialogTrigger } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { Plus, Trash01, Edit05, Target04, Link03, Download01, Upload01 } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Heading } from "react-aria-components";
import { AddCompetitorModal } from "../modals/AddCompetitorModal";
import { CompetitorImportModal } from "../modals/CompetitorImportModal";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { exportToCsv } from "@/utils/exportCsv";

interface CompetitorManagementSectionProps {
  domainId: Id<"domains">;
}

export function CompetitorManagementSection({ domainId }: CompetitorManagementSectionProps) {
  const t = useTranslations('competitors');
  const tc = useTranslations('common');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
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
    if (!confirm(t('removeCompetitorConfirm'))) {
      return;
    }

    try {
      await removeCompetitor({ competitorId });
      setSelectedCompetitors(prev => {
        const next = new Set(prev);
        next.delete(competitorId);
        return next;
      });
      toast.success(t('competitorMgmtToastRemoved'));
    } catch (error: any) {
      toast.error(error.message || t('competitorMgmtToastRemoveFailed'));
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
      toast.success(t('competitorMgmtToastUpdated'));
      setEditingCompetitor(null);
      setEditName("");
    } catch (error: any) {
      toast.error(error.message || t('competitorMgmtToastUpdateFailed'));
    }
  };

  const handleAnalyzeContentGap = async (competitorId: Id<"competitors">, competitorName: string) => {
    try {
      await createContentGapJob({ domainId, competitorId });
      toast.success(t('contentGapToastRefreshed'));
    } catch (error: any) {
      toast.error(error.message || t('contentGapToastRefreshFailed'));
    }
  };

  const handleFetchBacklinks = async (competitorId: Id<"competitors">, competitorName: string) => {
    try {
      await createBacklinksJob({ domainId, competitorId });
      toast.success(t('competitorMgmtJobFetching'));
    } catch (error: any) {
      toast.error(error.message || t('competitorMgmtToastRemoveFailed'));
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

    if (!confirm(t('removeCompetitorsConfirm', { count: selectedCompetitors.size }))) {
      return;
    }

    try {
      for (const competitorId of selectedCompetitors) {
        await removeCompetitor({ competitorId });
      }
      toast.success(t('removedCompetitors', { count: selectedCompetitors.size }));
      setSelectedCompetitors(new Set());
    } catch (error: any) {
      toast.error(error.message || t('failedToRemoveCompetitors'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {selectedCompetitors.size > 0 && (
          <PermissionGate permission="competitors.add">
            <Button onClick={handleBulkDelete} size="sm" color="tertiary-destructive" iconLeading={Trash01}>
              {tc('delete')} ({selectedCompetitors.size})
            </Button>
          </PermissionGate>
        )}
        {activeCompetitors.length > 0 && (
          <Button
            onClick={() => {
              const headers = ["Competitor Domain", "Name", "Status", "Last Checked"];
              const rows = activeCompetitors.map((c) => [
                c.competitorDomain,
                c.name,
                c.status,
                c.lastCheckedAt ? new Date(c.lastCheckedAt).toISOString().slice(0, 10) : "",
              ]);
              exportToCsv(`competitors-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
              toast.success(`Exported ${rows.length} competitors`);
            }}
            size="sm"
            color="secondary"
            iconLeading={Download01}
          >
            Export
          </Button>
        )}
        <PermissionGate permission="competitors.add">
          <Button onClick={() => setShowImportDialog(true)} size="sm" color="secondary" iconLeading={Upload01}>
            Import CSV
          </Button>
        </PermissionGate>
        <PermissionGate permission="competitors.add">
          <Button onClick={() => setShowAddDialog(true)} size="sm" color="primary" iconLeading={Plus}>
            {t('competitorMgmtAddCompetitor')}
          </Button>
        </PermissionGate>
      </div>

      {competitors === undefined ? (
        <div className="text-center py-8 text-tertiary">{tc('loading')}</div>
      ) : activeCompetitors.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-secondary rounded-lg">
          <p className="text-tertiary mb-4">{t('competitorMgmtNoCompetitors')}</p>
          <PermissionGate permission="competitors.add">
            <Button onClick={() => setShowAddDialog(true)} color="secondary" size="sm" iconLeading={Plus}>
              {t('competitorMgmtAddFirst')}
            </Button>
          </PermissionGate>
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
              {t('competitorMgmtSelectAll')} ({activeCompetitors.length})
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
                      {t('lastCheckedPrefix')}{new Date(competitor.lastCheckedAt).toLocaleDateString()}
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
                          {contentGapJob.status === "processing" && t('competitorMgmtJobAnalyzing')}
                          {contentGapJob.status === "completed" && tc('opportunitiesCount', { count: contentGapJob.opportunitiesFound || 0 })}
                          {contentGapJob.status === "failed" && tc('error')}
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
                          {backlinksJob.status === "processing" && t('competitorMgmtJobFetching')}
                          {backlinksJob.status === "completed" && tc('backlinksCount', { count: backlinksJob.backlinksFound || 0 })}
                          {backlinksJob.status === "failed" && tc('error')}
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
                  title={t('analyzeContentGaps')}
                  iconLeading={Target04}
                >
                  {t('competitorMgmtContentGap')}
                </Button>
                <Button
                  color="secondary"
                  size="sm"
                  onClick={() => handleFetchBacklinks(competitor._id, competitor.name || competitor.competitorDomain)}
                  isDisabled={!!backlinksJob}
                  title={t('competitorMgmtBacklinks')}
                  iconLeading={Link03}
                >
                  {t('competitorMgmtBacklinks')}
                </Button>
                <Button
                  color="tertiary"
                  size="sm"
                  onClick={() => handleEditCompetitor(competitor._id, competitor.name || competitor.competitorDomain)}
                  title={t('editCompetitor')}
                  iconLeading={Edit05}
                />
                <Button
                  color="tertiary-destructive"
                  size="sm"
                  onClick={() => handleRemove(competitor._id)}
                  title={t('removeCompetitor')}
                  iconLeading={Trash01}
                />
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* Competitor Import Modal */}
      <CompetitorImportModal
        domainId={domainId}
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />

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
                    {t('competitorMgmtEditCompetitor')}
                  </Heading>
                  <p className="mt-1 text-sm text-tertiary">
                    {t('competitorMgmtEditSubtitle')}
                  </p>
                </div>

                {/* Content */}
                <div className="space-y-4 px-6 py-4">
                  <Input
                    size="md"
                    label={t('competitorMgmtDisplayName')}
                    placeholder={t('competitorMgmtPlaceholder')}
                    value={editName}
                    onChange={(value: string) => setEditName(value)}
                    isRequired
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-secondary px-6 py-4">
                  <Button color="secondary" size="md" onClick={() => setEditingCompetitor(null)}>
                    {tc('cancel')}
                  </Button>
                  <Button color="primary" size="md" onClick={handleSaveEdit}>
                    {t('competitorMgmtSaveChanges')}
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
