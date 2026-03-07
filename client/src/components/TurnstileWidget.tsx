
import { useEffect, useRef, useCallback, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
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

export function TurnstileWidget({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = "light",
  size = "normal",
  className = "",
}: {
  siteKey?: string;
  onVerify?: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const key = siteKey || (typeof window !== "undefined" ? (window as any).__TURNSTILE_SITE_KEY : undefined);

  useEffect(() => {
    if (!key || !containerRef.current || !window.turnstile) return;

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: key,
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
  }, [key, theme, size]);

  if (!key) return null;

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

  return { token, onVerify, reset, getToken: getTurnstileToken };
}
