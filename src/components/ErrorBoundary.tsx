"use client";

import { Component, type ReactNode } from "react";
import { AlertFloating } from "@/components/application/alerts/alerts";

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

      const title = this.props.label
        ? `Something went wrong in "${this.props.label}"`
        : "Something went wrong";

      const description = (
        <>
          {this.state.error?.message}
          {countdown !== null && !exhausted && (
            <span className="ml-1 text-tertiary">
              — retrying in {countdown}s…
            </span>
          )}
        </>
      );

      return (
        <AlertFloating
          color="error"
          title={title}
          description={description}
          confirmLabel={countdown !== null ? "Retry now" : "Try again"}
          onConfirm={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
