"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw05 } from "@untitledui/icons";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown in the fallback UI title */
  label?: string;
  /** Maximum number of automatic retries before stopping. Default 3. */
  maxRetries?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  /** Seconds remaining until next auto-retry, or null if not auto-retrying */
  countdown: number | null;
}

/** Base delay in ms for exponential backoff. Retry delay = BASE * 2^retryCount */
const BACKOFF_BASE_MS = 1000;

/**
 * Catches render errors in descendant components and displays a fallback UI
 * instead of a blank page. Supports automatic retry with exponential backoff.
 * Place at layout or section boundaries.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0, countdown: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.label || "unknown", error, errorInfo);
    this.scheduleAutoRetry();
  }

  componentWillUnmount() {
    this.clearTimers();
  }

  private clearTimers() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private scheduleAutoRetry() {
    const maxRetries = this.props.maxRetries ?? 3;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) return;

    const delayMs = BACKOFF_BASE_MS * Math.pow(2, retryCount);
    const countdownSeconds = Math.ceil(delayMs / 1000);

    this.setState({ countdown: countdownSeconds });

    this.countdownTimer = setInterval(() => {
      this.setState((prev) => {
        const next = (prev.countdown ?? 1) - 1;
        if (next <= 0) {
          this.clearTimers();
          return { countdown: null };
        }
        return { countdown: next };
      });
    }, 1000);

    this.retryTimer = setTimeout(() => {
      this.clearTimers();
      this.setState((prev) => ({
        hasError: false,
        error: null,
        retryCount: prev.retryCount + 1,
        countdown: null,
      }));
    }, delayMs);
  }

  handleRetry = () => {
    this.clearTimers();
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
      countdown: null,
    }));
  };

  render() {
    if (this.state.hasError) {
      const maxRetries = this.props.maxRetries ?? 3;
      const exhausted = this.state.retryCount >= maxRetries;
      const { countdown } = this.state;

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-4 rounded-xl border border-utility-error-200 bg-utility-error-50 p-8 text-center dark:border-utility-error-700 dark:bg-utility-error-950"
        >
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
            {countdown !== null && !exhausted && (
              <p className="mt-2 text-xs text-utility-error-500 dark:text-utility-error-400">
                Retrying in {countdown}s...
              </p>
            )}
          </div>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-utility-error-300 bg-white px-3 py-1.5 text-xs font-medium text-utility-error-700 transition-colors hover:bg-utility-error-50 dark:border-utility-error-600 dark:bg-utility-error-900 dark:text-utility-error-300 dark:hover:bg-utility-error-800"
          >
            <RefreshCw05 className="h-3.5 w-3.5" />
            {countdown !== null ? "Retry now" : "Try again"}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
