"use client";

import type { ReactNode } from "react";
import React, { useEffect, useCallback } from "react";
import { cx } from "@/utils/cx";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) => {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-overlay/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={cx(
            "relative w-full rounded-xl bg-primary shadow-xl ring-1 ring-primary dark:bg-[#1f2530]",
            sizeStyles[size]
          )}
          role="dialog"
          aria-modal="true"
        >
          {(title || description) && (
            <div className="border-b border-secondary px-6 py-5">
              {title && (
                <h3 className="text-lg font-semibold text-primary">{title}</h3>
              )}
              {description && (
                <p className="mt-1 text-sm text-tertiary">{description}</p>
              )}
            </div>
          )}
          <div className="px-6 py-5">{children}</div>
          {footer && (
            <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
