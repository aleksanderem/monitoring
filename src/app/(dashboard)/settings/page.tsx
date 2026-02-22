"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  User01,
  Settings01,
  Bell01,
  Key01,
  Copy01,
  Trash01,
  Plus,
  Check,
  Image01,
  Upload01,
  Users01,
  Speedometer02,
  Shield01,
  CreditCard02,
  Lock01,
  LayersTwo01,
  LayersThree01,
  Zap,
  SearchRefraction,
  Link01,
  FileCheck02,
  BarChart01,
  Target04,
  Stars02,
  TrendUp01,
  Globe01,
  Monitor01,
} from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Badge } from "@/components/base/badges/badges";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LoadingState } from "@/components/shared/LoadingState";
import { RoleManagement } from "@/components/settings/RoleManagement";
import { SessionManagement } from "@/components/settings/SessionManagement";
import { FileTrigger } from "@/components/base/file-upload-trigger/file-upload-trigger";
import { Tabs, TabList, TabPanel } from "@/components/application/tabs/tabs";
import { useTheme } from "next-themes";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { SectionHeader } from "@/components/application/section-headers/section-headers";
import { SectionLabel } from "@/components/application/section-headers/section-label";
import * as RadioGroups from "@/components/base/radio-groups/radio-groups";

// ─── Styled native select ───────────────────────────────────────────

function NativeSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-secondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        <p className="mt-1 text-sm text-tertiary">{description}</p>
      </div>
      {children}
    </div>
  );
}

// ─── Profile section ────────────────────────────────────────────────

