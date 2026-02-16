"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/base/buttons/button";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { AppLogo } from "@/components/foundations/logo/app-logo";
import { cx } from "@/utils/cx";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const { signIn } = useAuthActions();
  const router = useRouter();
  usePageTitle("Register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await signIn("password", {
        email,
        password,
        name,
        flow: "signUp",
      });
      router.push("/domains");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("registrationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 rounded-xl border border-white/10 bg-gray-900/80 p-8 backdrop-blur-sm">
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

      <Form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
  );
}
