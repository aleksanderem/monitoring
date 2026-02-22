"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/base/buttons/button";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { AppLogo } from "@/components/foundations/logo/app-logo";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { OAuthDivider } from "@/components/auth/oauth-divider";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";

const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

export default function LoginPage() {
  const t = useTranslations("auth");
  const { signIn } = useAuthActions();
  usePageTitle("Login");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

      await signIn("password", { email, password, flow: "signIn" });
      router.push("/domains");
      toast.success(t("loginSuccess"));
    } catch (error) {
      toast.error(t("invalidCredentials"));
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 rounded-xl border border-white/10 bg-gray-900/80 p-8 backdrop-blur-sm">
      <div className="flex flex-col gap-3">
        <AppLogo variant="white" className="h-9" />
        <p className="text-md text-tertiary">
          {t("welcomeBack")}
        </p>
      </div>

      {GOOGLE_AUTH_ENABLED && (
        <div className="flex flex-col gap-6">
          <GoogleSignInButton />
          <OAuthDivider />
        </div>
      )}

      <Form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-5">
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
          <Input
            isRequired
            hideRequiredIndicator
            label={t("password")}
            type="password"
            name="password"
            size="md"
            placeholder="••••••••"
            isDisabled={isLoading}
          />
        </div>

        <div className="flex justify-end">
          <Button href="/forgot-password" color="link-color" size="sm">
            {t("forgotPassword")}
          </Button>
        </div>

        <Button type="submit" size="lg" isLoading={isLoading}>
          {t("signIn")}
        </Button>
      </Form>

      <div className="relative flex items-center gap-4">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-tertiary">{t("orContinueWith")}</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          data-testid="oauth-github"
          onClick={() => void signIn("github")}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#24292f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#24292f]/90"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
          </svg>
          {t("signInWithGithub")}
        </button>
        <button
          type="button"
          data-testid="oauth-microsoft"
          onClick={() => void signIn("microsoft-entra-id")}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2f2f2f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#2f2f2f]/90"
        >
          <svg className="h-5 w-5" viewBox="0 0 21 21" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          {t("signInWithMicrosoft")}
        </button>
      </div>

      <div className="flex justify-center gap-1 text-center text-sm text-tertiary">
        <span>{t("noAccount")}</span>
        <Button href="/register" color="link-color" size="md">
          {t("signUp")}
        </Button>
      </div>
    </div>
  );
}
