"use client";

import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// ─── Types ──────────────────────────────────────────────────────────

interface IntegrationsPanelProps {
  webhookUrl?: string;
}

// ─── Main Component ─────────────────────────────────────────────────

export default function IntegrationsPanel({
  webhookUrl,
}: IntegrationsPanelProps) {
  const t = useTranslations("webhooks");

  const [slackUrl, setSlackUrl] = useState("");
  const [slackConnected, setSlackConnected] = useState(false);

  const handleConnectSlack = () => {
    if (!slackUrl.trim()) {
      toast.error(t("slackUrlRequired"));
      return;
    }
    setSlackConnected(true);
    toast.success(t("slackConnected"));
  };

  const handleDisconnectSlack = () => {
    setSlackConnected(false);
    setSlackUrl("");
    toast.success(t("slackDisconnected"));
  };

  const zapierWebhookUrl =
    webhookUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/zapier`;

  const handleCopyZapierUrl = () => {
    navigator.clipboard.writeText(zapierWebhookUrl);
    toast.success(t("copiedToClipboard"));
  };

  return (
    <div data-testid="integrations-panel">
      <h2 className="mb-1 text-lg font-semibold text-primary">
        {t("integrations")}
      </h2>
      <p className="mb-4 text-sm text-tertiary">
        {t("integrationsDescription")}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Slack Integration */}
        <div
          className="rounded-lg border border-secondary p-5"
          data-testid="slack-integration"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-primary">{t("slack")}</h3>
            {slackConnected && (
              <Badge color="success" size="sm">
                {t("connected")}
              </Badge>
            )}
          </div>
          <p className="mb-3 text-sm text-tertiary">
            {t("slackDescription")}
          </p>

          {slackConnected ? (
            <Button
              color="secondary-destructive"
              size="sm"
              onClick={handleDisconnectSlack}
              data-testid="disconnect-slack-btn"
            >
              {t("disconnectSlack")}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder={t("slackWebhookUrl")}
                data-testid="slack-url-input"
                className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-brand"
              />
              <Button
                size="sm"
                onClick={handleConnectSlack}
                data-testid="connect-slack-btn"
              >
                {t("connectSlack")}
              </Button>
            </div>
          )}
        </div>

        {/* Zapier Integration */}
        <div
          className="rounded-lg border border-secondary p-5"
          data-testid="zapier-integration"
        >
          <h3 className="mb-3 font-medium text-primary">{t("zapier")}</h3>
          <p className="mb-3 text-sm text-tertiary">
            {t("zapierDescription")}
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={zapierWebhookUrl}
              readOnly
              className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 font-mono text-xs text-primary outline-none"
              data-testid="zapier-url-input"
            />
            <Button
              color="secondary"
              size="sm"
              onClick={handleCopyZapierUrl}
              data-testid="copy-zapier-url-btn"
            >
              {t("copy")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
