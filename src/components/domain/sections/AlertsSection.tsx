"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id, Doc } from "../../../../convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash01, Edit01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

// =================================================================
// Types
// =================================================================

type AlertRuleType = "position_drop" | "top_n_exit" | "new_competitor" | "backlink_lost" | "visibility_drop";

const RULE_TYPES: AlertRuleType[] = [
  "position_drop",
  "top_n_exit",
  "new_competitor",
  "backlink_lost",
  "visibility_drop",
];

const RULE_TYPE_DEFAULTS: Record<AlertRuleType, { threshold: number; topN?: number }> = {
  position_drop: { threshold: 10 },
  top_n_exit: { threshold: 10, topN: 10 },
  new_competitor: { threshold: 1 },
  backlink_lost: { threshold: 5 },
  visibility_drop: { threshold: 20 },
};

function getRuleTypeLabel(t: (key: string) => string, type: AlertRuleType): string {
  const map: Record<AlertRuleType, string> = {
    position_drop: t("alertTypePositionDrop"),
    top_n_exit: t("alertTypeTopNExit"),
    new_competitor: t("alertTypeNewCompetitor"),
    backlink_lost: t("alertTypeBacklinkLost"),
    visibility_drop: t("alertTypeVisibilityDrop"),
  };
  return map[type] || type;
}

function getThresholdUnit(t: (key: string) => string, type: AlertRuleType): string {
  if (type === "visibility_drop") return t("alertPercentLabel");
  if (type === "backlink_lost") return t("alertBacklinksLabel");
  return t("alertPositionsLabel");
}

// =================================================================
// AlertsSection
// =================================================================

interface AlertsSectionProps {
  domainId: Id<"domains">;
}

export function AlertsSection({ domainId }: AlertsSectionProps) {
  const t = useTranslations("domains");
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("rules")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "rules"
              ? "border-brand-600 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          {t("alertRules")}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "history"
              ? "border-brand-600 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          {t("alertHistory")}
          <UnacknowledgedBadge domainId={domainId} />
        </button>
      </div>

      {activeTab === "rules" ? (
        <AlertRulesManager domainId={domainId} />
      ) : (
        <AlertHistoryList domainId={domainId} />
      )}
    </div>
  );
}

// =================================================================
// Unacknowledged Badge
// =================================================================

