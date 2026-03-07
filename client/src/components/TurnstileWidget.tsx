import { useEffect, useRef, useCallback, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
    };
  }
}

let turnstileToken: string | null = null;

export function getTurnstileToken(): string | null {
  return turnstileToken;
}

export function clearTurnstileToken(): void {
  turnstileToken = null;
}

interface TurnstileWidgetProps {
  siteKey?: string;
  onVerify?: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "invisible";
  className?: string;
}

export function TurnstileWidget({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = "auto",
  size = "normal",
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const effectiveKey =
    siteKey ||
    (typeof import.meta !== "undefined" &&
      (import.meta as unknown as { env?: Record<string, string> }).env
        ?.VITE_TURNSTILE_SITE_KEY) ||
    "1x00000000000000000000AA"; // Cloudflare always-pass test key

  useEffect(() => {
    if (!containerRef.current || !window.turnstile) return;

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: effectiveKey,
      theme,
      size,
      callback: (token: string) => {
        turnstileToken = token;
        onVerify?.(token);
      },
      "error-callback": () => {
        turnstileToken = null;
        onError?.();
      },
      "expired-callback": () => {
        turnstileToken = null;
        onExpire?.();
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [effectiveKey, theme, size, onVerify, onError, onExpire]);

  return <div ref={containerRef} className={className} />;
}

export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);

  const onVerify = useCallback((t: string) => {
    setToken(t);
    turnstileToken = t;
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    turnstileToken = null;
  }, []);

  const getToken = useCallback(() => turnstileToken, []);

  return { token, onVerify, reset, getToken };
}
