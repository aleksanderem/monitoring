"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/base/buttons/button";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { AppLogo } from "@/components/foundations/logo/app-logo";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";

type Step = "email" | "code";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const { signIn } = useAuthActions();
  usePageTitle("Forgot Password");
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendCode = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsLoading(true);
      try {
        const formData = new FormData(e.currentTarget);
        const emailValue = formData.get("email") as string;
        setEmail(emailValue);
        await signIn("password", { email: emailValue, flow: "reset" });
        setStep("code");
        setCooldown(60);
        toast.success(t("codeSent", { email: emailValue }));
      } catch {
        toast.error(t("invalidCredentials"));
      } finally {
        setIsLoading(false);
      }
    },
    [signIn, t]
  );

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    try {
      await signIn("password", { email, flow: "reset" });
      setCooldown(60);
      toast.success(t("codeSent", { email }));
    } catch {
      toast.error(t("invalidCredentials"));
    } finally {
      setIsLoading(false);
    }
  }, [signIn, email, cooldown, t]);

  const handleResetPassword = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const code = formData.get("code") as string;
      const newPassword = formData.get("newPassword") as string;
      const confirmPassword = formData.get("confirmPassword") as string;

      if (newPassword !== confirmPassword) {
        toast.error(t("passwordsDoNotMatch"));
        return;
      }

      setIsLoading(true);
      try {
        await signIn("password", {
          email,
          code,
          newPassword,
          flow: "reset-verification",
        });
        toast.success(t("resetSuccess"));
        router.push("/domains");
      } catch {
        toast.error(t("invalidCode"));
      } finally {
        setIsLoading(false);
      }
    },
    [signIn, email, router, t]
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 rounded-xl border border-white/10 bg-gray-900/80 p-8 backdrop-blur-sm">
      <div className="flex flex-col gap-3">
        <AppLogo variant="white" className="h-9" />
        <p className="text-md text-tertiary">
          {t("forgotPasswordDescription")}
        </p>
      </div>

      {step === "email" && (
        <Form onSubmit={handleSendCode} className="flex flex-col gap-6">
          <Input
            isRequired
            hideRequiredIndicator
            label={t("email")}
            type="email"
            name="email"
            placeholder={t("enterEmail")}
            size="md"
            isDisabled={isLoading}
          />
          <Button type="submit" size="lg" isLoading={isLoading}>
            {t("sendResetCode")}
          </Button>
        </Form>
      )}

      {step === "code" && (
        <Form onSubmit={handleResetPassword} className="flex flex-col gap-6">
          <div className="flex flex-col gap-5">
            <Input
              isRequired
              hideRequiredIndicator
              label={t("resetCode")}
              type="text"
              name="code"
              placeholder={t("enterResetCode")}
              size="md"
              isDisabled={isLoading}
              autoComplete="one-time-code"
            />
            <Input
              isRequired
              hideRequiredIndicator
              label={t("newPassword")}
              type="password"
              name="newPassword"
              placeholder="••••••••"
              size="md"
              isDisabled={isLoading}
            />
            <Input
              isRequired
              hideRequiredIndicator
              label={t("confirmPassword")}
              type="password"
              name="confirmPassword"
              placeholder="••••••••"
              size="md"
              isDisabled={isLoading}
            />
            <p className="text-xs text-tertiary">{t("passwordRequirements")}</p>
          </div>

          <Button type="submit" size="lg" isLoading={isLoading}>
            {t("resetPassword")}
          </Button>

          <div className="text-center">
            {cooldown > 0 ? (
              <span className="text-sm text-tertiary">
                {t("resendIn", { seconds: cooldown.toString() })}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-sm text-brand-600 hover:text-brand-500"
                disabled={isLoading}
              >
                {t("resendCode")}
              </button>
            )}
          </div>
        </Form>
      )}

      <div className="flex justify-center text-center">
        <Button href="/login" color="link-color" size="md">
          {t("backToLogin")}
        </Button>
      </div>
    </div>
  );
}
