"use client";

import type { FC, HTMLAttributes } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { Placement } from "@react-types/overlays";
import { BookOpen01, ChevronSelectorVertical, LogOut01, Settings01, Shield01, User01 } from "@untitledui/icons";
import { useFocusManager } from "react-aria";
import type { DialogProps as AriaDialogProps } from "react-aria-components";
import { Button as AriaButton, Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../../convex/_generated/api";
import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cx } from "@/utils/cx";

export const NavAccountMenu = ({
    className,
    onSignOut,
    userName,
    userEmail,
    isSuperAdmin,
    ...dialogProps
}: AriaDialogProps & {
    className?: string;
    onSignOut?: () => void;
    userName?: string;
    userEmail?: string;
    isSuperAdmin?: boolean;
}) => {
    const focusManager = useFocusManager();
    const dialogRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            switch (e.key) {
                case "ArrowDown":
                    focusManager?.focusNext({ tabbable: true, wrap: true });
                    break;
                case "ArrowUp":
                    focusManager?.focusPrevious({ tabbable: true, wrap: true });
                    break;
            }
        },
        [focusManager],
    );

    useEffect(() => {
        const element = dialogRef.current;
        if (element) {
            element.addEventListener("keydown", onKeyDown);
        }

        return () => {
            if (element) {
                element.removeEventListener("keydown", onKeyDown);
            }
        };
    }, [onKeyDown]);

    return (
        <AriaDialog
            {...dialogProps}
            ref={dialogRef}
            className={cx("w-66 rounded-xl bg-secondary_alt shadow-lg ring ring-secondary_alt outline-hidden", className)}
        >
            <div className="rounded-xl bg-primary ring-1 ring-secondary">
                {/* User info header */}
                <div className="border-b border-secondary px-3 py-3">
                    <p className="text-sm font-semibold text-primary">{userName || "User"}</p>
                    <p className="text-xs text-tertiary">{userEmail || ""}</p>
                </div>

                <div className="flex flex-col gap-0.5 py-1.5">
                    <NavAccountCardMenuItem label="Account settings" icon={Settings01} onClick={() => router.push("/settings")} />
                    {isSuperAdmin && (
                        <NavAccountCardMenuItem label="Admin panel" icon={Shield01} onClick={() => router.push("/admin")} />
                    )}
                </div>
            </div>

            <div className="pt-1 pb-1.5">
                <NavAccountCardMenuItem label="Sign out" icon={LogOut01} onClick={onSignOut} />
            </div>
        </AriaDialog>
    );
};

const NavAccountCardMenuItem = ({
    icon: Icon,
    label,
    shortcut,
    ...buttonProps
}: {
    icon?: FC<{ className?: string }>;
    label: string;
    shortcut?: string;
} & HTMLAttributes<HTMLButtonElement>) => {
    return (
        <button {...buttonProps} className={cx("group/item w-full cursor-pointer px-1.5 focus:outline-hidden", buttonProps.className)}>
            <div
                className={cx(
                    "flex w-full items-center justify-between gap-3 rounded-md p-2 group-hover/item:bg-primary_hover",
                    // Focus styles.
                    "outline-focus-ring group-focus-visible/item:outline-2 group-focus-visible/item:outline-offset-2",
                )}
            >
                <div className="flex gap-2 text-sm font-semibold text-secondary group-hover/item:text-secondary_hover">
                    {Icon && <Icon className="size-5 text-fg-quaternary" />} {label}
                </div>

                {shortcut && (
                    <kbd className="flex rounded px-1 py-px font-body text-xs font-medium text-tertiary ring-1 ring-secondary ring-inset">{shortcut}</kbd>
                )}
            </div>
        </button>
    );
};

function getInitials(name?: string | null, email?: string | null): string {
    if (name) {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    }
    if (email) {
        return email[0].toUpperCase();
    }
    return "U";
}

export const NavAccountCard = ({
    popoverPlacement,
}: {
    popoverPlacement?: Placement;
}) => {
    const triggerRef = useRef<HTMLDivElement>(null);
    const isDesktop = useBreakpoint("lg");
    const currentUser = useQuery(api.auth.getCurrentUser);
    const isSuperAdmin = useQuery(api.admin.checkIsSuperAdmin);
    const { signOut } = useAuthActions();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut();
        router.push("/login");
    };

    const userName = currentUser?.name || null;
    const userEmail = currentUser?.email || null;
    const userImage = currentUser?.image || null;
    const initials = getInitials(userName, userEmail);

    return (
        <div ref={triggerRef} className="relative flex items-center gap-3 rounded-xl p-3 ring-1 ring-secondary ring-inset">
            <AvatarLabelGroup
                size="md"
                src={userImage ?? undefined}
                title={userName || userEmail || "User"}
                subtitle={userName ? (userEmail || "") : ""}
                status="online"
                alt={initials}
            />

            <div className="absolute top-1.5 right-1.5">
                <AriaDialogTrigger>
                    <AriaButton className="flex cursor-pointer items-center justify-center rounded-md p-1.5 text-fg-quaternary outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2 pressed:bg-primary_hover pressed:text-fg-quaternary_hover">
                        <ChevronSelectorVertical className="size-4 shrink-0" />
                    </AriaButton>
                    <AriaPopover
                        placement={popoverPlacement ?? (isDesktop ? "right bottom" : "top right")}
                        triggerRef={triggerRef}
                        offset={8}
                        className={({ isEntering, isExiting }) =>
                            cx(
                                "origin-(--trigger-anchor-point) will-change-transform",
                                isEntering &&
                                    "duration-150 ease-out animate-in fade-in placement-right:slide-in-from-left-0.5 placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5",
                                isExiting &&
                                    "duration-100 ease-in animate-out fade-out placement-right:slide-out-to-left-0.5 placement-top:slide-out-to-bottom-0.5 placement-bottom:slide-out-to-top-0.5",
                            )
                        }
                    >
                        <NavAccountMenu
                            onSignOut={handleSignOut}
                            userName={userName ?? undefined}
                            userEmail={userEmail ?? undefined}
                            isSuperAdmin={isSuperAdmin === true}
                        />
                    </AriaPopover>
                </AriaDialogTrigger>
            </div>
        </div>
    );
};
