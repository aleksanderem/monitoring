"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Table, TableCard } from "@/components/application/table/table";
import { Breadcrumbs } from "@/components/application/breadcrumbs/breadcrumbs";
import { Modal } from "@/components/base/modal/modal";

// Plans API is newly created — cast to bypass generated types until next `npx convex dev`
const plansApi = (api as any).plans;
import {
  FileCheck02,
  Plus,
  Trash01,
  Edit05,
  AlertCircle,
  Zap,
} from "@untitledui/icons";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";

const ALL_MODULES = [
  { key: "positioning", label: "Pozycjonowanie" },
  { key: "backlinks", label: "Backlinki" },
  { key: "seo_audit", label: "Audyt SEO" },
  { key: "reports", label: "Raporty" },
  { key: "competitors", label: "Konkurencja" },
  { key: "ai_strategy", label: "AI" },
  { key: "forecasts", label: "Prognozy" },
  { key: "link_building", label: "Link Building" },
];

interface PlanFormData {
  name: string;
  key: string;
  description: string;
  modules: string[];
  limits: {
    maxKeywords?: number;
    maxDomains?: number;
    maxProjects?: number;
    maxDomainsPerProject?: number;
    maxKeywordsPerDomain?: number;
    maxDailyRefreshes?: number;
  };
  isDefault: boolean;
}

const EMPTY_FORM: PlanFormData = {
  name: "",
  key: "",
  description: "",
  modules: [],
  limits: {
    maxKeywords: 100,
    maxDomains: 5,
    maxProjects: 3,
    maxDomainsPerProject: 5,
    maxKeywordsPerDomain: 100,
    maxDailyRefreshes: 10,
  },
  isDefault: false,
};

