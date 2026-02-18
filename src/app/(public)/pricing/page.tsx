"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { AppLogo } from "@/components/foundations/logo/app-logo";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Check, XClose, CheckCircle } from "@untitledui/icons";
import { toast } from "sonner";
import Link from "next/link";

const PLANS = [
  {
    key: "free",
    name: "Free",
    description: "Get started with basic SEO monitoring",
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: "Get started",
    ctaLink: "/register",
    highlighted: false,
  },
  {
    key: "pro",
    name: "Pro",
    description: "Everything you need for professional SEO",
    monthlyPrice: 49,
    yearlyPrice: 39,
    cta: "Start 7-day trial",
    highlighted: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "Advanced features for large teams",
    monthlyPrice: null,
    yearlyPrice: null,
    cta: "Skontaktuj się",
    ctaLink: "mailto:contact@dseo.app",
    highlighted: false,
  },
] as const;

interface Feature {
  name: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
}

const LIMITS_FEATURES: Feature[] = [
  { name: "Keywords", free: "50", pro: "500", enterprise: "Unlimited" },
  { name: "Domains", free: "3", pro: "20", enterprise: "Unlimited" },
  { name: "Projects", free: "1", pro: "10", enterprise: "Unlimited" },
];

const MODULE_FEATURES: Feature[] = [
  { name: "Keyword Tracking", free: true, pro: true, enterprise: true },
  { name: "Reports", free: true, pro: true, enterprise: true },
  { name: "Backlinks", free: false, pro: true, enterprise: true },
  { name: "SEO Audit", free: false, pro: true, enterprise: true },
  { name: "Competitors", free: false, pro: true, enterprise: true },
  { name: "Link Building", free: false, pro: true, enterprise: true },
  { name: "AI Strategy", free: false, pro: false, enterprise: true },
  { name: "Forecasts", free: false, pro: false, enterprise: true },
];

function FeatureCheck({ value }: { value: string | boolean }) {
  if (typeof value === "string") {
    return <span className="text-sm font-medium text-primary">{value}</span>;
  }
  if (value) {
    return <Check className="h-5 w-5 text-fg-success-primary" />;
  }
  return <XClose className="h-5 w-5 text-quaternary" />;
}

