"use client";

import { useState } from "react";
import { Bell01, Settings01 } from "@untitledui/icons";
import { Button as AriaButton, DialogTrigger, Popover } from "react-aria-components";
import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";
import { NavAccountMenu } from "./base-components/nav-account-card";
import { NavItemButton } from "./base-components/nav-item-button";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { FeedItem, type FeedItemType } from "@/components/application/activity-feed/activity-feed";

interface TopBarProps {
  activeUrl?: string;
}

// Mock notification data - replace with real data from your backend
const feed: FeedItemType[] = [
  {
    id: "notif-1",
    unseen: true,
    date: "5 mins ago",
    user: {
      avatarUrl: "https://www.untitledui.com/images/avatars/phoenix-baker?fm=webp&q=80",
      name: "System",
      href: "#",
      status: "online",
    },
    action: {
      content: "Keyword position check completed for",
      target: "example.com",
      href: "#",
    },
  },
];

export function TopBar({ activeUrl }: TopBarProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  return (
    <header className="border-b border-secondary bg-primary">
      <div className="flex h-16 items-center justify-end gap-3 px-4 md:px-8">
        {/* Right side only: Settings, Notifications, User */}
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5">
            <NavItemButton
              current={activeUrl === "/settings"}
              size="md"
              icon={Settings01}
              label="Settings"
              href="/settings"
              tooltipPlacement="bottom"
            />

            {/* Notifications with slideout */}
            <SlideoutMenu.Trigger isOpen={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
              <NavItemButton
                current={false}
                size="md"
                icon={Bell01}
                label="Notifications"
                tooltipPlacement="bottom"
                onClick={(e) => {
                  e.preventDefault();
                  setIsNotificationsOpen(true);
                }}
              />
              <SlideoutMenu isDismissable>
                <SlideoutMenu.Header onClose={() => setIsNotificationsOpen(false)} className="relative flex w-full gap-0.5 px-4 pt-6 md:px-6">
                  <h1 className="text-md font-semibold text-primary md:text-lg">Notifications</h1>
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
                      <p className="text-sm text-tertiary">No notifications yet</p>
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
              <Avatar alt="User" src="https://www.untitledui.com/images/avatars/olivia-rhye?bg=%23E0E0E0" size="md" />
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
              <NavAccountMenu />
            </Popover>
          </DialogTrigger>
        </div>
      </div>
    </header>
  );
}