export default function AdminPlansPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  usePageTitle("Admin", "Plans");

  const plans = useQuery(plansApi.getPlans) as any[] | undefined;
  const createPlan = useMutation(plansApi.createPlan);
  const updatePlan = useMutation(plansApi.updatePlan);
  const deletePlan = useMutation(plansApi.deletePlan);
  const seedPlans = useMutation(plansApi.seedPlans);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<Id<"plans"> | null>(null);
  const [form, setForm] = useState<PlanFormData>(EMPTY_FORM);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<Id<"plans"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openCreateForm = () => {
    setEditingPlanId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEditForm = (plan: any) => {
    setEditingPlanId(plan._id);
    setForm({
      name: plan.name,
      key: plan.key,
      description: plan.description ?? "",
      modules: plan.modules ?? [],
      limits: {
        maxKeywords: plan.limits?.maxKeywords,
        maxDomains: plan.limits?.maxDomains,
        maxProjects: plan.limits?.maxProjects,
        maxDomainsPerProject: plan.limits?.maxDomainsPerProject,
        maxKeywordsPerDomain: plan.limits?.maxKeywordsPerDomain,
        maxDailyRefreshes: plan.limits?.maxDailyRefreshes,
      },
      isDefault: plan.isDefault ?? false,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.key.trim()) {
      toast.error("Nazwa i klucz sa wymagane");
      return;
    }

    setIsSaving(true);
    try {
      if (editingPlanId) {
        await updatePlan({
          planId: editingPlanId,
          name: form.name,
          key: form.key,
          description: form.description || undefined,
          modules: form.modules,
          limits: form.limits,
          isDefault: form.isDefault,
        });
        toast.success("Plan zaktualizowany");
      } else {
        await createPlan({
          name: form.name,
          key: form.key,
          description: form.description || undefined,
          permissions: [],
          modules: form.modules,
          limits: form.limits,
          isDefault: form.isDefault,
        });
        toast.success("Plan utworzony");
      }
      setIsFormOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Nie udalo sie zapisac planu");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPlanId) return;
    try {
      await deletePlan({ planId: deletingPlanId });
      toast.success("Plan usuniety");
      setIsDeleteModalOpen(false);
      setDeletingPlanId(null);
    } catch (e: any) {
      toast.error(e?.message || "Nie udalo sie usunac planu");
    }
  };

  const handleSeed = async () => {
    try {
      await seedPlans({});
      toast.success("Plany zostaly zaladowane");
    } catch (e: any) {
      toast.error(e?.message || "Nie udalo sie zaladowac planow");
    }
  };

  const toggleModule = (moduleKey: string) => {
    setForm((prev) => ({
      ...prev,
      modules: prev.modules.includes(moduleKey)
        ? prev.modules.filter((m) => m !== moduleKey)
        : [...prev.modules, moduleKey],
    }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Breadcrumbs className="mb-6">
        <Breadcrumbs.Item href="/admin">{t("sidebarTitle")}</Breadcrumbs.Item>
        <Breadcrumbs.Item>Plany</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-utility-brand-50 flex items-center justify-center">
              <FileCheck02 className="w-7 h-7 text-utility-brand-700" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-primary">
                Zarzadzanie planami
              </h1>
              <p className="mt-0.5 text-sm text-tertiary">
                Tworzenie, edycja i usuwanie planow subskrypcyjnych.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {plans && plans.length === 0 && (
              <Button color="secondary" size="md" onClick={handleSeed}>
                <Zap className="w-4 h-4" />
                Zaladuj domyslne plany
              </Button>
            )}
            <Button color="primary" size="md" onClick={openCreateForm}>
              <Plus className="w-4 h-4" />
              Nowy plan
            </Button>
          </div>
        </div>
      </div>

      <TableCard.Root>
        <TableCard.Header
          title="Wszystkie plany"
          badge={plans?.length ?? 0}
        />
        <Table aria-label="Plany">
          <Table.Header>
            <Table.Head label="Nazwa" isRowHeader />
            <Table.Head label="Klucz" />
            <Table.Head label="Moduly" />
            <Table.Head label="Limity" />
            <Table.Head label="Domyslny" />
            <Table.Head id="actions" />
          </Table.Header>
          <Table.Body items={plans ?? []}>
            {(plan) => (
              <Table.Row id={plan._id}>
                <Table.Cell>
                  <div>
                    <div className="font-medium text-primary">{plan.name}</div>
                    {plan.description && (
                      <div className="text-xs text-tertiary">
                        {plan.description}
                      </div>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm font-mono text-secondary">
                    {plan.key}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-wrap gap-1">
                    {plan.modules?.map((mod: string) => (
                      <Badge key={mod} size="sm" color="gray">
                        {mod}
                      </Badge>
                    ))}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="text-xs text-secondary space-y-0.5">
                    {plan.limits?.maxProjects != null && (
                      <div>Projekty: {plan.limits.maxProjects}</div>
                    )}
                    {plan.limits?.maxDomainsPerProject != null && (
                      <div>
                        Domeny/projekt: {plan.limits.maxDomainsPerProject}
                      </div>
                    )}
                    {plan.limits?.maxKeywordsPerDomain != null && (
                      <div>
                        Slowa/domena: {plan.limits.maxKeywordsPerDomain}
                      </div>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {plan.isDefault && (
                    <Badge size="sm" color="brand">
                      Domyslny
                    </Badge>
                  )}
                </Table.Cell>
                <Table.Cell className="px-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      color="tertiary"
                      size="sm"
                      onClick={() => openEditForm(plan)}
                    >
                      <Edit05 className="w-4 h-4" />
                    </Button>
                    <Button
                      color="tertiary"
                      size="sm"
                      onClick={() => {
                        setDeletingPlanId(plan._id);
                        setIsDeleteModalOpen(true);
                      }}
                    >
                      <Trash01 className="w-4 h-4" />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </TableCard.Root>

      {/* Create/Edit Plan Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingPlanId ? "Edytuj plan" : "Nowy plan"}
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Nazwa
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="np. Pro"
                className="w-full px-3 py-2 border border-primary rounded-lg bg-primary text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-solid dark:bg-utility-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Klucz
              </label>
              <input
                type="text"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="np. pro"
                className="w-full px-3 py-2 border border-primary rounded-lg bg-primary text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-solid dark:bg-utility-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Opis
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Krotki opis planu"
              className="w-full px-3 py-2 border border-primary rounded-lg bg-primary text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-solid dark:bg-utility-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Moduly
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODULES.map((mod) => (
                <label
                  key={mod.key}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.modules.includes(mod.key)}
                    onChange={() => toggleModule(mod.key)}
                    className="h-4 w-4 rounded border-primary text-brand-600 focus:ring-brand-solid dark:bg-utility-gray-800"
                  />
                  <span className="text-sm text-primary">{mod.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Limity
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "maxProjects" as const, label: "Max projektow" },
                {
                  key: "maxDomainsPerProject" as const,
                  label: "Max domen / projekt",
                },
                {
                  key: "maxKeywordsPerDomain" as const,
                  label: "Max slow / domena",
                },
                { key: "maxKeywords" as const, label: "Max slow kluczowych" },
                { key: "maxDomains" as const, label: "Max domen" },
                {
                  key: "maxDailyRefreshes" as const,
                  label: "Max odswiezen / dzien",
                },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-tertiary mb-1">
                    {field.label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.limits[field.key] ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        limits: {
                          ...form.limits,
                          [field.key]: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid dark:bg-utility-gray-800 dark:text-white"
                  />
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={() => setForm({ ...form, isDefault: !form.isDefault })}
              className="h-4 w-4 rounded border-primary text-brand-600 focus:ring-brand-solid dark:bg-utility-gray-800"
            />
            <span className="text-sm text-primary">
              Plan domyslny (przypisywany nowym organizacjom)
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-primary">
            <Button
              color="secondary"
              size="md"
              onClick={() => setIsFormOpen(false)}
            >
              {tc("cancel")}
            </Button>
            <Button
              color="primary"
              size="md"
              onClick={handleSave}
              isLoading={isSaving}
            >
              {editingPlanId ? "Zapisz zmiany" : "Utworz plan"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Usun plan"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-utility-error-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-primary">
              Czy na pewno chcesz usunac ten plan? Operacja jest nieodwracalna.
              Plan nie moze byc usuniety jesli jest przypisany do organizacji.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              color="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              {tc("cancel")}
            </Button>
            <Button color="primary-destructive" onClick={handleDelete}>
              Usun plan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
