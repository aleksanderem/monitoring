"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Bell01, Settings01, CheckDone01, Globe01, ChevronDown, RefreshCw01, XCircle } from "@untitledui/icons";
import { Button as AriaButton, DialogTrigger, Popover } from "react-aria-components";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";
import { NavAccountMenu } from "./base-components/nav-account-card";
import { NavItemButton } from "./base-components/nav-item-button";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { FeedItem, type FeedItemType } from "@/components/application/activity-feed/activity-feed";
import { Button } from "@/components/base/buttons/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslations } from "next-intl";

interface TopBarProps {
  activeUrl?: string;
}

function formatRelativeTime(timestamp: number, tc: (key: string, params?: Record<string, string | number | Date>) => string): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return tc("justNow");
  if (minutes < 60) return tc("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tc("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return tc("daysAgo", { count: days });
  return new Date(timestamp).toLocaleDateString();
}

function DomainSelector() {
  const t = useTranslations("nav");
  const domains = useQuery(api.domains.list);
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Extract current domainId from URL
  const domainIdMatch = pathname.match(/\/domains\/([^/]+)/);
  const currentDomainId = domainIdMatch ? domainIdMatch[1] : null;

  const currentDomain = useMemo(() => {
    if (!domains || !currentDomainId) return null;
    return domains.find((d: any) => d._id === currentDomainId) ?? null;
  }, [domains, currentDomainId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  if (!domains || domains.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-secondary bg-secondary/50 px-3 py-1.5 text-sm text-primary hover:bg-secondary transition-colors"
      >
        <Globe01 className="w-4 h-4 text-tertiary" />
        <span className="max-w-[200px] truncate">
          {currentDomain ? (currentDomain as any).domain : t("selectDomain")}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-quaternary" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 rounded-lg border border-secondary bg-primary shadow-lg z-50 max-h-80 overflow-y-auto">
          {(domains as any[]).map((d) => (
            <button
              key={d._id}
              onClick={() => {
                router.push(`/domains/${d._id}`);
                setIsOpen(false);
              }}
              className={cx(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary",
                d._id === currentDomainId && "bg-secondary/50"
              )}
            >
              <Globe01 className="w-4 h-4 text-tertiary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className={cx("truncate font-medium", d._id === currentDomainId ? "text-brand-600" : "text-primary")}>
                  {d.domain}
                </div>
                {d.projectName && (
                  <div className="text-xs text-quaternary truncate">{d.projectName}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar({ activeUrl }: TopBarProps) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isJobsOpen, setIsJobsOpen] = useState(false);
  const currentUser = useQuery(api.auth.getCurrentUser);
  const isSuperAdmin = useQuery(api.admin.checkIsSuperAdmin);
  const notifications = useQuery(api.notifications.getNotifications, { limit: 30 });
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const activeJobs = useQuery(api.jobs_queries.getAllJobs, { filter: "active" });
  const cancelAnyJob = useMutation(api.jobs_queries.cancelAnyJob);
  const { signOut } = useAuthActions();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const feed: FeedItemType[] = useMemo(() => {
    if (!notifications) return [];
    return notifications.map((n) => ({
      id: n._id,
      unseen: !n.isRead,
      date: formatRelativeTime(n.createdAt, tc),
      user: {
        avatarUrl: "",
        name: t("system"),
        href: "#",
      },
      action: {
        content: n.title,
        target: n.domainName,
        href: n.domainId ? `/domains/${n.domainId}` : undefined,
      },
      message: n.message,
    }));
  }, [notifications, t, tc]);

  const userName = currentUser?.name || null;
  const userEmail = currentUser?.email || null;
  const userImage = currentUser?.image || null;

  return (
    <header className="sticky top-0 z-40 border-b border-secondary bg-primary">
      <div className="flex h-16 items-center gap-3 px-4 md:px-8">
        {/* Left side: Domain selector */}
        <DomainSelector />

        <div className="flex-1" />

        {/* Right side: Jobs, Settings, Notifications, User */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          <div className="flex gap-0.5">
            {/* Active jobs slideout */}
            {(activeJobs?.length ?? 0) > 0 && (
              <SlideoutMenu.Trigger isOpen={isJobsOpen} onOpenChange={setIsJobsOpen}>
                <div className="relative">
                  <NavItemButton
                    current={false}
                    size="md"
                    icon={RefreshCw01}
                    label={t("runningJobs")}
                    tooltipPlacement="bottom"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsJobsOpen(true);
                    }}
                    className="[&_svg]:animate-spin"
                  />
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-medium text-white">
                    {activeJobs!.length}
                  </span>
                </div>
                <SlideoutMenu isDismissable>
                  <SlideoutMenu.Header onClose={() => setIsJobsOpen(false)} className="relative flex w-full items-center justify-between gap-0.5 px-4 pt-6 md:px-6">
                    <h1 className="text-md font-semibold text-primary md:text-lg">{t("runningJobs")}</h1>
                    <span className="text-xs text-tertiary">{activeJobs!.length} {t("active")}</span>
                  </SlideoutMenu.Header>
                  <SlideoutMenu.Content className="pb-6">
                    <div className="space-y-3 px-4 pt-4 md:px-6">
                      {activeJobs!.map((job) => (
                        <div key={job.id} className="rounded-lg border border-secondary bg-secondary/20 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-400">
                                  {job.type}
                                </span>
                                <span className="text-sm font-medium text-primary truncate">{job.domainName}</span>
                              </div>
                              {job.currentStep && (
                                <p className="mt-1 text-xs text-tertiary truncate">{job.currentStep}</p>
                              )}
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  await cancelAnyJob({ table: job.table, jobId: job.id });
                                } catch { /* ignore */ }
                              }}
                              className="shrink-0 rounded-md p-1.5 text-quaternary transition-colors hover:bg-utility-error-50 hover:text-utility-error-600"
                              title={t("cancelJob")}
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                          {job.progress != null && (
                            <div className="mt-3">
                              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                  className="h-full bg-brand-600 transition-all duration-300"
                                  style={{ width: `${Math.min(job.progress, 100)}%` }}
                                />
                              </div>
                              <div className="mt-1 flex items-center justify-between text-xs text-quaternary">
                                <span>{job.progress}%</span>
                                <span className={cx(job.status === "processing" ? "text-brand-600" : "text-quaternary")}>
                                  {tc(`status${job.status.charAt(0).toUpperCase()}${job.status.slice(1)}` as any)}
                                </span>
                              </div>
                            </div>
                          )}
                          {job.progress == null && (
                            <div className="mt-2 flex items-center gap-2">
                              <RefreshCw01 className={cx("h-3 w-3", job.status === "processing" ? "animate-spin text-brand-600" : "text-quaternary")} />
                              <span className="text-xs text-tertiary">{tc(`status${job.status.charAt(0).toUpperCase()}${job.status.slice(1)}` as any)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </SlideoutMenu.Content>
                </SlideoutMenu>
              </SlideoutMenu.Trigger>
            )}

            <NavItemButton
              current={activeUrl === "/settings"}
              size="md"
              icon={Settings01}
              label={t("settings")}
              href="/settings"
              tooltipPlacement="bottom"
            />

            {/* Notifications with slideout */}
            <SlideoutMenu.Trigger isOpen={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
              <div className="relative">
                <NavItemButton
                  current={false}
                  size="md"
                  icon={Bell01}
                  label={t("notifications")}
                  tooltipPlacement="bottom"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsNotificationsOpen(true);
                  }}
                />
                {(unreadCount ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-utility-error-500 px-1 text-[10px] font-medium text-white">
                    {unreadCount! > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <SlideoutMenu isDismissable>
                <SlideoutMenu.Header onClose={() => setIsNotificationsOpen(false)} className="relative flex w-full items-center justify-between gap-0.5 px-4 pt-6 md:px-6">
                  <h1 className="text-md font-semibold text-primary md:text-lg">{t("notifications")}</h1>
                  {(unreadCount ?? 0) > 0 && (
                    <Button
                      color="link-gray"
                      size="sm"
                      iconLeading={CheckDone01}
                      onClick={() => markAllAsRead({})}
                    >
                      {t("markAllRead")}
                    </Button>
                  )}
                </SlideoutMenu.Header>
                <SlideoutMenu.Content className="pb-6">
                  {feed.length > 0 ? (
                    <ul>
                      {feed.map((item, index) => (
                        <li key={item.id}>
                          <FeedItem {...item} connector={index !== feed.length - 1} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Bell01 className="h-8 w-8 text-quaternary mx-auto mb-3" />
                      <p className="text-sm text-tertiary">{t("noNotificationsYet")}</p>
                      <p className="text-xs text-quaternary mt-1">{t("jobCompletionsWillAppearHere")}</p>
                    </div>
                  )}
                </SlideoutMenu.Content>
              </SlideoutMenu>
            </SlideoutMenu.Trigger>
          </div>

          <DialogTrigger>
            <AriaButton
              className={({ isPressed, isFocused }) =>
                cx(
                  "group relative inline-flex cursor-pointer",
                  (isPressed || isFocused) && "rounded-full outline-2 outline-offset-2 outline-focus-ring",
                )
              }
            >
              <Avatar alt={userName || userEmail || t("user")} src={userImage ?? undefined} size="md" />
            </AriaButton>
            <Popover
              placement="bottom right"
              offset={8}
              className={({ isEntering, isExiting }) =>
                cx(
                  "will-change-transform",
                  isEntering &&
                    "duration-300 ease-out animate-in fade-in placement-right:slide-in-from-left-2 placement-top:slide-in-from-bottom-2 placement-bottom:slide-in-from-top-2",
                  isExiting &&
                    "duration-150 ease-in animate-out fade-out placement-right:slide-out-to-left-2 placement-top:slide-out-to-bottom-2 placement-bottom:slide-out-to-top-2",
                )
              }
            >
              <NavAccountMenu
                onSignOut={handleSignOut}
                userName={userName ?? undefined}
                userEmail={userEmail ?? undefined}
                isSuperAdmin={isSuperAdmin === true}
              />
            </Popover>
          </DialogTrigger>
        </div>
      </div>
    </header>
  );
}
