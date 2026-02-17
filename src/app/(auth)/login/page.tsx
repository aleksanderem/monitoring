"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/base/buttons/button";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { AppLogo } from "@/components/foundations/logo/app-logo";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { usePageTitle } from "@/hooks/usePageTitle";

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

        <Button type="submit" size="lg" isLoading={isLoading}>
          {t("signIn")}
        </Button>
      </Form>

      <div className="flex justify-center gap-1 text-center text-sm text-tertiary">
        <span>{t("noAccount")}</span>
        <Button href="/register" color="link-color" size="md">
          {t("signUp")}
        </Button>
      </div>
    </div>
  );
}
