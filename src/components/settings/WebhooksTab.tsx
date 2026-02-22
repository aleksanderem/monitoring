"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// ─── Types ──────────────────────────────────────────────────────────

interface WebhooksTabProps {
  orgId: Id<"organizations">;
}

const WEBHOOK_EVENTS = [
  "position.changed",
  "alert.triggered",
  "keyword.added",
  "competitor.detected",
  "backlink.lost",
] as const;

// ─── Add/Edit Modal ─────────────────────────────────────────────────

function WebhookModal({
  webhook,
  onClose,
  orgId,
}: {
  webhook?: {
    _id: Id<"webhookEndpoints">;
    url: string;
    secret: string;
    events: string[];
  } | null;
  onClose: () => void;
  orgId: Id<"organizations">;
}) {
  const t = useTranslations("webhooks");
  const createWebhook = useMutation(api.webhooks.createWebhook);
  const updateWebhook = useMutation(api.webhooks.updateWebhook);

  const [url, setUrl] = useState(webhook?.url ?? "");
  const [secret, setSecret] = useState(webhook?.secret ?? "");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    new Set(webhook?.events ?? [])
  );

  const isEditing = !!webhook;

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!url.trim()) {
      toast.error(t("urlRequired"));
      return;
    }

    try {
      if (isEditing) {
        await updateWebhook({
          webhookId: webhook._id,
          url: url.trim(),
          events: Array.from(selectedEvents),
        });
        toast.success(t("webhookUpdated"));
      } else {
        await createWebhook({
          orgId,
          url: url.trim(),
          secret: secret.trim() || crypto.randomUUID(),
          events: Array.from(selectedEvents),
        });
        toast.success(t("webhookCreated"));
      }
      onClose();
    } catch {
      toast.error(isEditing ? t("updateFailed") : t("createFailed"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="webhook-modal"
    >
      <div className="w-full max-w-md rounded-lg border border-secondary bg-primary p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-primary">
          {isEditing ? t("editWebhook") : t("addWebhook")}
        </h3>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              {t("url")}
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              data-testid="webhook-url-input"
              className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {!isEditing && (
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t("secret")}
              </label>
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={t("secretPlaceholder")}
                data-testid="webhook-secret-input"
                className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-secondary">
              {t("events")}
            </label>
            <div className="flex flex-col gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <label
                  key={event}
                  className="flex items-center gap-2 text-sm text-secondary"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.has(event)}
                    onChange={() => toggleEvent(event)}
                  />
                  {t(`eventTypes.${event.replace(".", "_")}`)}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button color="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} data-testid="webhook-save-btn">
            {isEditing ? t("save") : t("addWebhook")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Delivery Log ───────────────────────────────────────────────────

function DeliveryLog({ endpointId }: { endpointId: Id<"webhookEndpoints"> }) {
  const t = useTranslations("webhooks");
  const deliveries = useQuery(api.webhooks.getWebhookDeliveries, {
    endpointId,
    limit: 10,
  });

  if (!deliveries || deliveries.length === 0) {
    return (
      <p className="py-2 text-sm text-tertiary" data-testid="no-deliveries">
        {t("noDeliveries")}
      </p>
    );
  }

  return (
    <div className="mt-2 overflow-x-auto" data-testid="delivery-log">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-secondary text-left text-xs text-tertiary">
            <th className="px-2 py-1">{t("event")}</th>
            <th className="px-2 py-1">{t("statusCode")}</th>
            <th className="px-2 py-1">{t("attempt")}</th>
            <th className="px-2 py-1">{t("deliveredAt")}</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <tr
              key={d._id}
              className="border-b border-secondary"
              data-testid="delivery-row"
            >
              <td className="px-2 py-1">{d.event}</td>
              <td className="px-2 py-1">
                {d.statusCode ? (
                  <Badge
                    color={
                      d.statusCode >= 200 && d.statusCode < 300
                        ? "success"
                        : "error"
                    }
                    size="sm"
                  >
                    {d.statusCode}
                  </Badge>
                ) : (
                  <Badge color="warning" size="sm">
                    —
                  </Badge>
                )}
              </td>
              <td className="px-2 py-1">{d.attemptNumber}</td>
              <td className="px-2 py-1 text-xs text-tertiary">
                {d.deliveredAt
                  ? new Date(d.deliveredAt).toLocaleString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function WebhooksTab({ orgId }: WebhooksTabProps) {
  const t = useTranslations("webhooks");
  const endpoints = useQuery(api.webhooks.getWebhookEndpoints, { orgId });
  const updateWebhook = useMutation(api.webhooks.updateWebhook);
  const deleteWebhookMut = useMutation(api.webhooks.deleteWebhook);
  const testWebhookAction = useAction(api.actions.webhookDelivery.testWebhook);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleTest = async (webhookId: Id<"webhookEndpoints">) => {
    try {
      await testWebhookAction({ webhookId });
      toast.success(t("testSent"));
    } catch {
      toast.error(t("testFailed"));
    }
  };

  const handleToggleStatus = async (
    webhookId: Id<"webhookEndpoints">,
    currentStatus: string
  ) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await updateWebhook({
      webhookId,
      status: newStatus as "active" | "paused",
    });
  };

  const handleDelete = async (webhookId: Id<"webhookEndpoints">) => {
    try {
      await deleteWebhookMut({ webhookId });
      toast.success(t("webhookDeleted"));
      setConfirmDeleteId(null);
    } catch {
      toast.error(t("deleteFailed"));
    }
  };

  if (endpoints === undefined) {
    return (
      <div data-testid="webhooks-loading" className="text-sm text-tertiary">
        {t("loading")}
      </div>
    );
  }

  return (
    <div data-testid="webhooks-tab">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">{t("title")}</h2>
          <p className="text-sm text-tertiary">{t("description")}</p>
        </div>
        <Button
          onClick={() => {
            setEditingWebhook(null);
            setModalOpen(true);
          }}
          data-testid="add-webhook-btn"
        >
          {t("addWebhook")}
        </Button>
      </div>

      {endpoints.length === 0 ? (
        <div
          className="rounded-lg border border-secondary p-8 text-center"
          data-testid="no-webhooks"
        >
          <p className="text-sm text-tertiary">{t("noWebhooks")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {endpoints.map((ep) => (
            <div
              key={ep._id}
              className="rounded-lg border border-secondary p-4"
              data-testid="webhook-endpoint"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    color={
                      ep.status === "active"
                        ? "success"
                        : ep.status === "paused"
                          ? "warning"
                          : "error"
                    }
                    size="sm"
                  >
                    {t(ep.status)}
                  </Badge>
                  <span className="text-sm font-medium text-primary">
                    {ep.url}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    color="secondary"
                    size="sm"
                    onClick={() => handleTest(ep._id)}
                    data-testid="test-webhook-btn"
                  >
                    {t("testWebhook")}
                  </Button>
                  <Button
                    color="secondary"
                    size="sm"
                    onClick={() => handleToggleStatus(ep._id, ep.status)}
                    data-testid="toggle-status-btn"
                  >
                    {ep.status === "active" ? t("pause") : t("resume")}
                  </Button>
                  <Button
                    color="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingWebhook(ep);
                      setModalOpen(true);
                    }}
                    data-testid="edit-webhook-btn"
                  >
                    {t("editWebhook")}
                  </Button>
                  {confirmDeleteId === ep._id ? (
                    <div className="flex gap-1">
                      <Button
                        color="secondary-destructive"
                        size="sm"
                        onClick={() => handleDelete(ep._id)}
                        data-testid="confirm-delete-btn"
                      >
                        {t("confirmDelete")}
                      </Button>
                      <Button
                        color="secondary"
                        size="sm"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      color="secondary-destructive"
                      size="sm"
                      onClick={() => setConfirmDeleteId(ep._id)}
                      data-testid="delete-webhook-btn"
                    >
                      {t("deleteWebhook")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {ep.events.map((event) => (
                  <Badge key={event} color="brand" size="sm">
                    {event}
                  </Badge>
                ))}
              </div>

              <button
                className="mt-2 text-xs text-brand-600 hover:underline"
                onClick={() =>
                  setExpandedId(expandedId === ep._id ? null : ep._id)
                }
                data-testid="toggle-deliveries-btn"
              >
                {expandedId === ep._id
                  ? t("hideDeliveries")
                  : t("showDeliveries")}
              </button>

              {expandedId === ep._id && <DeliveryLog endpointId={ep._id} />}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <WebhookModal
          webhook={editingWebhook}
          onClose={() => {
            setModalOpen(false);
            setEditingWebhook(null);
          }}
          orgId={orgId}
        />
      )}
    </div>
  );
}