function UnacknowledgedBadge({ domainId }: { domainId: Id<"domains"> }) {
  const count = useQuery(api.alertRules.getUnacknowledgedAlertCount, { domainId });
  if (!count || count === 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// =================================================================
// Alert Rules Manager
// =================================================================

function AlertRulesManager({ domainId }: { domainId: Id<"domains"> }) {
  const t = useTranslations("domains");
  const rules = useQuery(api.alertRules.getAlertRulesByDomain, { domainId });
  const toggleRule = useMutation(api.alertRules.toggleAlertRule);
  const deleteRule = useMutation(api.alertRules.deleteAlertRule);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<Doc<"alertRules"> | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<Id<"alertRules"> | null>(null);

  async function handleToggle(ruleId: Id<"alertRules">) {
    try {
      const newState = await toggleRule({ ruleId });
      toast.success(t("alertRuleToggled", { status: newState ? t("alertActive").toLowerCase() : t("alertInactive").toLowerCase() }));
    } catch {
      toast.error(t("failedToToggleRule"));
    }
  }

  async function handleDelete(ruleId: Id<"alertRules">) {
    try {
      await deleteRule({ ruleId });
      toast.success(t("alertRuleDeleted"));
      setDeletingRuleId(null);
    } catch {
      toast.error(t("failedToDeleteRule"));
    }
  }

  if (rules === undefined) {
    return <div className="py-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("alertRules")}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("alertRulesDescription")}</p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {t("createAlertRule")}
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{t("alertNoRules")}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("alertNoRulesDescription")}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {rules.map((rule) => (
            <div key={rule._id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-3 min-w-0">
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(rule._id)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    rule.isActive ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      rule.isActive ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{rule.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getRuleTypeLabel(t, rule.ruleType as AlertRuleType)}
                    {rule.ruleType !== "new_competitor" && (
                      <span> &middot; {t("alertThreshold")}: {rule.threshold}{rule.ruleType === "top_n_exit" ? ` (Top ${rule.topN ?? rule.threshold})` : ""}</span>
                    )}
                    <span> &middot; {t("alertCooldown")}: {Math.round(rule.cooldownMinutes / 60)}h</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => setEditingRule(rule)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                >
                  <Edit01 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletingRuleId(rule._id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                >
                  <Trash01 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {(showCreateDialog || editingRule) && (
        <AlertRuleDialog
          domainId={domainId}
          rule={editingRule}
          onClose={() => {
            setShowCreateDialog(false);
            setEditingRule(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deletingRuleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t("deleteAlertRule")}</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("deleteAlertRuleConfirm")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setDeletingRuleId(null)}>
                {t("alertCancel")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(deletingRuleId)}>
                {t("deleteAlertRule")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =================================================================
// Alert Rule Dialog (Create/Edit)
// =================================================================

interface AlertRuleDialogProps {
  domainId: Id<"domains">;
  rule: Doc<"alertRules"> | null;
  onClose: () => void;
}

function AlertRuleDialog({ domainId, rule, onClose }: AlertRuleDialogProps) {
  const t = useTranslations("domains");
  const createRule = useMutation(api.alertRules.createAlertRule);
  const updateRule = useMutation(api.alertRules.updateAlertRule);

  const [name, setName] = useState(rule?.name ?? "");
  const [ruleType, setRuleType] = useState<AlertRuleType>((rule?.ruleType as AlertRuleType) ?? "position_drop");
  const [threshold, setThreshold] = useState(rule?.threshold ?? RULE_TYPE_DEFAULTS.position_drop.threshold);
  const [topN, setTopN] = useState(rule?.topN ?? 10);
  const [cooldownHours, setCooldownHours] = useState(Math.round((rule?.cooldownMinutes ?? 1440) / 60));
  const [notifyEmail, setNotifyEmail] = useState(rule?.notifyVia?.includes("email") ?? false);
  const [saving, setSaving] = useState(false);

  // Update threshold when rule type changes (only for new rules)
  function handleRuleTypeChange(type: AlertRuleType) {
    setRuleType(type);
    if (!rule) {
      setThreshold(RULE_TYPE_DEFAULTS[type].threshold);
      if (RULE_TYPE_DEFAULTS[type].topN) {
        setTopN(RULE_TYPE_DEFAULTS[type].topN!);
      }
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const notifyVia: ("in_app" | "email")[] = notifyEmail ? ["in_app", "email"] : ["in_app"];

      if (rule) {
        await updateRule({
          ruleId: rule._id,
          name: name.trim(),
          threshold,
          topN: ruleType === "top_n_exit" ? topN : undefined,
          cooldownMinutes: cooldownHours * 60,
          notifyVia,
        });
        toast.success(t("alertRuleUpdated"));
      } else {
        await createRule({
          domainId,
          name: name.trim(),
          ruleType,
          threshold,
          topN: ruleType === "top_n_exit" ? topN : undefined,
          cooldownMinutes: cooldownHours * 60,
          notifyVia,
        });
        toast.success(t("alertRuleCreated"));
      }
      onClose();
    } catch {
      toast.error(rule ? t("failedToUpdateRule") : t("failedToCreateRule"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {rule ? t("editAlertRule") : t("createAlertRule")}
        </h3>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("alertRuleName")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g. Position drop > 10"
            />
          </div>

          {/* Rule Type (only for create) */}
          {!rule && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("alertRuleType")}
              </label>
              <select
                value={ruleType}
                onChange={(e) => handleRuleTypeChange(e.target.value as AlertRuleType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                {RULE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {getRuleTypeLabel(t, type)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Threshold (not for new_competitor) */}
          {ruleType !== "new_competitor" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("alertThreshold")} ({getThresholdUnit(t, ruleType)})
              </label>
              <input
                type="number"
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          )}

          {/* Top N (only for top_n_exit) */}
          {ruleType === "top_n_exit" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("alertTopN")}
              </label>
              <select
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                {[3, 10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>Top {n}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cooldown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("alertCooldown")}
            </label>
            <input
              type="number"
              min={1}
              value={cooldownHours}
              onChange={(e) => setCooldownHours(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Email notification */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notifyEmail"
              checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="notifyEmail" className="text-sm text-gray-700 dark:text-gray-300">
              {t("alertEmail")}
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("alertCancel")}
          </Button>
          <Button size="sm" variant="primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "..." : t("alertSave")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// Alert History List
// =================================================================

function AlertHistoryList({ domainId }: { domainId: Id<"domains"> }) {
  const t = useTranslations("domains");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "acknowledged">("all");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const events = useQuery(api.alertRules.getAlertEventsByDomain, {
    domainId,
    statusFilter: statusFilter === "all" ? undefined : statusFilter,
    typeFilter: typeFilter || undefined,
    limit: 100,
  });

  const acknowledgeEvent = useMutation(api.alertRules.acknowledgeAlertEvent);
  const acknowledgeAll = useMutation(api.alertRules.acknowledgeAllAlertEvents);

  async function handleAcknowledge(eventId: Id<"alertEvents">) {
    try {
      await acknowledgeEvent({ eventId });
    } catch {
      toast.error(t("failedToAcknowledge"));
    }
  }

  async function handleAcknowledgeAll() {
    try {
      const count = await acknowledgeAll({ domainId });
      toast.success(t("alertEventsAcknowledged", { count }));
    } catch {
      toast.error(t("failedToAcknowledge"));
    }
  }

  if (events === undefined) {
    return <div className="py-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("alertHistory")}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("alertHistoryDescription")}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleAcknowledgeAll}>
          {t("alertAcknowledgeAll")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">{t("alertFilterAll")}</option>
          <option value="active">{t("alertFilterActive")}</option>
          <option value="acknowledged">{t("alertFilterAcknowledged")}</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">{t("alertFilterAll")}</option>
          {RULE_TYPES.map((type) => (
            <option key={type} value={type}>{getRuleTypeLabel(t, type)}</option>
          ))}
        </select>
      </div>

      {events.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{t("alertNoEvents")}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("alertNoEventsDescription")}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {events.map((event) => (
            <div
              key={event._id}
              className={`px-4 py-3 ${
                event.status === "active"
                  ? "bg-amber-50 dark:bg-amber-900/10"
                  : "bg-white dark:bg-gray-800"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        event.status === "active"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {event.status === "active" ? t("alertStatusActive") : t("alertStatusAcknowledged")}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {getRuleTypeLabel(t, event.ruleType as AlertRuleType)}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(event.triggeredAt).toLocaleDateString()} {new Date(event.triggeredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {event.data.details || `Alert triggered`}
                  </p>
                  {event.data.keywordPhrase && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Keyword: {event.data.keywordPhrase}
                    </p>
                  )}
                </div>
                {event.status === "active" && (
                  <button
                    onClick={() => handleAcknowledge(event._id)}
                    className="ml-3 px-3 py-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 border border-brand-300 dark:border-brand-600 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                  >
                    {t("alertAcknowledge")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
