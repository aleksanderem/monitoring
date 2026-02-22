"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { SocialButton } from "@/components/base/buttons/social-button";
import { useTranslations } from "next-intl";

const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

export function GoogleSignInButton() {
  const t = useTranslations("auth");
  const { signIn } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);

  if (!GOOGLE_AUTH_ENABLED) {
    return null;
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("google");
    } catch {
      // OAuth redirect will happen, errors are rare here
      setIsLoading(false);
    }
  };

  return (
    <SocialButton
      social="google"
      theme="brand"
      size="lg"
      disabled={isLoading}
      onClick={handleGoogleSignIn}
      className="w-full"
    >
      {t("signInWithGoogle")}
    </SocialButton>
  );
}
