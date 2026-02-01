"use client";

import { useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Dialog, Modal, ModalOverlay, DialogTrigger } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { Badge } from "@/components/base/badges/badges";
import { Plus, Trash01, PauseCircle, PlayCircle, Edit05, RefreshCcw01, InfoCircle } from "@untitledui/icons";
import { toast } from "sonner";
import { Heading } from "react-aria-components";

interface CompetitorManagementSectionProps {
  domainId: Id<"domains">;
}

export function CompetitorManagementSection({ domainId }: CompetitorManagementSectionProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [competitorDomain, setCompetitorDomain] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [editingCompetitor, setEditingCompetitor] = useState<{ id: Id<"competitors">; name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [checkingPositions, setCheckingPositions] = useState<Set<string>>(new Set());

  const competitors = useQuery(api.queries.competitors.getCompetitorsByDomain, { domainId });
  const addCompetitor = useMutation(api.mutations.competitors.addCompetitor);
  const updateCompetitor = useMutation(api.mutations.competitors.updateCompetitor);
  const removeCompetitor = useMutation(api.mutations.competitors.removeCompetitor);
  const checkPositions = useAction(api.competitors_actions.checkCompetitorPositions);

  const handleAddCompetitor = async () => {
    if (!competitorDomain.trim()) {
      toast.error("Please enter a competitor domain");
      return;
    }

    try {
      await addCompetitor({
        domainId,
        competitorDomain: competitorDomain.trim(),
        name: competitorName.trim() || undefined,
      });

      toast.success("Competitor added successfully");
      setShowAddDialog(false);
      setCompetitorDomain("");
      setCompetitorName("");
    } catch (error: any) {
      toast.error(error.message || "Failed to add competitor");
    }
  };

  const handleToggleStatus = async (competitorId: Id<"competitors">, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "paused" : "active";
      await updateCompetitor({
        competitorId,
        status: newStatus,
      });

      toast.success(`Competitor ${newStatus === "active" ? "activated" : "paused"}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update competitor");
    }
  };

  const handleRemove = async (competitorId: Id<"competitors">) => {
    if (!confirm("Are you sure you want to remove this competitor? All historical data will be deleted.")) {
      return;
    }

    try {
      await removeCompetitor({ competitorId });
      toast.success("Competitor removed");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove competitor");
    }
  };

  const handleCheckPositions = async (competitorId: Id<"competitors">, competitorName: string) => {
    setCheckingPositions((prev) => new Set(prev).add(competitorId));
    toast.info(`Checking positions for ${competitorName}...`);

    try {
      const result = await checkPositions({ competitorId });
      if (result.processedCount === 0 && result.errors.length === 0) {
        toast.info("No keywords to check. Add keywords to your domain first.");
      } else {
        toast.success(`Checked ${result.processedCount} of ${result.totalKeywords} keywords`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to check positions");
    } finally {
      setCheckingPositions((prev) => {
        const next = new Set(prev);
        next.delete(competitorId);
        return next;
      });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-primary">Competitor Tracking</h3>
          <p className="text-sm text-tertiary">
            Monitor competitor rankings and discover keyword opportunities
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm" color="primary" iconLeading={Plus}>
          Add Competitor
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-brand-subtle bg-brand-subtle/10 p-3">
        <InfoCircle className="h-4 w-4 text-brand-secondary mt-0.5 shrink-0" />
        <p className="text-xs text-tertiary">
          Competitors are tracked against all keywords in your domain. After adding a competitor,
          click &quot;Check Positions&quot; to fetch their current rankings. Position data will
          populate the charts and gap analysis below.
        </p>
      </div>

      {competitors === undefined ? (
        <div className="text-center py-8 text-tertiary">Loading...</div>
      ) : competitors.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-secondary rounded-lg">
          <p className="text-tertiary mb-4">No competitors added yet</p>
          <Button onClick={() => setShowAddDialog(true)} color="secondary" size="sm" iconLeading={Plus}>
            Add Your First Competitor
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {competitors.map((competitor) => (
            <div
              key={competitor._id}
              className="flex items-center justify-between p-4 border border-secondary rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-primary">
                    {competitor.name || competitor.competitorDomain}
                  </h4>
                  <Badge color={competitor.status === "active" ? "brand" : "gray"} size="sm">
                    {competitor.status}
                  </Badge>
                </div>
                <p className="text-sm text-tertiary">{competitor.competitorDomain}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-tertiary">
                  <span>{competitor.keywordCount} keywords tracked</span>
                  {competitor.avgPosition && (
                    <span>Avg position: {competitor.avgPosition}</span>
                  )}
                  {competitor.lastChecked && (
                    <span>
                      Last checked: {new Date(competitor.lastChecked).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  color="secondary"
                  size="sm"
                  onClick={() => handleCheckPositions(competitor._id, competitor.name || competitor.competitorDomain)}
                  isDisabled={checkingPositions.has(competitor._id) || competitor.status !== "active"}
                  title={competitor.status !== "active" ? "Activate competitor to check positions" : "Check keyword positions"}
                  iconLeading={RefreshCcw01}
                >
                  {checkingPositions.has(competitor._id) ? "Checking..." : "Check Positions"}
                </Button>
                <Button
                  color="tertiary"
                  size="sm"
                  onClick={() => handleEditCompetitor(competitor._id, competitor.name || competitor.competitorDomain)}
                  title="Edit competitor"
                  iconLeading={Edit05}
                />
                <Button
                  color="tertiary"
                  size="sm"
                  onClick={() => handleToggleStatus(competitor._id, competitor.status)}
                  title={competitor.status === "active" ? "Pause tracking" : "Resume tracking"}
                  iconLeading={competitor.status === "active" ? PauseCircle : PlayCircle}
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
          ))}
        </div>
      )}

      {/* Add Competitor Dialog */}
      <DialogTrigger isOpen={showAddDialog} onOpenChange={setShowAddDialog}>
        <ModalOverlay isDismissable>
          <Modal>
            <Dialog className="overflow-hidden">
              <div className="relative w-full overflow-hidden rounded-xl bg-primary shadow-xl sm:max-w-lg">
                <CloseButton
                  onClick={() => setShowAddDialog(false)}
                  theme="light"
                  size="lg"
                  className="absolute top-3 right-3 z-10"
                />

                {/* Header */}
                <div className="border-b border-secondary px-6 py-4">
                  <Heading slot="title" className="text-lg font-semibold text-primary">
                    Add Competitor
                  </Heading>
                  <p className="mt-1 text-sm text-tertiary">
                    Add a competitor domain to track their keyword rankings
                  </p>
                </div>

                {/* Content */}
                <div className="space-y-4 px-6 py-4">
                  <Input
                    size="md"
                    label="Competitor Domain"
                    placeholder="example.com"
                    value={competitorDomain}
                    onChange={(value: string) => setCompetitorDomain(value)}
                    hint="Enter the domain without http:// or www."
                    isRequired
                  />

                  <Input
                    size="md"
                    label="Display Name (optional)"
                    placeholder="Leave empty to use domain"
                    value={competitorName}
                    onChange={(value: string) => setCompetitorName(value)}
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-secondary px-6 py-4">
                  <Button color="secondary" size="md" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button color="primary" size="md" onClick={handleAddCompetitor}>
                    Add Competitor
                  </Button>
                </div>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>

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
