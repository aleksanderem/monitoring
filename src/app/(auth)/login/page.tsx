"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/base/buttons/button";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { toast } from "sonner";

export default function LoginPage() {
  const { signIn } = useAuthActions();
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
      router.push("/dashboard");
      toast.success("Logged in successfully");
    } catch (error) {
      toast.error("Invalid email or password");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-3">
        <h1 className="text-display-xs font-semibold text-primary md:text-display-sm">
          SEO Monitor
        </h1>
        <p className="text-md text-tertiary">
          Welcome back! Please enter your details.
        </p>
      </div>

      <Form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          <Input
            isRequired
            hideRequiredIndicator
            label="Email"
            type="email"
            name="email"
            placeholder="Enter your email"
            size="md"
            isDisabled={isLoading}
          />
          <Input
            isRequired
            hideRequiredIndicator
            label="Password"
            type="password"
            name="password"
            size="md"
            placeholder="••••••••"
            isDisabled={isLoading}
          />
        </div>

        <Button type="submit" size="lg" isLoading={isLoading}>
          Sign in
        </Button>
      </Form>

      <div className="flex justify-center gap-1 text-center text-sm text-tertiary">
        <span>Don't have an account?</span>
        <Button href="/signup" color="link-color" size="md">
          Sign up
        </Button>
      </div>
    </div>
  );
}