function ProfileSection() {
  const t = useTranslations("settings");
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateProfile = useMutation(api.users.updateProfile);

  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const displayName = name ?? currentUser?.name ?? "";
  const displayEmail = email ?? currentUser?.email ?? "";

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        name: displayName || undefined,
        email: displayEmail || undefined,
      });
      toast.success(t("profileUpdatedSuccess"));
    } catch {
      toast.error(t("profileUpdatedError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (currentUser === undefined) {
    return <LoadingState type="card" rows={2} />;
  }

  return (
    <Section
      title={t("profileTitle")}
      description={t("profileDescription")}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t("nameLabel")}
          size="sm"
          placeholder={t("namePlaceholder")}
          value={displayName}
          onChange={(v) => setName(v)}
        />
        <Input
          label={t("emailLabel")}
          size="sm"
          placeholder={t("emailPlaceholder")}
          value={displayEmail}
          onChange={(v) => setEmail(v)}
        />
      </div>

      {currentUser?.role && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-tertiary">{t("roleLabel")}:</span>
          <Badge size="sm" type="pill-color" color="brand">
            {currentUser.role}
          </Badge>
        </div>
      )}

      {currentUser?.joinedAt && (
        <p className="mt-2 text-sm text-tertiary">
          {t("joinedDate", { date: new Date(currentUser.joinedAt).toLocaleDateString() })}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          color="primary"
          size="sm"
          onClick={handleSave}
          isLoading={isSaving}
        >
          {t("saveChanges")}
        </Button>
      </div>
    </Section>
  );
}

// ─── Preferences section ────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "pl", label: "Polski" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

const TIMEZONE_OPTIONS = [
  { value: "Europe/Warsaw", label: "Europe/Warsaw (CET)" },
  { value: "Europe/London", label: "Europe/London (GMT)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET)" },
  { value: "America/New_York", label: "America/New York (EST)" },
  { value: "America/Chicago", label: "America/Chicago (CST)" },
  { value: "America/Denver", label: "America/Denver (MST)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (PST)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
  { value: "UTC", label: "UTC" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const TIME_FORMAT_OPTIONS = [
  { value: "12h", label: "12-hour (1:30 PM)" },
  { value: "24h", label: "24-hour (13:30)" },
];

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function PreferencesSection() {
  const t = useTranslations("settings");
  const preferences = useQuery(api.userSettings.getUserPreferences);
  const updatePreferences = useMutation(api.userSettings.updateUserPreferences);
  const { theme, setTheme } = useTheme();

  const [language, setLanguage] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [dateFormat, setDateFormat] = useState<string | null>(null);
  const [timeFormat, setTimeFormat] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentLanguage = language ?? preferences?.language ?? "en";
  const currentTimezone = timezone ?? preferences?.timezone ?? "UTC";
  const currentDateFormat = dateFormat ?? preferences?.dateFormat ?? "YYYY-MM-DD";
  const currentTimeFormat = timeFormat ?? preferences?.timeFormat ?? "24h";

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({
        language: currentLanguage,
        timezone: currentTimezone,
        dateFormat: currentDateFormat,
        timeFormat: currentTimeFormat,
      });
      toast.success(t("preferencesUpdatedSuccess"));
    } catch {
      toast.error(t("preferencesUpdatedError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (preferences === undefined) {
    return <LoadingState type="card" rows={2} />;
  }

  return (
    <Section
      title={t("preferencesTitle")}
      description={t("preferencesDescription")}
    >
      {/* Theme selector */}
      <div className="mb-6">
        <NativeSelect
          label={t("appearanceLabel")}
          value={theme ?? "system"}
          onChange={setTheme}
          options={THEME_OPTIONS}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NativeSelect
          label={t("languageLabel")}
          value={currentLanguage}
          onChange={setLanguage}
          options={LANGUAGE_OPTIONS}
        />
        <NativeSelect
          label={t("timezoneLabel")}
          value={currentTimezone}
          onChange={setTimezone}
          options={TIMEZONE_OPTIONS}
        />
        <NativeSelect
          label={t("dateFormatLabel")}
          value={currentDateFormat}
          onChange={setDateFormat}
          options={DATE_FORMAT_OPTIONS}
        />
        <NativeSelect
          label={t("timeFormatLabel")}
          value={currentTimeFormat}
          onChange={setTimeFormat}
          options={TIME_FORMAT_OPTIONS}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          color="primary"
          size="sm"
          onClick={handleSave}
          isLoading={isSaving}
        >
          {t("savePreferences")}
        </Button>
      </div>
    </Section>
  );
}

// ─── Notifications section ──────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  { value: "immediate", label: "Immediate" },
  { value: "daily", label: "Daily digest" },
  { value: "weekly", label: "Weekly digest" },
];

function NotificationsSection() {
  const t = useTranslations("settings");
  const prefs = useQuery(api.userSettings.getNotificationPreferences);
  const updateNotifications = useMutation(
    api.userSettings.updateNotificationPreferences,
  );

  const [dailyRankingReports, setDailyRankingReports] = useState<boolean | null>(null);
  const [positionAlerts, setPositionAlerts] = useState<boolean | null>(null);
  const [keywordOpportunities, setKeywordOpportunities] = useState<boolean | null>(null);
  const [teamInvitations, setTeamInvitations] = useState<boolean | null>(null);
  const [systemUpdates, setSystemUpdates] = useState<boolean | null>(null);
  const [frequency, setFrequency] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentDailyRankingReports = dailyRankingReports ?? prefs?.dailyRankingReports ?? true;
  const currentPositionAlerts = positionAlerts ?? prefs?.positionAlerts ?? true;
  const currentKeywordOpportunities = keywordOpportunities ?? prefs?.keywordOpportunities ?? true;
  const currentTeamInvitations = teamInvitations ?? prefs?.teamInvitations ?? true;
  const currentSystemUpdates = systemUpdates ?? prefs?.systemUpdates ?? true;
  const currentFrequency = frequency ?? prefs?.frequency ?? "immediate";

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateNotifications({
        dailyRankingReports: currentDailyRankingReports,
        positionAlerts: currentPositionAlerts,
        keywordOpportunities: currentKeywordOpportunities,
        teamInvitations: currentTeamInvitations,
        systemUpdates: currentSystemUpdates,
        frequency: currentFrequency,
      });
      toast.success(t("notificationsUpdatedSuccess"));
    } catch {
      toast.error(t("notificationsUpdatedError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (prefs === undefined) {
    return <LoadingState type="card" rows={3} />;
  }

  return (
    <Section
      title={t("notificationsTitle")}
      description={t("notificationsDescription")}
    >
      <div className="flex flex-col gap-4">
        <Toggle
          size="sm"
          label={t("dailyRankingReportsLabel")}
          hint={t("dailyRankingReportsHint")}
          isSelected={currentDailyRankingReports}
          onChange={setDailyRankingReports}
        />
        <Toggle
          size="sm"
          label={t("positionAlertsLabel")}
          hint={t("positionAlertsHint")}
          isSelected={currentPositionAlerts}
          onChange={setPositionAlerts}
        />
        <Toggle
          size="sm"
          label={t("keywordOpportunitiesLabel")}
          hint={t("keywordOpportunitiesHint")}
          isSelected={currentKeywordOpportunities}
          onChange={setKeywordOpportunities}
        />
        <Toggle
          size="sm"
          label={t("teamInvitationsLabel")}
          hint={t("teamInvitationsHint")}
          isSelected={currentTeamInvitations}
          onChange={setTeamInvitations}
        />
        <Toggle
          size="sm"
          label={t("systemUpdatesLabel")}
          hint={t("systemUpdatesHint")}
          isSelected={currentSystemUpdates}
          onChange={setSystemUpdates}
        />
      </div>

      <div className="mt-6 border-t border-secondary pt-6">
        <NativeSelect
          label={t("notificationFrequencyLabel")}
          value={currentFrequency}
          onChange={setFrequency}
          options={FREQUENCY_OPTIONS}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          color="primary"
          size="sm"
          onClick={handleSave}
          isLoading={isSaving}
        >
          {t("saveNotifications")}
        </Button>
      </div>
    </Section>
  );
}

// ─── API Keys section ───────────────────────────────────────────────

function APIKeysSection() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const apiKeys = useQuery(api.users.getAPIKeys);
  const generateKey = useMutation(api.users.generateAPIKey);
  const revokeKey = useMutation(api.users.revokeAPIKey);

  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(
    new Set(["read"]),
  );
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!newKeyName.trim()) {
      toast.error(t("apiKeyNameRequired"));
      return;
    }
    if (selectedScopes.size === 0) {
      toast.error(t("apiKeyScopeRequired"));
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateKey({
        name: newKeyName.trim(),
        scopes: Array.from(selectedScopes),
      });
      setGeneratedKey(result.key);
      setNewKeyName("");
      setSelectedScopes(new Set(["read"]));
      toast.success(t("apiKeyGeneratedSuccess"));
    } catch {
      toast.error(t("apiKeyGeneratedError"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (keyId: Id<"userAPIKeys">) => {
    try {
      await revokeKey({ keyId });
      toast.success(t("apiKeyRevokedSuccess"));
    } catch {
      toast.error(t("apiKeyRevokedError"));
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t("copiedToClipboard"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyToClipboardError"));
    }
  };

  if (apiKeys === undefined) {
    return <LoadingState type="table" rows={3} />;
  }

  return (
    <Section
      title={t("apiKeysTitle")}
      description={t("apiKeysDescription")}
    >
      {/* Generated key banner */}
      {generatedKey && (
        <div className="mb-6 rounded-lg border border-success-300 bg-success-50 p-4">
          <p className="mb-2 text-sm font-medium text-success-700">
            {t("apiKeyGeneratedBanner")}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-primary px-3 py-2 font-mono text-sm text-primary ring-1 ring-secondary ring-inset">
              {generatedKey}
            </code>
            <Button
              color="secondary"
              size="sm"
              iconLeading={copied ? Check : Copy01}
              onClick={() => handleCopy(generatedKey)}
            >
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>
          <button
            onClick={() => setGeneratedKey(null)}
            className="mt-2 text-sm text-success-700 underline"
          >
            {t("dismiss")}
          </button>
        </div>
      )}

      {/* Generate new key form */}
      <div className="mb-6 rounded-lg border border-secondary p-4">
        <h3 className="mb-3 text-sm font-medium text-primary">
          {t("generateNewApiKey")}
        </h3>
        <div className="flex flex-col gap-4">
          <Input
            label={t("keyNameLabel")}
            size="sm"
            placeholder={t("keyNamePlaceholder")}
            value={newKeyName}
            onChange={(v) => setNewKeyName(v)}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-secondary">{t("scopesLabel")}</span>
            <div className="flex flex-wrap gap-4">
              <Checkbox
                size="sm"
                label="Read"
                isSelected={selectedScopes.has("read")}
                onChange={() => toggleScope("read")}
              />
              <Checkbox
                size="sm"
                label="Write"
                isSelected={selectedScopes.has("write")}
                onChange={() => toggleScope("write")}
              />
              <Checkbox
                size="sm"
                label="Admin"
                isSelected={selectedScopes.has("admin")}
                onChange={() => toggleScope("admin")}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              color="primary"
              size="sm"
              iconLeading={Plus}
              onClick={handleGenerate}
              isLoading={isGenerating}
            >
              {t("generateKey")}
            </Button>
          </div>
        </div>
      </div>

      {/* Existing keys list */}
      {apiKeys.length === 0 ? (
        <p className="py-8 text-center text-sm text-tertiary">
          {t("noApiKeys")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-secondary">
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("apiKeyColumnName")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("apiKeyColumnKey")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("apiKeyColumnScopes")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("apiKeyColumnCreated")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">
                  {t("apiKeyColumnLastUsed")}
                </th>
                <th className="pb-3 font-medium text-tertiary" />
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr
                  key={key._id}
                  className="border-b border-secondary last:border-0"
                >
                  <td className="py-3 pr-4 font-medium text-primary">
                    {key.name}
                  </td>
                  <td className="py-3 pr-4">
                    <code className="rounded bg-secondary_alt px-2 py-0.5 font-mono text-xs text-tertiary">
                      {key.key}
                    </code>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope: string) => (
                        <Badge
                          key={scope}
                          size="sm"
                          type="pill-color"
                          color={
                            scope === "admin"
                              ? "error"
                              : scope === "write"
                                ? "warning"
                                : "gray"
                          }
                        >
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-tertiary">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-tertiary">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : t("never")}
                  </td>
                  <td className="py-3">
                    <Button
                      color="primary-destructive"
                      size="sm"
                      iconLeading={Trash01}
                      onClick={() =>
                        handleRevoke(key._id as Id<"userAPIKeys">)
                      }
                    >
                      {t("revoke")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ─── Branding section ────────────────────────────────────────────────

function BrandingSection() {
  const t = useTranslations("settings");
  const branding = useQuery(api.branding.getOrganizationBranding);
  const generateUploadUrl = useMutation(api.branding.generateLogoUploadUrl);
  const saveLogo = useMutation(api.branding.saveOrganizationLogo);
  const removeLogo = useMutation(api.branding.removeOrganizationLogo);

  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Client-side validation
    if (!file.type.startsWith("image/")) {
      toast.error(t("logoUploadError"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("logoUploadError"));
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
      toast.success(t("logoUploadedSuccess"));
    } catch {
      toast.error(t("logoUploadError"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await removeLogo();
      toast.success(t("logoRemovedSuccess"));
    } catch {
      toast.error(t("logoUploadError"));
    } finally {
      setIsRemoving(false);
    }
  };

  if (branding === undefined) {
    return <LoadingState type="card" rows={2} />;
  }

  const logoUrl = branding?.branding?.logoUrl;

  return (
    <Section
      title={t("brandingTitle")}
      description={t("brandingDescription")}
    >
      {/* Logo preview */}
      <div className="mb-6 flex items-center gap-6">
        <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-dashed border-secondary bg-secondary/30">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Company logo"
              className="max-h-16 max-w-36 object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Image01 className="h-6 w-6 text-quaternary" />
              <span className="text-xs text-quaternary">{t("noLogoUploaded")}</span>
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
              {t("uploadLogo")}
            </Button>
          </FileTrigger>

          {logoUrl && (
            <Button
              color="primary-destructive"
              size="sm"
              iconLeading={Trash01}
              onClick={handleRemove}
              isLoading={isRemoving}
            >
              {t("removeLogo")}
            </Button>
          )}

          <p className="text-xs text-quaternary">{t("logoRequirements")}</p>
        </div>
      </div>
    </Section>
  );
}

// ─── Members section ─────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

function MembersSection() {
  const t = useTranslations("settings");
  const orgs = useQuery(api.organizations.getUserOrganizations);
  const orgId = orgs?.[0]?._id;
  const members = useQuery(
    api.organizations.getOrganizationMembers,
    orgId ? { organizationId: orgId } : "skip",
  );
  const inviteMember = useMutation(api.organizations.inviteMember);
  const updateRole = useMutation(api.organizations.updateMemberRole);
  const removeMember = useMutation(api.organizations.removeMember);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [isInviting, setIsInviting] = useState(false);

  // Current user's role in org (to show/hide admin controls)
  const currentUserRole = orgs?.[0]?.role;
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgId) return;
    setIsInviting(true);
    try {
      await inviteMember({
        organizationId: orgId,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      toast.success(t("memberInvitedSuccess"));
      setInviteEmail("");
    } catch (e: any) {
      toast.error(e?.message || t("memberInvitedError"));
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (membershipId: Id<"organizationMembers">, role: string) => {
    try {
      await updateRole({
        membershipId,
        role: role as "admin" | "member" | "viewer",
      });
      toast.success(t("memberRoleUpdatedSuccess"));
    } catch {
      toast.error(t("memberRoleUpdatedError"));
    }
  };

  const handleRemove = async (membershipId: Id<"organizationMembers">) => {
    if (!confirm(t("confirmRemoveMember"))) return;
    try {
      await removeMember({ membershipId });
      toast.success(t("memberRemovedSuccess"));
    } catch {
      toast.error(t("memberRemovedError"));
    }
  };

  if (orgs === undefined || members === undefined) {
    return <LoadingState type="table" rows={3} />;
  }

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      owner: t("roleOwner"),
      admin: t("roleAdmin"),
      member: t("roleMember"),
      viewer: t("roleViewer"),
    };
    return map[role] || role;
  };

  return (
    <Section
      title={t("membersTitle")}
      description={t("membersDescription")}
    >
      {/* Invite form (admin/owner only) */}
      {isAdmin && (
        <div className="mb-6 rounded-lg border border-secondary p-4">
          <h3 className="mb-3 text-sm font-medium text-primary">
            {t("inviteMember")}
          </h3>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label={t("memberColumnEmail")}
                size="sm"
                placeholder={t("inviteEmailPlaceholder")}
                value={inviteEmail}
                onChange={(v) => setInviteEmail(v)}
              />
            </div>
            <div className="w-40">
              <NativeSelect
                label={t("inviteRoleLabel")}
                value={inviteRole}
                onChange={(v) => setInviteRole(v as "admin" | "member" | "viewer")}
                options={ROLE_OPTIONS}
              />
            </div>
            <Button
              color="primary"
              size="sm"
              iconLeading={Plus}
              onClick={handleInvite}
              isLoading={isInviting}
            >
              {t("inviteButton")}
            </Button>
          </div>
        </div>
      )}

      {/* Members list */}
      {!members || members.length === 0 ? (
        <p className="py-8 text-center text-sm text-tertiary">
          {t("noMembers")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-secondary">
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("memberColumnName")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("memberColumnEmail")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("memberColumnRole")}</th>
                <th className="pb-3 pr-4 font-medium text-tertiary">{t("memberColumnJoined")}</th>
                {isAdmin && (
                  <th className="pb-3 font-medium text-tertiary" />
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member._id}
                  className="border-b border-secondary last:border-0"
                >
                  <td className="py-3 pr-4 font-medium text-primary">
                    {member.user?.name || "—"}
                  </td>
                  <td className="py-3 pr-4 text-tertiary">
                    {member.user?.email || "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {isAdmin && member.role !== "owner" ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(
                            member._id as Id<"organizationMembers">,
                            e.target.value,
                          )
                        }
                        className="rounded-md border border-secondary bg-primary px-2 py-1 text-sm text-primary"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {roleLabel(opt.value)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge size="sm" type="pill-color" color={
                        member.role === "owner" ? "brand" :
                        member.role === "admin" ? "blue" :
                        member.role === "viewer" ? "gray" : "success"
                      }>
                        {roleLabel(member.role)}
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-tertiary">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  {isAdmin && (
                    <td className="py-3">
                      {member.role !== "owner" && (
                        <Button
                          color="primary-destructive"
                          size="sm"
                          iconLeading={Trash01}
                          onClick={() =>
                            handleRemove(member._id as Id<"organizationMembers">)
                          }
                        >
                          {t("removeMember")}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ─── Plan & Usage section ────────────────────────────────────────────

function UsageBar({ current, limit, label }: { current: number; limit: number | null; label: string }) {
  const t = useTranslations("settings");
  const isUnlimited = limit === null || limit === 0;
  const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);
  const isHigh = !isUnlimited && percentage >= 80;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-secondary">{label}</span>
        <span className="text-sm tabular-nums text-tertiary">
          {current} / {isUnlimited ? t("planUnlimited") : limit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${isHigh ? "bg-fg-warning-primary" : "bg-brand-solid"}`}
          style={{ width: isUnlimited ? "0%" : `${percentage}%` }}
        />
      </div>
    </div>
  );
}

const MODULES = [
  { key: "positioning", label: "Keyword Tracking", description: "Monitoruj pozycje słów kluczowych w Google i innych wyszukiwarkach.", icon: SearchRefraction },
  { key: "backlinks", label: "Backlinks", description: "Analizuj profil linków zwrotnych i odkrywaj nowe możliwości.", icon: Link01 },
  { key: "seo_audit", label: "SEO Audit", description: "Kompleksowy audyt techniczny Twojej strony.", icon: FileCheck02 },
  { key: "reports", label: "Raporty", description: "Generuj szczegółowe raporty SEO dla klientów i zespołu.", icon: BarChart01 },
  { key: "competitors", label: "Konkurencja", description: "Śledź i analizuj strategie SEO konkurencji.", icon: Target04 },
  { key: "ai_strategy", label: "AI Strategy", description: "Inteligentne rekomendacje SEO oparte na AI.", icon: Stars02 },
  { key: "forecasts", label: "Prognozy", description: "Prognozy pozycji i ruchu organicznego.", icon: TrendUp01 },
  { key: "link_building", label: "Link Building", description: "Znajdź i zarządzaj możliwościami budowania linków.", icon: Globe01 },
];

function PlanUsageSection() {
  const t = useTranslations("settings");
  const orgs = useQuery(api.organizations.getUserOrganizations);
  const firstOrg = orgs?.[0];
  const orgId = firstOrg?._id;
  const planId = firstOrg?.planId;

  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const createPortal = useAction(api.stripe.createBillingPortalSession);
  const createPaymentUpdate = useAction(api.stripe.createPaymentMethodUpdateSession);
  const fetchInvoices = useAction(api.stripe.getInvoices);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Array<{
    id: string;
    number: string | null;
    date: number;
    amount: number;
    currency: string;
    status: string | null;
    hostedUrl: string | null;
    pdfUrl: string | null;
  }> | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const subscriptionStatus = firstOrg?.subscriptionStatus;
  const subscriptionEnd = firstOrg?.subscriptionPeriodEnd;
  const isSubscribed = subscriptionStatus === "active" || subscriptionStatus === "trialing";

  async function handleUpgrade() {
    setUpgradeLoading(true);
    try {
      const url = await createCheckout({ billingCycle: "monthly" });
      window.location.href = url;
    } catch (err: any) {
      console.error("[stripe] checkout error:", err);
      const msg = err?.message || err?.data || "Unknown error";
      toast.error(`Checkout failed: ${msg}`);
      setUpgradeLoading(false);
    }
  }

  async function handleManage() {
    try {
      const url = await createPortal();
      window.location.href = url;
    } catch {
      toast.error("Nie udało się otworzyć portalu rozliczeniowego");
    }
  }

  async function handlePaymentUpdate() {
    try {
      const url = await createPaymentUpdate();
      window.location.href = url;
    } catch {
      // Fallback to general portal if flow_data not supported
      try {
        const url = await createPortal();
        window.location.href = url;
      } catch {
        toast.error("Nie udało się otworzyć aktualizacji płatności");
      }
    }
  }

  async function loadInvoices() {
    if (invoicesLoading || invoices !== null) return;
    setInvoicesLoading(true);
    try {
      const data = await fetchInvoices();
      setInvoices(data);
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }

  const plan = useQuery(api.plans.getPlan, planId ? { planId } : "skip");
  const defaultPlan = useQuery(api.plans.getDefaultPlan, planId ? "skip" : {});
  const usage = useQuery(api.limits.getUsageStats, orgId ? { organizationId: orgId } : "skip");

  if (
    orgs === undefined ||
    (planId && plan === undefined) ||
    (!planId && defaultPlan === undefined) ||
    (orgId && usage === undefined)
  ) {
    return <LoadingState type="card" rows={3} />;
  }

  const effectivePlan = plan ?? defaultPlan;
  const planKey = effectivePlan?.key ?? "free";
  const isTrialing = subscriptionStatus === "trialing";
  const daysLeft = subscriptionEnd
    ? Math.max(0, Math.ceil((subscriptionEnd * 1000 - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const planModules = (effectivePlan?.modules as string[]) ?? [];
  const planLimits = effectivePlan?.limits as Record<string, number | undefined> | undefined;
  const currentSelection = selectedPlan ?? planKey;
  const hasChangedPlan = currentSelection !== planKey;

  // Build subscription detail string for the current plan card
  const subscriptionDetail = (() => {
    if (!isSubscribed) return "";
    const parts: string[] = [];
    if (isTrialing && daysLeft !== null) {
      parts.push(`Trial: ${daysLeft} ${daysLeft === 1 ? "dzień" : "dni"} pozostało`);
    }
    if (!isTrialing && daysLeft !== null) {
      parts.push(`Odnowienie za ${daysLeft} ${daysLeft === 1 ? "dzień" : "dni"}`);
    }
    if (firstOrg?.billingCycle) {
      parts.push(firstOrg.billingCycle === "yearly" ? "Roczny" : "Miesięczny");
    }
    return parts.join(" · ");
  })();

  const planCards = [
    {
      value: "free",
      title: "Free",
      secondaryTitle: planKey === "free" && !isSubscribed ? "Aktualny plan" : "$0/mies.",
      description: "Monitoring do 50 słów kluczowych i 3 domen.",
      icon: LayersTwo01,
      disabled: isSubscribed,
    },
    {
      value: "pro",
      title: "Pro",
      secondaryTitle: planKey === "pro" && isSubscribed
        ? `Aktualny plan${isTrialing ? " (Trial)" : ""}`
        : "$29/mies.",
      description: planKey === "pro" && isSubscribed && subscriptionDetail
        ? subscriptionDetail
        : "Pełen zestaw narzędzi SEO, 500 słów kluczowych, 20 domen.",
      icon: LayersThree01,
      disabled: isSubscribed && planKey === "pro",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Section header */}
      <SectionHeader.Root>
        <SectionHeader.Group>
          <div className="flex flex-1 flex-col justify-center gap-0.5 self-stretch">
            <SectionHeader.Heading>{t("planTitle")}</SectionHeader.Heading>
            <SectionHeader.Subheading>{t("planDescription")}</SectionHeader.Subheading>
          </div>
        </SectionHeader.Group>
      </SectionHeader.Root>

      {/* Subscription status summary */}
      {isSubscribed && (
        <div className={`rounded-lg border p-4 ${
          subscriptionStatus === "trialing"
            ? "border-brand-200 bg-brand-25 dark:bg-brand-25/10"
            : "border-fg-success-primary/20 bg-utility-green-50 dark:bg-utility-green-50/10"
        }`}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Badge
                size="sm"
                type="pill-color"
                color={subscriptionStatus === "trialing" ? "brand" : "success"}
              >
                {subscriptionStatus === "trialing" ? "Trial" : "Aktywna"}
              </Badge>
              <span className="text-sm font-medium text-primary">
                Plan {effectivePlan?.name ?? "Pro"}
              </span>
            </div>
            {subscriptionEnd && daysLeft !== null && (
              <>
                {isTrialing && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-tertiary">Trial kończy się za:</span>
                    <span className={`font-semibold tabular-nums ${daysLeft <= 2 ? "text-fg-error-primary" : "text-brand-700 dark:text-brand-300"}`}>
                      {daysLeft} {daysLeft === 1 ? "dzień" : "dni"}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-tertiary">
                    {isTrialing ? "Pierwszy billing:" : "Odnowienie:"}
                  </span>
                  <span className="font-medium text-primary">
                    {new Date(subscriptionEnd * 1000).toLocaleDateString("pl-PL")}
                  </span>
                  {!isTrialing && (
                    <span className="text-tertiary">
                      (za {daysLeft} {daysLeft === 1 ? "dzień" : "dni"})
                    </span>
                  )}
                </div>
                {firstOrg?.billingCycle && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-tertiary">Cykl:</span>
                    <span className="font-medium text-primary">
                      {firstOrg.billingCycle === "yearly" ? "Roczny" : "Miesięczny"}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Past due warning */}
      {subscriptionStatus === "past_due" && !firstOrg?.degraded && (
        <div className="rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm font-medium text-fg-warning-primary dark:bg-warning-50/10">
          Płatność zaległa. Zaktualizuj metodę płatności, aby uniknąć przerwy w usłudze.
        </div>
      )}

      {/* Degraded (read-only) warning */}
      {firstOrg?.degraded && (
        <div className="rounded-lg border border-error-300 bg-error-50 p-4 dark:bg-error-50/10">
          <p className="text-sm font-semibold text-fg-error-primary">Konto w trybie tylko do odczytu</p>
          <p className="mt-1 text-sm text-fg-error-secondary">
            Okres karencji minął. Zaktualizuj metodę płatności, aby przywrócić pełny dostęp.
          </p>
          <div className="mt-3">
            <Button color="error" size="sm" onClick={handlePaymentUpdate}>
              Zaktualizuj metodę płatności
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* Plan selection */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_1fr] lg:gap-8">
          <SectionLabel.Root
            size="sm"
            title="Aktualny plan"
            description="Wybierz plan dopasowany do Twoich potrzeb."
          />
          <div className="flex flex-col gap-3">
            {/* Gradient border on selected card — static version of the GlowingEffect */}
            <div className="plan-radio-cards">
              <style>{`
                .plan-radio-cards [data-selected] {
                  --tw-ring-shadow: none !important;
                  --tw-ring-color: transparent !important;
                  position: relative;
                  overflow: hidden;
                }
                .plan-radio-cards [data-selected]::before {
                  content: '';
                  position: absolute;
                  inset: 0;
                  border-radius: inherit;
                  border: 1px solid transparent;
                  background: conic-gradient(from 0deg, #dd7bbb, #d79f1e, #5a922c, #4c7894, #dd7bbb) border-box;
                  -webkit-mask:
                    linear-gradient(#fff 0 0) padding-box,
                    linear-gradient(#fff 0 0);
                  -webkit-mask-composite: xor;
                  mask:
                    linear-gradient(#fff 0 0) padding-box,
                    linear-gradient(#fff 0 0);
                  mask-composite: exclude;
                  pointer-events: none;
                }
              `}</style>
              <RadioGroups.IconSimple
                aria-label="Wybierz plan"
                value={currentSelection}
                onChange={setSelectedPlan}
                items={planCards}
              />
            </div>
            {/* Action buttons based on selection */}
            <div className="flex items-center gap-3">
              {hasChangedPlan && currentSelection === "pro" && !isSubscribed && (
                <Button
                  color="primary"
                  size="sm"
                  iconLeading={Zap}
                  onClick={handleUpgrade}
                  isLoading={upgradeLoading}
                >
                  Upgrade do Pro — $29/mies.
                </Button>
              )}
              {isSubscribed && (
                <Button color="secondary" size="sm" onClick={handleManage}>
                  Zarządzaj subskrypcją
                </Button>
              )}
              {!isSubscribed && !hasChangedPlan && (
                <a href="/pricing" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  Zobacz pełne porównanie planów →
                </a>
              )}
            </div>
          </div>
        </div>

        <hr className="h-px w-full border-none bg-border-secondary" />

        {/* Usage stats */}
        {usage && (
          <>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_1fr] lg:gap-8">
              <SectionLabel.Root
                size="sm"
                title="Użycie zasobów"
                description="Aktualne wykorzystanie limitów Twojego planu."
              />
              <div className="flex flex-col gap-4">
                <UsageBar
                  label={t("planKeywordsUsage")}
                  current={usage.keywords.current}
                  limit={usage.keywords.limit ?? planLimits?.maxKeywords ?? null}
                />
                <UsageBar
                  label={t("planDomainsUsage")}
                  current={usage.domains.current}
                  limit={usage.domains.limit ?? planLimits?.maxDomains ?? null}
                />
                <UsageBar
                  label={t("planProjectsUsage")}
                  current={usage.projects.current}
                  limit={usage.projects.limit ?? planLimits?.maxProjects ?? null}
                />
              </div>
            </div>

            <hr className="h-px w-full border-none bg-border-secondary" />
          </>
        )}

        {/* Modules as cards */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_1fr] lg:gap-8">
          <SectionLabel.Root
            size="sm"
            title="Dostępne moduły"
            description="Moduły włączone w Twoim planie."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MODULES.map((mod) => {
              const active = planModules.includes(mod.key);
              return (
                <div
                  key={mod.key}
                  className={`flex items-start gap-3 rounded-xl p-4 ring-1 ring-inset ${
                    active
                      ? "bg-primary ring-secondary"
                      : "bg-disabled_subtle ring-disabled"
                  }`}
                >
                  <FeaturedIcon
                    icon={mod.icon}
                    size="sm"
                    color={active ? "brand" : "gray"}
                    theme="modern"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className={`text-sm font-medium ${active ? "text-secondary" : "text-disabled"}`}>
                      {mod.label}
                    </span>
                    <span className={`text-sm ${active ? "text-tertiary" : "text-disabled"}`}>
                      {mod.description}
                    </span>
                    {!active && (
                      <span className="mt-1 inline-flex w-fit items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-quaternary">
                        Dostępne w Pro
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Per-resource limits */}
        {(usage?.defaults || planLimits) && (
          <>
            <hr className="h-px w-full border-none bg-border-secondary" />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_1fr] lg:gap-8">
              <SectionLabel.Root
                size="sm"
                title="Limity szczegółowe"
                description="Limity na poziomie projektu i domeny."
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-secondary p-3">
                  <p className="text-xs text-tertiary">{t("planDomainsPerProject")}</p>
                  <p className="text-lg font-semibold text-primary tabular-nums">
                    {usage?.defaults?.maxDomainsPerProject ?? planLimits?.maxDomainsPerProject ?? t("planUnlimited")}
                  </p>
                </div>
                <div className="rounded-lg border border-secondary p-3">
                  <p className="text-xs text-tertiary">{t("planKeywordsPerDomain")}</p>
                  <p className="text-lg font-semibold text-primary tabular-nums">
                    {usage?.defaults?.maxKeywordsPerDomain ?? planLimits?.maxKeywordsPerDomain ?? t("planUnlimited")}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <hr className="h-px w-full border-none bg-border-secondary" />

        {/* Payment details */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_1fr] lg:gap-8">
          <SectionLabel.Root
            size="sm"
            title="Metoda płatności"
            description="Zarządzaj kartą i danymi rozliczeniowymi."
          />
          <div className="flex flex-col gap-3">
            {isSubscribed ? (
              <div className="flex items-center justify-between rounded-xl p-4 ring-1 ring-inset ring-secondary">
                <div className="flex items-center gap-3">
                  <FeaturedIcon icon={CreditCard02} size="sm" color="gray" theme="modern" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-secondary">Karta płatnicza</span>
                    <span className="text-sm text-tertiary">Zarządzana przez Stripe</span>
                  </div>
                </div>
                <Button color="link-gray" size="sm" onClick={handlePaymentUpdate}>
                  Zmień
                </Button>
              </div>
            ) : (
              <p className="text-sm text-tertiary">
                Metoda płatności zostanie dodana przy wyborze planu Pro.
              </p>
            )}
          </div>
        </div>

        <hr className="h-px w-full border-none bg-border-secondary" />

        {/* Billing history */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_1fr] lg:gap-8">
          <SectionLabel.Root
            size="sm"
            title="Historia rozliczeń"
            description="Faktury i historia płatności."
          />
          <div className="flex flex-col gap-3">
            {isSubscribed || subscriptionStatus === "canceled" ? (
              <>
                {invoices === null && !invoicesLoading && (
                  <div>
                    <Button color="secondary" size="sm" onClick={loadInvoices}>
                      Załaduj faktury
                    </Button>
                  </div>
                )}
                {invoicesLoading && (
                  <p className="text-sm text-tertiary">Ładowanie faktur...</p>
                )}
                {invoices !== null && invoices.length === 0 && (
                  <p className="text-sm text-tertiary">Brak faktur.</p>
                )}
                {invoices !== null && invoices.length > 0 && (
                  <div className="overflow-hidden rounded-xl ring-1 ring-inset ring-secondary">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-secondary bg-secondary">
                          <th className="px-4 py-2.5 font-medium text-secondary">Numer</th>
                          <th className="px-4 py-2.5 font-medium text-secondary">Data</th>
                          <th className="px-4 py-2.5 font-medium text-secondary">Kwota</th>
                          <th className="px-4 py-2.5 font-medium text-secondary">Status</th>
                          <th className="px-4 py-2.5 font-medium text-secondary"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr key={inv.id} className="border-b border-secondary last:border-0">
                            <td className="px-4 py-2.5 text-primary">{inv.number ?? "—"}</td>
                            <td className="px-4 py-2.5 text-tertiary">
                              {new Date(inv.date * 1000).toLocaleDateString("pl-PL")}
                            </td>
                            <td className="px-4 py-2.5 text-primary tabular-nums">
                              {(inv.amount / 100).toFixed(2)} {inv.currency.toUpperCase()}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                size="sm"
                                type="pill-color"
                                color={inv.status === "paid" ? "success" : inv.status === "open" ? "warning" : "gray"}
                              >
                                {inv.status === "paid" ? "Opłacona" : inv.status === "open" ? "Otwarta" : inv.status ?? "—"}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {inv.hostedUrl && (
                                <a
                                  href={inv.hostedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                                >
                                  Zobacz
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-tertiary">
                Brak historii rozliczeń. Faktury pojawią się po aktywacji subskrypcji.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Limits section ─────────────────────────────────────────────────

function LimitsSection() {
  const t = useTranslations("settings");
  const limits = useQuery(api.limits.getOrgRefreshLimits);
  const updateLimits = useMutation(api.limits.updateOrganizationLimits);

  const [refreshCooldownMinutes, setRefreshCooldownMinutes] = useState<number | null>(null);
  const [maxDailyRefreshes, setMaxDailyRefreshes] = useState<number | null>(null);
  const [maxDailyRefreshesPerUser, setMaxDailyRefreshesPerUser] = useState<number | null>(null);
  const [maxKeywordsPerBulkRefresh, setMaxKeywordsPerBulkRefresh] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentCooldown = refreshCooldownMinutes ?? limits?.refreshCooldownMinutes ?? 0;
  const currentOrgDaily = maxDailyRefreshes ?? limits?.maxDailyRefreshes ?? 0;
  const currentUserDaily = maxDailyRefreshesPerUser ?? limits?.maxDailyRefreshesPerUser ?? 0;
  const currentBulkCap = maxKeywordsPerBulkRefresh ?? limits?.maxKeywordsPerBulkRefresh ?? 0;

  const handleSave = async () => {
    if (!limits?.organizationId) return;
    setIsSaving(true);
    try {
      await updateLimits({
        organizationId: limits.organizationId,
        limits: {
          refreshCooldownMinutes: currentCooldown,
          maxDailyRefreshes: currentOrgDaily,
          maxDailyRefreshesPerUser: currentUserDaily,
          maxKeywordsPerBulkRefresh: currentBulkCap,
        },
      });
      toast.success(t("limitsUpdated"));
    } catch {
      toast.error(t("limitsUpdateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  if (limits === undefined) {
    return <LoadingState type="card" rows={2} />;
  }

  if (limits === null) {
    return null;
  }

  const fields = [
    {
      label: t("refreshCooldownLabel"),
      hint: t("refreshCooldownHint"),
      value: currentCooldown,
      onChange: setRefreshCooldownMinutes,
    },
    {
      label: t("maxDailyRefreshesLabel"),
      hint: t("maxDailyRefreshesHint"),
      value: currentOrgDaily,
      onChange: setMaxDailyRefreshes,
    },
    {
      label: t("maxDailyRefreshesPerUserLabel"),
      hint: t("maxDailyRefreshesPerUserHint"),
      value: currentUserDaily,
      onChange: setMaxDailyRefreshesPerUser,
    },
    {
      label: t("maxKeywordsPerBulkRefreshLabel"),
      hint: t("maxKeywordsPerBulkRefreshHint"),
      value: currentBulkCap,
      onChange: setMaxKeywordsPerBulkRefresh,
    },
  ];

  return (
    <Section title={t("limitsTitle")} description={t("limitsDescription")}>
      <div className="flex flex-col gap-4">
        {fields.map((field) => (
          <div key={field.label} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-secondary">
              {field.label}
            </label>
            <input
              type="number"
              min={0}
              value={field.value}
              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
              className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-solid"
            />
            <p className="text-xs text-tertiary">{field.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          color="primary"
          size="sm"
          onClick={handleSave}
          isLoading={isSaving}
        >
          {t("limitsSave")}
        </Button>
      </div>
    </Section>
  );
}

// ─── Security section ────────────────────────────────────────────────

type SecurityStep = "idle" | "sending" | "code" | "resetting";

function SecuritySection() {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const { signIn } = useAuthActions();
  const currentUser = useQuery(api.auth.getCurrentUser);

  const [securityStep, setSecurityStep] = useState<SecurityStep>("idle");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendCode = useCallback(async () => {
    if (!currentUser?.email) return;
    setSecurityStep("sending");
    try {
      await signIn("password", { email: currentUser.email, flow: "reset" });
      setSecurityStep("code");
      setCooldown(60);
      toast.success(tAuth("codeSent", { email: currentUser.email }));
    } catch (err) {
      console.error("[security] sendCode error:", err);
      toast.error(tAuth("invalidCredentials"));
      setSecurityStep("idle");
    }
  }, [signIn, currentUser?.email, tAuth]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || !currentUser?.email) return;
    try {
      await signIn("password", { email: currentUser.email, flow: "reset" });
      setCooldown(60);
      toast.success(tAuth("codeSent", { email: currentUser.email }));
    } catch (err) {
      console.error("[security] resend error:", err);
      toast.error(tAuth("invalidCredentials"));
    }
  }, [signIn, currentUser?.email, cooldown, tAuth]);

  const handleResetPassword = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!currentUser?.email) return;
      const formData = new FormData(e.currentTarget);
      const code = formData.get("code") as string;
      const newPassword = formData.get("newPassword") as string;
      const confirmPassword = formData.get("confirmPassword") as string;

      if (newPassword !== confirmPassword) {
        toast.error(tAuth("passwordsDoNotMatch"));
        return;
      }

      setSecurityStep("resetting");
      try {
        await signIn("password", {
          email: currentUser.email,
          code,
          newPassword,
          flow: "reset-verification",
        });
        toast.success(t("passwordChanged"));
        setSecurityStep("idle");
      } catch (err) {
        console.error("[security] resetPassword error:", err);
        toast.error(tAuth("invalidCode"));
        setSecurityStep("code");
      }
    },
    [signIn, currentUser?.email, t, tAuth]
  );

  return (
    <Section title={t("securityTitle")} description={t("securityDescription")}>
      {securityStep === "idle" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-tertiary">{t("changePasswordDescription")}</p>
          <div>
            <Button
              color="primary"
              size="sm"
              onClick={handleSendCode}
            >
              {t("changePassword")}
            </Button>
          </div>
        </div>
      )}

      {securityStep === "sending" && (
        <div className="flex items-center gap-2 text-sm text-tertiary">
          <span>{tAuth("sendingCode")}</span>
        </div>
      )}

      {(securityStep === "code" || securityStep === "resetting") && (
        <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
          <Input
            isRequired
            hideRequiredIndicator
            label={tAuth("resetCode")}
            type="text"
            name="code"
            placeholder={tAuth("enterResetCode")}
            size="md"
            isDisabled={securityStep === "resetting"}
            autoComplete="one-time-code"
          />
          <Input
            isRequired
            hideRequiredIndicator
            label={tAuth("newPassword")}
            type="password"
            name="newPassword"
            placeholder="••••••••"
            size="md"
            isDisabled={securityStep === "resetting"}
          />
          <Input
            isRequired
            hideRequiredIndicator
            label={tAuth("confirmPassword")}
            type="password"
            name="confirmPassword"
            placeholder="••••••••"
            size="md"
            isDisabled={securityStep === "resetting"}
          />
          <p className="text-xs text-tertiary">{tAuth("passwordRequirements")}</p>
          <div className="flex items-center gap-4">
            <Button
              type="submit"
              color="primary"
              size="sm"
              isLoading={securityStep === "resetting"}
            >
              {t("changePassword")}
            </Button>
            <Button
              type="button"
              color="tertiary"
              size="sm"
              onClick={() => setSecurityStep("idle")}
              isDisabled={securityStep === "resetting"}
            >
              {t("cancelRole")}
            </Button>
          </div>
          <div>
            {cooldown > 0 ? (
              <span className="text-xs text-tertiary">
                {tAuth("resendIn", { seconds: cooldown.toString() })}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-xs text-brand-600 hover:text-brand-500"
              >
                {tAuth("resendCode")}
              </button>
            )}
          </div>
        </form>
      )}
    </Section>
  );
}

// ─── Main page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTranslations("settings");
  usePageTitle("Settings");

  const tabs = [
    { id: "profile", label: t("tabProfile"), icon: User01 },
    { id: "plan", label: t("tabPlan"), icon: CreditCard02 },
    { id: "preferences", label: t("tabPreferences"), icon: Settings01 },
    { id: "notifications", label: t("tabNotifications"), icon: Bell01 },
    { id: "api-keys", label: t("tabApiKeys"), icon: Key01 },
    { id: "branding", label: t("tabBranding"), icon: Image01 },
    { id: "members", label: t("tabMembers"), icon: Users01 },
    { id: "roles", label: t("tabRoles"), icon: Shield01 },
    { id: "limits", label: t("tabLimits"), icon: Speedometer02 },
    { id: "sessions", label: t("tabSessions"), icon: Monitor01 },
    { id: "security", label: t("tabSecurity"), icon: Lock01 },
  ];

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-8 px-4 py-8 lg:px-8">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-primary lg:text-display-xs">
          {t("title")}
        </h1>
        <p className="text-md text-tertiary">
          {t("description")}
        </p>
      </div>

      {/* Tabbed content */}
      <Tabs orientation="vertical" defaultSelectedKey="profile">
        {/* Mobile horizontal navigation */}
        <TabList
          size="sm"
          type="underline"
          items={tabs}
          className="lg:hidden"
        />

        <div className="relative w-full rounded-xl border border-secondary bg-primary">
          <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} disabled={false} />
          <div className="grid w-full lg:grid-cols-[13rem_1fr]">
            {/* Desktop sidebar navigation */}
            <div className="hidden border-r border-secondary p-4 lg:block">
              <TabList
                size="sm"
                type="line"
                items={tabs}
                className="w-full items-start"
              />
            </div>

            <div className="min-w-0">
              <TabPanel id="profile" className="w-full">
                <ProfileSection />
              </TabPanel>

              <TabPanel id="plan" className="w-full">
                <PlanUsageSection />
              </TabPanel>

              <TabPanel id="preferences" className="w-full">
                <PreferencesSection />
              </TabPanel>

              <TabPanel id="notifications" className="w-full">
                <NotificationsSection />
              </TabPanel>

              <TabPanel id="api-keys" className="w-full">
                <APIKeysSection />
              </TabPanel>

              <TabPanel id="branding" className="w-full">
                <BrandingSection />
              </TabPanel>

              <TabPanel id="members" className="w-full">
                <MembersSection />
              </TabPanel>

              <TabPanel id="roles" className="w-full">
                <RoleManagement />
              </TabPanel>

              <TabPanel id="limits" className="w-full">
                <LimitsSection />
              </TabPanel>

              <TabPanel id="sessions" className="w-full">
                <SessionManagement />
              </TabPanel>

              <TabPanel id="security" className="w-full">
                <SecuritySection />
              </TabPanel>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
