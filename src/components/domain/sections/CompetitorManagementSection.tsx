"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Dialog, Modal, ModalOverlay, DialogTrigger } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { Badge } from "@/components/base/badges/badges";
import { Plus, Trash01, PauseCircle, PlayCircle } from "@untitledui/icons";
import { toast } from "sonner";
import { Heading } from "react-aria-components";

interface CompetitorManagementSectionProps {
  domainId: Id<"domains">;
}

export function CompetitorManagementSection({ domainId }: CompetitorManagementSectionProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [competitorDomain, setCompetitorDomain] = useState("");
  const [competitorName, setCompetitorName] = useState("");

  const competitors = useQuery(api.queries.competitors.getCompetitorsByDomain, { domainId });
  const addCompetitor = useMutation(api.mutations.competitors.addCompetitor);
  const updateCompetitor = useMutation(api.mutations.competitors.updateCompetitor);
  const removeCompetitor = useMutation(api.mutations.competitors.removeCompetitor);

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
    </div>
  );
}
