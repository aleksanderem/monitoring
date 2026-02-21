"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw05 } from "@untitledui/icons";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown in the fallback UI title */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors in descendant components and displays a fallback UI
 * instead of a blank page. Place at layout or section boundaries.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.label || "unknown", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-utility-error-200 bg-utility-error-50 p-8 text-center dark:border-utility-error-700 dark:bg-utility-error-950">
          <AlertTriangle className="h-8 w-8 text-utility-error-600" />
          <div>
            <h3 className="text-sm font-semibold text-utility-error-700 dark:text-utility-error-300">
              {this.props.label
                ? `Something went wrong in "${this.props.label}"`
                : "Something went wrong"}
            </h3>
            {this.state.error && (
              <p className="mt-1 text-xs text-utility-error-600 dark:text-utility-error-400">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-utility-error-300 bg-white px-3 py-1.5 text-xs font-medium text-utility-error-700 transition-colors hover:bg-utility-error-50 dark:border-utility-error-600 dark:bg-utility-error-900 dark:text-utility-error-300 dark:hover:bg-utility-error-800"
          >
            <RefreshCw05 className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
