"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Badge } from "@/components/base/badges/badges";
import { LoadingState } from "@/components/shared/LoadingState";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface ClientManagementProps {
  organizationId: Id<"organizations">;
}

export function ClientManagement({ organizationId }: ClientManagementProps) {
  const t = useTranslations("agency");
  const tc = useTranslations("common");
  const clients = useQuery(api.agency.getAgencyClients, { orgId: organizationId });
  const addClient = useMutation(api.agency.addClientOrg);
  const removeClient = useMutation(api.agency.removeClientOrg);
  const suspendClient = useMutation(api.agency.suspendClient);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientDomain, setNewClientDomain] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "remove" | "suspend";
    clientOrgId: Id<"organizations">;
    clientName: string;
  } | null>(null);

  if (clients === undefined) {
    return <LoadingState type="card" rows={3} />;
  }

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    setIsAdding(true);
    try {
      await addClient({
        agencyOrgId: organizationId,
        clientName: newClientName.trim(),
        clientDomain: newClientDomain.trim() || undefined,
      });
      toast.success(t("addClient"));
      setNewClientName("");
      setNewClientDomain("");
      setShowAddModal(false);
    } catch {
      toast.error("Failed to add client");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveClient = async (clientOrgId: Id<"organizations">) => {
    try {
      await removeClient({ agencyOrgId: organizationId, clientOrgId });
      toast.success(t("removeClient"));
      setConfirmAction(null);
    } catch {
      toast.error("Failed to remove client");
    }
  };

  const handleSuspendClient = async (clientOrgId: Id<"organizations">) => {
    try {
      await suspendClient({ agencyOrgId: organizationId, clientOrgId });
      toast.success(t("suspendClient"));
      setConfirmAction(null);
    } catch {
      toast.error("Failed to suspend client");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">{t("title")}</h2>
          <p className="mt-1 text-sm text-tertiary">{t("description")}</p>
        </div>
        <Button color="primary" size="sm" onClick={() => setShowAddModal(true)}>
          {t("addClient")}
        </Button>
      </div>

      {/* Client count summary */}
      <div className="mb-4">
        <span className="text-sm text-tertiary">
          {t("clientCount", { count: clients.length })}
        </span>
      </div>

      {/* Client list or empty state */}
      {clients.length === 0 ? (
        <div className="rounded-lg border border-secondary p-8 text-center">
          <p className="text-sm text-tertiary">{t("noClients")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-secondary text-left">
                <th className="px-4 py-3 font-medium text-secondary">{t("clientName")}</th>
                <th className="px-4 py-3 font-medium text-secondary">{t("clientStatus")}</th>
                <th className="px-4 py-3 font-medium text-secondary">{t("createdDate")}</th>
                <th className="px-4 py-3 font-medium text-secondary">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client._id} className="border-b border-secondary">
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-primary">{client.clientName}</span>
                      {client.clientSlug && (
                        <span className="ml-2 text-xs text-tertiary">{client.clientSlug}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      size="sm"
                      type="pill-color"
                      color={client.status === "active" ? "success" : "warning"}
                    >
                      {client.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-tertiary">
                    {new Date(client.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {client.status === "active" && (
                        <Button
                          color="secondary"
                          size="sm"
                          onClick={() =>
                            setConfirmAction({
                              type: "suspend",
                              clientOrgId: client.clientOrgId,
                              clientName: client.clientName,
                            })
                          }
                        >
                          {t("suspendClient")}
                        </Button>
                      )}
                      <Button
                        color="primary-destructive"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({
                            type: "remove",
                            clientOrgId: client.clientOrgId,
                            clientName: client.clientName,
                          })
                        }
                      >
                        {t("removeClient")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add client modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label={t("addClientTitle")}>
          <div className="w-full max-w-md rounded-xl bg-primary p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-primary">{t("addClientTitle")}</h3>
            <p className="mt-1 text-sm text-tertiary">{t("addClientDescription")}</p>

            <div className="mt-4 space-y-4">
              <Input
                label={t("clientName")}
                size="sm"
                placeholder="Client organization name"
                value={newClientName}
                onChange={(v) => setNewClientName(v)}
              />
              <Input
                label={t("clientDomain")}
                size="sm"
                placeholder="client-website.com"
                value={newClientDomain}
                onChange={(v) => setNewClientDomain(v)}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button color="secondary" size="sm" onClick={() => setShowAddModal(false)}>
                {tc("cancel")}
              </Button>
              <Button
                color="primary"
                size="sm"
                onClick={handleAddClient}
                isLoading={isAdding}
                disabled={!newClientName.trim()}
              >
                {t("addClient")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm action modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label={tc("confirm")}>
          <div className="w-full max-w-sm rounded-xl bg-primary p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-primary">
              {confirmAction.type === "remove" ? t("removeClient") : t("suspendClient")}
            </h3>
            <p className="mt-2 text-sm text-tertiary">
              {confirmAction.type === "remove" ? t("confirmRemove") : t("confirmSuspend")}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <Button color="secondary" size="sm" onClick={() => setConfirmAction(null)}>
                {tc("cancel")}
              </Button>
              <Button
                color="primary-destructive"
                size="sm"
                onClick={() =>
                  confirmAction.type === "remove"
                    ? handleRemoveClient(confirmAction.clientOrgId)
                    : handleSuspendClient(confirmAction.clientOrgId)
                }
              >
                {tc("confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
