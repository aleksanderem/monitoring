"use client";

import { Bell01, Settings01 } from "@untitledui/icons";
import { Button as AriaButton, DialogTrigger, Popover } from "react-aria-components";
import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";
import { NavAccountMenu } from "./base-components/nav-account-card";
import { NavItemButton } from "./base-components/nav-item-button";

interface TopBarProps {
  activeUrl?: string;
}

export function TopBar({ activeUrl }: TopBarProps) {
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
            <NavItemButton
              current={activeUrl === "/notifications"}
              size="md"
              icon={Bell01}
              label="Notifications"
              href="/notifications"
              tooltipPlacement="bottom"
            />
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
