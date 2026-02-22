"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useTranslations } from "next-intl";

export function TwoFactorSetup() {
  const t = useTranslations("settings");
  const mfaStatus = useQuery(api.mfa.getMfaStatus);
  const initSetup = useMutation(api.mfa.initializeTotpSetup);
  const confirmSetup = useMutation(api.mfa.confirmTotpSetup);
  const disableMfa = useMutation(api.mfa.disableTotp);
  const regenerateCodes = useMutation(api.mfa.regenerateBackupCodes);

  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (mfaStatus === undefined) {
    return <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
  }

  const handleEnableClick = async () => {
    try {
      const data = await initSetup();
      setSetupData(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleVerify = async () => {
    try {
      const result = await confirmSetup({ code: verificationCode });
      setBackupCodes(result.backupCodes);
      setSetupData(null);
      setVerificationCode("");
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDisable = async () => {
    try {
      await disableMfa();
      setSetupData(null);
      setBackupCodes(null);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRegenerateCodes = async () => {
    try {
      const result = await regenerateCodes();
      setBackupCodes(result.backupCodes);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">{t("mfaTitle")}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("mfaDescription")}</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Enabled state */}
      {mfaStatus?.isEnabled && !backupCodes && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-medium text-green-700 dark:text-green-300">{t("mfaEnabled")}</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            {t("mfaBackupCodesRemaining", { count: mfaStatus.backupCodesRemaining || 0 })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerateCodes}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {t("mfaRegenerateCodes")}
            </button>
            <button
              onClick={handleDisable}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              {t("mfaDisable")}
            </button>
          </div>
        </div>
      )}

      {/* Backup codes display */}
      {backupCodes && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 p-4">
          <h4 className="font-medium mb-2">{t("mfaBackupCodesTitle")}</h4>
          <p className="text-sm text-gray-500 mb-3">{t("mfaBackupCodesWarning")}</p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded">
            {backupCodes.map((code, i) => (
              <span key={i}>{code}</span>
            ))}
          </div>
          <button
            onClick={() => setBackupCodes(null)}
            className="mt-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t("mfaDone")}
          </button>
        </div>
      )}

      {/* Setup flow */}
      {!mfaStatus?.isEnabled && !setupData && !backupCodes && (
        <button
          onClick={handleEnableClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t("mfaEnable")}
        </button>
      )}

      {/* QR code and verification */}
      {setupData && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div>
            <h4 className="font-medium mb-2">{t("mfaScanQrCode")}</h4>
            <p className="text-sm text-gray-500 mb-3">{t("mfaScanInstructions")}</p>
            {/* QR code placeholder — in production use a QR library */}
            <div className="w-48 h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
              <span className="text-xs text-gray-400 text-center px-2">QR Code<br />(requires qrcode library)</span>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-1">{t("mfaManualEntry")}</h4>
            <code className="block p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm font-mono break-all">
              {setupData.secret}
            </code>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t("mfaVerificationCode")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-lg text-center font-mono text-lg tracking-widest"
              />
              <button
                onClick={handleVerify}
                disabled={verificationCode.length !== 6}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("mfaVerify")}
              </button>
            </div>
          </div>

          <button
            onClick={() => { setSetupData(null); setVerificationCode(""); }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {t("mfaCancel")}
          </button>
        </div>
      )}
    </div>
  );
}
