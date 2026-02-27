"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DialogTrigger as AriaDialogTrigger, Heading as AriaHeading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { ComboBox } from "@/components/base/select/combobox";
import { SelectItem } from "@/components/base/select/select-item";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

interface CreateDomainDialogProps {
  defaultProjectId?: Id<"projects">;
  children?: React.ReactNode;
}

export function CreateDomainDialog({ defaultProjectId, children }: CreateDomainDialogProps) {
  const t = useTranslations("domains");
  const tc = useTranslations("common");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [projectId, setProjectId] = useState<Id<"projects"> | "">(defaultProjectId || "");
  const [searchEngine, setSearchEngine] = useState("google.com");
  const [refreshFrequency, setRefreshFrequency] = useState<"daily" | "weekly" | "on_demand">("weekly");
  const [location, setLocation] = useState("United States");
  const [language, setLanguage] = useState("en");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const projects = useQuery(api.projects.list);
  const locations = useQuery(api.dataforseoLocations.getLocations);
  const languages = useQuery(api.dataforseoLocations.getLanguages);
  const createDomain = useMutation(api.domains.create);

  // Build ComboBox items for locations
  const locationItems = useMemo(() => {
    if (!locations) return [];
    return locations.map((loc) => ({
      id: loc.location_name,
      label: loc.location_name,
      supportingText: loc.country_iso_code,
    }));
  }, [locations]);

  // Build ComboBox items for languages
  const languageItems = useMemo(() => {
    if (!languages) return [];
    return languages.map((lang) => ({
      id: lang.language_code,
      label: lang.language_name,
      supportingText: lang.language_code,
    }));
  }, [languages]);

  // Strip protocol and trailing slashes from domain input
  const cleanDomain = (value: string) =>
    value.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const stripped = cleanDomain(domain);
    if (!stripped) {
      toast.error(t("pleaseEnterDomainName"));
      return;
    }

    if (!projectId) {
      toast.error(t("pleaseSelectProject"));
      return;
    }

    if (!location) {
      toast.error(t("pleaseSelectLocation"));
      return;
    }

    if (!language) {
      toast.error(t("pleaseSelectLanguage"));
      return;
    }

    try {
      setIsSubmitting(true);
      const newDomainId = await createDomain({
        projectId: projectId as Id<"projects">,
        domain: stripped,
        searchEngine,
        refreshFrequency,
        location,
        language,
      });

      toast.success(t("domainAddedSuccess"));
      setIsOpen(false);
      router.push(`/domains/${newDomainId}`);
      setDomain("");
      setProjectId(defaultProjectId || "");
      setSearchEngine("google.com");
      setRefreshFrequency("weekly");
      setLocation("United States");
      setLanguage("en");
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        toast.error(t("domainLocationLanguageExists"));
      } else {
        toast.error(t("failedToAddDomain"));
      }
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AriaDialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {children || (
        <Button size="md">
          {t("addDomain")}
        </Button>
      )}

      <ModalOverlay isDismissable={!isSubmitting}>
        <Modal>
          <Dialog>
            <form
              onSubmit={handleSubmit}
              className="relative w-full max-h-[85dvh] overflow-y-auto rounded-xl bg-primary shadow-xl sm:max-w-lg"
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
                    {t("addDomainTitle")}
                  </AriaHeading>
                  <p className="text-sm text-tertiary">
                    {t("addDomainDescription")}
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
                        {t("automaticKeywordDiscovery")}
                      </p>
                      <p className="mt-1 text-xs text-utility-blue-700">
                        {t("automaticKeywordDiscoveryDescription")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  <div>
                    <Input
                      size="md"
                      label={t("domainName")}
                      placeholder={t("domainNamePlaceholder")}
                      value={domain}
                      onChange={setDomain}
                      isRequired
                      isDisabled={isSubmitting}
                      autoFocus
                    />
                    {/^https?:\/\//i.test(domain) && (
                      <p className="mt-1 text-xs text-tertiary">
                        {t("protocolWillBeStripped", { domain: cleanDomain(domain) })}
                      </p>
                    )}
                  </div>

                  <Select
                    size="md"
                    label={t("project")}
                    placeholder={t("selectAProject")}
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

                  {/* Location select */}
                  <ComboBox
                    size="md"
                    label={t("location")}
                    placeholder={locations === undefined ? t("loadingLocations") : t("searchLocations")}
                    shortcut={false}
                    selectedKey={location}
                    onSelectionChange={(key) => {
                      if (key) setLocation(key as string);
                    }}
                    items={locationItems}
                    isDisabled={isSubmitting || locations === undefined}
                  >
                    {(item) => (
                      <SelectItem
                        key={item.id}
                        id={item.id}
                        label={item.label}
                        supportingText={item.supportingText}
                      />
                    )}
                  </ComboBox>

                  {/* Language select */}
                  <ComboBox
                    size="md"
                    label={t("language")}
                    placeholder={languages === undefined ? t("loadingLanguages") : t("searchLanguages")}
                    shortcut={false}
                    selectedKey={language}
                    onSelectionChange={(key) => {
                      if (key) setLanguage(key as string);
                    }}
                    items={languageItems}
                    isDisabled={isSubmitting || languages === undefined}
                  >
                    {(item) => (
                      <SelectItem
                        key={item.id}
                        id={item.id}
                        label={item.label}
                        supportingText={item.supportingText}
                      />
                    )}
                  </ComboBox>

                  <Select
                    size="md"
                    label={t("searchEngine")}
                    selectedKey={searchEngine}
                    onSelectionChange={(key) => setSearchEngine(key as string)}
                    isDisabled={isSubmitting}
                  >
                    <Select.Item id="google.com">{t("google")}</Select.Item>
                    <Select.Item id="google.pl">{t("googlePoland")}</Select.Item>
                    <Select.Item id="google.de">{t("googleGermany")}</Select.Item>
                    <Select.Item id="google.fr">{t("googleFrance")}</Select.Item>
                    <Select.Item id="google.es">{t("googleSpain")}</Select.Item>
                    <Select.Item id="google.it">{t("googleItaly")}</Select.Item>
                    <Select.Item id="google.nl">{t("googleNetherlands")}</Select.Item>
                    <Select.Item id="bing.com">{t("bing")}</Select.Item>
                  </Select>

                  <Select
                    size="md"
                    label={t("refreshFrequency")}
                    selectedKey={refreshFrequency}
                    onSelectionChange={(key) => setRefreshFrequency(key as "daily" | "weekly" | "on_demand")}
                    isDisabled={isSubmitting}
                  >
                    <Select.Item id="daily">{t("daily")}</Select.Item>
                    <Select.Item id="weekly">{t("weekly")}</Select.Item>
                    <Select.Item id="on_demand">{t("onDemand")}</Select.Item>
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
                  {tc("cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  size="lg"
                  isDisabled={isSubmitting || !domain.trim() || !projectId || !location || !language}
                >
                  {isSubmitting ? t("adding") : t("addDomainSubmit")}
                </Button>
              </div>
            </form>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </AriaDialogTrigger>
  );
}
