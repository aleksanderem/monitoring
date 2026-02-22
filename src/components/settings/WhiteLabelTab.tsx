"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { LoadingState } from "@/components/shared/LoadingState";
import { FileTrigger } from "@/components/base/file-upload-trigger/file-upload-trigger";
import { Upload01, Trash01, Image01 } from "@untitledui/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface WhiteLabelTabProps {
  organizationId: Id<"organizations">;
}

export function WhiteLabelTab({ organizationId }: WhiteLabelTabProps) {
  const t = useTranslations("agency");
  const tSettings = useTranslations("settings");
  const branding = useQuery(api.agency.getClientBranding, { orgId: organizationId });
  const updateBranding = useMutation(api.agency.updateBrandingOverrides);
  const orgBranding = useQuery(api.branding.getOrganizationBranding);
  const generateUploadUrl = useMutation(api.branding.generateLogoUploadUrl);
  const saveLogo = useMutation(api.branding.saveOrganizationLogo);
  const removeLogo = useMutation(api.branding.removeOrganizationLogo);

  const [logoUrl, setLogoUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [primaryColor, setPrimaryColor] = useState<string>("");
  const [accentColor, setAccentColor] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [footerText, setFooterText] = useState<string>("");
  const [customDomain, setCustomDomain] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form from loaded branding data
  if (branding && !initialized) {
    setLogoUrl(branding.logoUrl ?? "");
    setPrimaryColor(branding.primaryColor ?? "#3B82F6");
    setAccentColor(branding.accentColor ?? "#8B5CF6");
    setCompanyName(branding.companyName ?? "");
    setFooterText(branding.footerText ?? "");
    setCustomDomain(branding.customDomain ?? "");
    setInitialized(true);
  }

  if (branding === undefined) {
    return <LoadingState type="card" rows={3} />;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateBranding({
        orgId: organizationId,
        logoUrl: logoUrl || undefined,
        primaryColor: primaryColor || undefined,
        accentColor: accentColor || undefined,
        companyName: companyName || undefined,
        footerText: footerText || undefined,
        customDomain: customDomain || undefined,
      });
      toast.success(t("saveChanges"));
    } catch {
      toast.error("Failed to save branding");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.type.startsWith("image/")) {
      toast.error(tSettings("logoUploadError"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(tSettings("logoUploadError"));
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await response.json();
      await saveLogo({ storageId });
      toast.success(tSettings("logoUploadedSuccess"));
    } catch {
      toast.error(tSettings("logoUploadError"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setIsRemoving(true);
    try {
      await removeLogo();
      toast.success(tSettings("logoRemovedSuccess"));
    } catch {
      toast.error(tSettings("logoUploadError"));
    } finally {
      setIsRemoving(false);
    }
  };

  const handleReset = () => {
    setLogoUrl("");
    setPrimaryColor("#3B82F6");
    setAccentColor("#8B5CF6");
    setCompanyName("");
    setFooterText("");
    setCustomDomain("");
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-primary">{t("branding")}</h2>
        <p className="mt-1 text-sm text-tertiary">{t("brandingDescription")}</p>
      </div>

      <div className="space-y-6">
        {/* Logo upload */}
        <div>
          <label className="text-sm font-medium text-secondary">{tSettings("brandingTitle")}</label>
          <div className="mt-2 flex items-center gap-6">
            <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-dashed border-secondary bg-secondary/30">
              {orgBranding?.branding?.logoUrl ? (
                <img
                  src={orgBranding.branding.logoUrl}
                  alt="Company logo"
                  className="max-h-16 max-w-36 object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Image01 className="h-6 w-6 text-quaternary" />
                  <span className="text-xs text-quaternary">{tSettings("noLogoUploaded")}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <FileTrigger
                acceptedFileTypes={["image/png", "image/jpeg", "image/svg+xml"]}
                onSelect={handleFileSelect}
              >
                <Button
                  color="secondary"
                  size="sm"
                  iconLeading={Upload01}
                  isLoading={isUploading}
                >
                  {tSettings("uploadLogo")}
                </Button>
              </FileTrigger>

              {orgBranding?.branding?.logoUrl && (
                <Button
                  color="primary-destructive"
                  size="sm"
                  iconLeading={Trash01}
                  onClick={handleRemoveLogo}
                  isLoading={isRemoving}
                >
                  {tSettings("removeLogo")}
                </Button>
              )}

              <p className="text-xs text-quaternary">{tSettings("logoRequirements")}</p>
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-secondary">{t("primaryColor")}</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={primaryColor || "#3B82F6"}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-secondary"
              />
              <Input
                label=""
                size="sm"
                placeholder="#3B82F6"
                value={primaryColor}
                onChange={(v) => setPrimaryColor(v)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-secondary">{t("accentColor")}</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={accentColor || "#8B5CF6"}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-secondary"
              />
              <Input
                label=""
                size="sm"
                placeholder="#8B5CF6"
                value={accentColor}
                onChange={(v) => setAccentColor(v)}
              />
            </div>
          </div>
        </div>

        {/* Company name */}
        <Input
          label={t("companyName")}
          size="sm"
          placeholder="Your Agency Name"
          value={companyName}
          onChange={(v) => setCompanyName(v)}
        />

        {/* Custom domain */}
        <Input
          label={t("customDomain")}
          size="sm"
          placeholder="seo.youragency.com"
          value={customDomain}
          onChange={(v) => setCustomDomain(v)}
        />

        {/* Footer text */}
        <Input
          label={t("footerText")}
          size="sm"
          placeholder="Powered by Your Agency"
          value={footerText}
          onChange={(v) => setFooterText(v)}
        />

        {/* Preview */}
        <div>
          <h3 className="text-sm font-medium text-secondary">{t("brandingPreview")}</h3>
          <div
            className="mt-2 rounded-lg border border-secondary p-4"
            style={{ borderTopColor: primaryColor || "#3B82F6", borderTopWidth: 4 }}
          >
            <div className="flex items-center gap-3">
              {(orgBranding?.branding?.logoUrl || logoUrl) && (
                <img src={orgBranding?.branding?.logoUrl || logoUrl} alt="Logo" className="h-8 w-8 rounded object-contain" />
              )}
              <span className="font-semibold text-primary">
                {companyName || "Your Agency"}
              </span>
            </div>
            <p className="mt-2 text-xs text-tertiary">
              {footerText || "Powered by Your Agency"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button color="secondary" size="sm" onClick={handleReset}>
            {t("resetDefaults")}
          </Button>
          <Button color="primary" size="sm" onClick={handleSave} isLoading={isSaving}>
            {t("saveChanges")}
          </Button>
        </div>
      </div>
    </div>
  );
}
