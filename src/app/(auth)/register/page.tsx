"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Mail01, CheckCircle, ArrowLeft } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { PinInput } from "@/components/base/pin-input/pin-input";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { AppLogo } from "@/components/foundations/logo/app-logo";
import { cx } from "@/utils/cx";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";

const FEATURES = [
  { icon: "📊", key: "featureTracking" },
  { icon: "🔍", key: "featureSerp" },
  { icon: "🏆", key: "featureCompetitors" },
  { icon: "🔗", key: "featureBacklinks" },
  { icon: "📈", key: "featureReports" },
  { icon: "🤖", key: "featureAi" },
] as const;

const PLAN_HIGHLIGHTS = [
  { key: "planHighlight1" },
  { key: "planHighlight2" },
  { key: "planHighlight3" },
  { key: "planHighlight4" },
] as const;

type Step =
  | { type: "register" }
  | { type: "verify"; email: string }
  | { type: "success" };

export default function RegisterPage() {
  const t = useTranslations("auth");
  const { signIn } = useAuthActions();
  const router = useRouter();
  usePageTitle("Register");

  const [step, setStep] = useState<Step>({ type: "register" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pinValue, setPinValue] = useState("");
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Auto-redirect countdown on success
  useEffect(() => {
    if (step.type !== "success") return;
    if (redirectCountdown <= 0) {
      router.push("/domains");
      return;
    }
    const timer = setTimeout(() => setRedirectCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step.type, redirectCountdown, router]);

  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setIsLoading(true);
      try {
        const result = await signIn("password", {
          email,
          password,
          name,
          flow: "signUp",
        });
        // If signIn returns with signingIn: false, verification is required
        // If the user is already verified, they get signed in immediately
        if (result && typeof result === "object" && "signingIn" in result && result.signingIn === false) {
          setStep({ type: "verify", email });
          setCooldown(60);
          toast.success(t("codeSent", { email }));
        } else {
          // Already verified or immediate sign-in
          router.push("/domains");
        }
      } catch (err) {
        console.error("[register] signUp error:", err);
        setError(err instanceof Error ? err.message : t("registrationFailed"));
      } finally {
        setIsLoading(false);
      }
    },
    [signIn, email, password, name, router, t]
  );

  const handleVerifyCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (step.type !== "verify") return;
      setError("");
      setIsLoading(true);
      try {
        await signIn("password", {
          email: step.email,
          code: pinValue,
          flow: "email-verification",
        });
        setStep({ type: "success" });
        setRedirectCountdown(3);
        toast.success(t("emailVerified"));
      } catch (err) {
        console.error("[register] verify error:", err);
        setError(t("invalidVerificationCode"));
      } finally {
        setIsLoading(false);
      }
    },
    [signIn, step, pinValue, t]
  );

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || step.type !== "verify") return;
    setIsLoading(true);
    try {
      await signIn("password", {
        email: step.email,
        password,
        flow: "signUp",
      });
      setCooldown(60);
      toast.success(t("codeSentAgain"));
    } catch (err) {
      console.error("[register] resend error:", err);
      toast.error(t("registrationFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [signIn, step, password, cooldown, t]);

  // Step 1: Registration form
  if (step.type === "register") {
    return (
      <div className="mx-auto flex w-full max-w-4xl gap-0 overflow-hidden rounded-xl border border-white/10 bg-gray-900/80 backdrop-blur-sm lg:min-h-[600px]">
        {/* Left panel — features */}
        <div className="hidden w-[400px] shrink-0 flex-col justify-between border-r border-white/10 bg-gradient-to-b from-indigo-600/20 to-gray-900/40 p-8 lg:flex">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-white">{t("registerWhyTitle")}</h2>
              <p className="text-sm leading-relaxed text-gray-400">{t("registerWhySubtitle")}</p>
            </div>

            <div className="flex flex-col gap-3">
              {FEATURES.map((f) => (
                <div key={f.key} className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition hover:bg-white/5">
                  <span className="mt-0.5 text-base">{f.icon}</span>
                  <span className="text-sm text-gray-300">{t(f.key)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-300">{t("registerFreeTrialBadge")}</p>
            <div className="flex flex-col gap-1.5">
              {PLAN_HIGHLIGHTS.map((h) => (
                <div key={h.key} className="flex items-center gap-2">
                  <svg width="14" height="11" viewBox="0 0 10 8" fill="none" className="shrink-0 text-indigo-400">
                    <path d="M1.25 4L3.75 6.5L8.75 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-xs text-gray-400">{t(h.key)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex flex-1 flex-col justify-center gap-8 p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <AppLogo variant="white" className="h-10" />
            <div className="flex flex-col gap-2">
              <h1 className="text-display-xs font-semibold text-primary md:text-display-sm">{t("createAccount")}</h1>
              <p className="text-md text-tertiary">{t("startFreeTrial")}</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-error-300 bg-error-50 p-4">
              <p className="text-sm font-medium text-error-700">{error}</p>
            </div>
          )}

          <Form onSubmit={handleRegister} className="flex flex-col gap-6">
            <div className="flex flex-col gap-5">
              <Input
                isRequired
                hideRequiredIndicator
                label={t("name")}
                type="text"
                name="name"
                placeholder={t("enterName")}
                size="md"
                value={name}
                onChange={setName}
                isDisabled={isLoading}
              />
              <Input
                isRequired
                hideRequiredIndicator
                label={t("email")}
                type="email"
                name="email"
                placeholder={t("enterEmail")}
                size="md"
                value={email}
                onChange={setEmail}
                isDisabled={isLoading}
              />
              <Input
                isRequired
                hideRequiredIndicator
                label={t("password")}
                type="password"
                name="password"
                size="md"
                placeholder={t("createPassword")}
                value={password}
                onChange={setPassword}
                minLength={8}
                isDisabled={isLoading}
              />
              <div className="flex flex-col gap-3">
                <span className="flex gap-2">
                  <div
                    className={cx(
                      "flex size-5 items-center justify-center rounded-full bg-fg-disabled_subtle text-fg-white transition duration-150 ease-in-out",
                      password.length >= 8 ? "bg-fg-success-primary" : "",
                    )}
                  >
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1.25 4L3.75 6.5L8.75 1.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-tertiary">{t("passwordMinLength")}</p>
                </span>
              </div>
            </div>

            <Button type="submit" size="lg" isLoading={isLoading} isDisabled={isLoading}>
              {isLoading ? t("creatingAccount") : t("getStarted")}
            </Button>
          </Form>

          <div className="flex justify-center gap-1 text-center text-sm text-tertiary">
            <span>{t("alreadyHaveAccount")}</span>
            <Button href="/login" color="link-color" size="md">
              {t("logIn")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Verify email with code
  if (step.type === "verify") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 rounded-xl border border-white/10 bg-gray-900/80 p-8 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-6 text-center">
          <FeaturedIcon color="brand" theme="modern" size="xl">
            <Mail01 className="size-7" />
          </FeaturedIcon>

          <div className="flex flex-col gap-2">
            <h1 className="text-display-xs font-semibold text-primary">{t("checkYourEmail")}</h1>
            <p className="text-md text-tertiary">
              {t("verificationCodeSent")} <span className="font-medium text-primary">{step.email}</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-error-300 bg-error-50 p-4">
            <p className="text-sm font-medium text-error-700">{error}</p>
          </div>
        )}

        <Form onSubmit={handleVerifyCode} className="flex flex-col items-center gap-6">
          <div className="md:hidden">
            <PinInput size="sm">
              <PinInput.Group
                maxLength={8}
                value={pinValue}
                onChange={setPinValue}
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <PinInput.Slot key={i} index={i} />
                ))}
              </PinInput.Group>
            </PinInput>
          </div>
          <div className="max-md:hidden">
            <PinInput size="md">
              <PinInput.Group
                maxLength={8}
                value={pinValue}
                onChange={setPinValue}
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <PinInput.Slot key={i} index={i} />
                ))}
              </PinInput.Group>
            </PinInput>
          </div>

          <Button type="submit" size="lg" className="w-full" isLoading={isLoading} isDisabled={isLoading || pinValue.length < 8}>
            {isLoading ? t("verifying") : t("verifyEmail")}
          </Button>
        </Form>

        <div className="flex flex-col items-center gap-4 text-center">
          <p className="flex gap-1">
            <span className="text-sm text-tertiary">{t("didntReceiveEmail")}</span>
            {cooldown > 0 ? (
              <span className="text-sm text-tertiary">
                {t("resendIn", { seconds: cooldown.toString() })}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                className="text-sm text-brand-600 hover:text-brand-500 disabled:opacity-50"
              >
                {t("clickToResend")}
              </button>
            )}
          </p>

          <button
            type="button"
            onClick={() => {
              setStep({ type: "register" });
              setError("");
              setPinValue("");
            }}
            className="flex items-center gap-2 text-sm text-tertiary hover:text-secondary"
          >
            <ArrowLeft className="size-4" />
            {t("backToRegistration")}
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Success
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 rounded-xl border border-white/10 bg-gray-900/80 p-8 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 text-center">
        <FeaturedIcon color="success" theme="modern" size="xl">
          <CheckCircle className="size-7" />
        </FeaturedIcon>

        <div className="flex flex-col gap-2">
          <h1 className="text-display-xs font-semibold text-primary">{t("emailVerified")}</h1>
          <p className="text-md text-tertiary">{t("accountCreatedSuccess")}</p>
        </div>
      </div>

      <Button size="lg" className="w-full" href="/domains">
        {t("continueToDashboard")}
      </Button>

      <p className="text-center text-sm text-tertiary">
        {t("redirectingIn", { seconds: redirectCountdown.toString() })}
      </p>
    </div>
  );
}
