"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
} from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Badge } from "@/components/base/badges/badges";
import { LoadingState } from "@/components/shared/LoadingState";
import { Tabs, TabList, TabPanel } from "@/components/application/tabs/tabs";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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
    <div className="rounded-xl border border-secondary bg-primary p-6">
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

// ─── Main page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTranslations("settings");

  const tabs = [
    { id: "profile", label: t("tabProfile"), icon: User01 },
    { id: "preferences", label: t("tabPreferences"), icon: Settings01 },
    { id: "notifications", label: t("tabNotifications"), icon: Bell01 },
    { id: "api-keys", label: t("tabApiKeys"), icon: Key01 },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 lg:px-8">
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
        <div className="flex w-full gap-8 lg:gap-16">
          {/* Desktop sidebar navigation */}
          <TabList
            size="sm"
            type="line"
            items={tabs}
            className="w-auto items-start max-lg:hidden"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {/* Mobile horizontal navigation */}
            <TabList
              size="sm"
              type="line"
              items={tabs}
              className="lg:hidden"
            />

            <TabPanel id="profile">
              <ProfileSection />
            </TabPanel>

            <TabPanel id="preferences">
              <PreferencesSection />
            </TabPanel>

            <TabPanel id="notifications">
              <NotificationsSection />
            </TabPanel>

            <TabPanel id="api-keys">
              <APIKeysSection />
            </TabPanel>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