function getDaysUntil(unixSeconds: number): number {
  const now = Date.now();
  const target = unixSeconds * 1000;
  return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const [loading, setLoading] = useState(false);

  // Fetch subscription data (returns [] if not logged in)
  const orgs = useQuery(api.organizations.getUserOrganizations);
  const firstOrg = orgs?.[0];
  const planId = firstOrg?.planId;
  const plan = useQuery(api.plans.getPlan, planId ? { planId } : "skip");
  const defaultPlan = useQuery(api.plans.getDefaultPlan, planId ? "skip" : {});

  const currentPlanKey = plan?.key ?? defaultPlan?.key ?? (orgs?.length === 0 ? null : "free");
  const subscriptionStatus = firstOrg?.subscriptionStatus;
  const subscriptionEnd = firstOrg?.subscriptionPeriodEnd;
  const isSubscribed = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const isTrialing = subscriptionStatus === "trialing";
  const daysUntilRenewal = subscriptionEnd ? getDaysUntil(subscriptionEnd) : null;

  async function handleUpgrade() {
    setLoading(true);
    try {
      const url = await createCheckout({ billingCycle });
      window.location.href = url;
    } catch {
      toast.error("Failed to start checkout");
      setLoading(false);
    }
  }

  function getPlanCta(planKey: string) {
    if (!orgs || orgs.length === 0) {
      // Not logged in or no org — show default CTAs
      return null;
    }

    const isCurrent = planKey === currentPlanKey;

    if (planKey === "free") {
      if (isCurrent && !isSubscribed) return { label: "Aktualny plan", disabled: true };
      return { label: "Get started", disabled: false };
    }

    if (planKey === "pro") {
      if (isCurrent && isSubscribed) return { label: "Aktualny plan", disabled: true };
      return null; // Use default upgrade flow
    }

    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <Link href="/" className="inline-block">
          <AppLogo variant="white" className="h-8" />
        </Link>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Page heading */}
        <div className="mb-12 text-center">
          <h1 className="text-display-md font-semibold text-white sm:text-display-lg">
            Plans & Pricing
          </h1>
          <p className="mt-4 text-lg text-gray-400">
            Choose the plan that fits your SEO workflow. Upgrade or downgrade anytime.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-gray-900 p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                billingCycle === "monthly"
                  ? "bg-brand-solid text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                billingCycle === "yearly"
                  ? "bg-brand-solid text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Yearly
              <Badge size="sm" type="pill-color" color="success" className="ml-2">
                Save 20%
              </Badge>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((planDef) => {
            const price =
              planDef.monthlyPrice === null
                ? null
                : billingCycle === "monthly"
                  ? planDef.monthlyPrice
                  : planDef.yearlyPrice;

            const isCurrent = currentPlanKey === planDef.key && orgs && orgs.length > 0;
            const ctaOverride = getPlanCta(planDef.key);

            return (
              <div
                key={planDef.key}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  isCurrent && isSubscribed
                    ? "border-fg-success-primary bg-gray-900 ring-1 ring-fg-success-primary"
                    : planDef.highlighted
                      ? "border-brand-solid bg-gray-900 ring-1 ring-brand-solid"
                      : "border-white/10 bg-gray-900/50"
                }`}
              >
                {/* Top badge: current plan or "Most popular" */}
                {isCurrent && (isSubscribed || (!isSubscribed && planDef.key === "free")) ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge size="md" type="pill-color" color="success">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Aktualny plan
                      </span>
                    </Badge>
                  </div>
                ) : planDef.highlighted ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge size="md" type="pill-color" color="brand">
                      Most popular
                    </Badge>
                  </div>
                ) : null}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">{planDef.name}</h3>
                  <p className="mt-1 text-sm text-gray-400">{planDef.description}</p>
                </div>

                <div className="mb-6">
                  {price !== null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-display-sm font-semibold text-white">
                        ${price}
                      </span>
                      <span className="text-sm text-gray-400">
                        /mo
                      </span>
                    </div>
                  ) : (
                    <span className="text-display-sm font-semibold text-white">Custom</span>
                  )}
                  {billingCycle === "yearly" && price !== null && price > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Billed ${price * 12}/year
                    </p>
                  )}
                </div>

                {/* Subscription info (trial / renewal) */}
                {isCurrent && isSubscribed && planDef.key === "pro" && (
                  <div className="mb-4 flex flex-col gap-1.5 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5">
                    {isTrialing && daysUntilRenewal !== null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Trial kończy się za</span>
                        <span className="font-medium text-warning-400">
                          {daysUntilRenewal} {daysUntilRenewal === 1 ? "dzień" : "dni"}
                        </span>
                      </div>
                    )}
                    {!isTrialing && daysUntilRenewal !== null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Odnowienie za</span>
                        <span className="font-medium text-gray-200">
                          {daysUntilRenewal} {daysUntilRenewal === 1 ? "dzień" : "dni"}
                        </span>
                      </div>
                    )}
                    {subscriptionEnd && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">
                          {isTrialing ? "Pierwszy billing" : "Następna płatność"}
                        </span>
                        <span className="font-medium text-gray-300">
                          {new Date(subscriptionEnd * 1000).toLocaleDateString("pl-PL")}
                        </span>
                      </div>
                    )}
                    {firstOrg?.billingCycle && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Cykl rozliczeniowy</span>
                        <span className="font-medium text-gray-300">
                          {firstOrg.billingCycle === "yearly" ? "Roczny" : "Miesięczny"}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* CTA */}
                {ctaOverride?.disabled ? (
                  <Button
                    color="secondary"
                    size="lg"
                    isDisabled
                    className="w-full"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-fg-success-primary" />
                      {ctaOverride.label}
                    </span>
                  </Button>
                ) : planDef.key === "pro" ? (
                  <Button
                    color="primary"
                    size="lg"
                    onClick={handleUpgrade}
                    isLoading={loading}
                    isDisabled={isCurrent && isSubscribed}
                    className="w-full"
                  >
                    {isCurrent && isSubscribed ? "Aktualny plan" : planDef.cta}
                  </Button>
                ) : (
                  <Button
                    color="secondary"
                    size="lg"
                    href={planDef.ctaLink}
                    className="w-full"
                  >
                    {planDef.cta}
                  </Button>
                )}

                {/* Manage subscription link for current Pro users */}
                {isCurrent && isSubscribed && planDef.key === "pro" && (
                  <Link
                    href="/settings"
                    className="mt-2 text-center text-xs text-gray-500 hover:text-gray-300 transition"
                  >
                    Zarządzaj subskrypcją →
                  </Link>
                )}

                {/* Feature list */}
                <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6">
                  {LIMITS_FEATURES.map((f) => {
                    const val = f[planDef.key as keyof Pick<Feature, "free" | "pro" | "enterprise">];
                    return (
                      <div key={f.name} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{f.name}</span>
                        <span className="font-medium text-white">{val as string}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
                  {MODULE_FEATURES.map((f) => {
                    const val = f[planDef.key as keyof Pick<Feature, "free" | "pro" | "enterprise">];
                    return (
                      <div key={f.name} className="flex items-center gap-3 text-sm">
                        {val ? (
                          <Check className="h-4 w-4 shrink-0 text-fg-success-primary" />
                        ) : (
                          <XClose className="h-4 w-4 shrink-0 text-quaternary" />
                        )}
                        <span className={val ? "text-gray-300" : "text-gray-500"}>
                          {f.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <div className="mt-20">
          <h2 className="mb-8 text-center text-xl font-semibold text-white">
            Feature comparison
          </h2>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-gray-900/50">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 font-medium text-gray-400">Feature</th>
                  <th className="px-6 py-4 text-center font-medium text-gray-400">Free</th>
                  <th className="px-6 py-4 text-center font-medium text-gray-400">Pro</th>
                  <th className="px-6 py-4 text-center font-medium text-gray-400">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[...LIMITS_FEATURES, ...MODULE_FEATURES].map((f, i) => (
                  <tr
                    key={f.name}
                    className={i < LIMITS_FEATURES.length + MODULE_FEATURES.length - 1 ? "border-b border-white/5" : ""}
                  >
                    <td className="px-6 py-3 text-gray-300">{f.name}</td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <FeatureCheck value={f.free} />
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <FeatureCheck value={f.pro} />
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <FeatureCheck value={f.enterprise} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
