"use client";

import * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  getPhantomProviderConfig,
  PHANTOM_APP_ICON,
  PHANTOM_APP_NAME,
} from "@/lib/phantom";

type PhantomStatus = "loading" | "ready" | "error";

type PhantomClientState = {
  ready: boolean;
  status: PhantomStatus;
  error: string | null;
  retry: () => void;
};

const PhantomClientContext = createContext<PhantomClientState>({
  ready: false,
  status: "loading",
  error: null,
  retry: () => {},
});

export function usePhantomClientReady() {
  return useContext(PhantomClientContext).ready;
}

export function usePhantomClient() {
  return useContext(PhantomClientContext);
}

type PhantomSdk = {
  PhantomProvider: ComponentType<{
    config: Record<string, unknown>;
    theme?: unknown;
    appIcon?: string;
    appName?: string;
    children?: ReactNode;
  }>;
  darkTheme: unknown;
};

/** Use React.Component (namespace) — named `Component` can be undefined under circular ESM init. */
class PhantomRenderBoundary extends React.Component<
  {
    children: ReactNode;
    fallback: ReactNode;
    onError: (message: string) => void;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("[phantom] provider render failed", error);
    this.props.onError(error?.message || "Phantom Connect crashed while loading");
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

/**
 * Client-only Phantom Connect provider.
 * Loads Buffer first, then the SDK — keeps CJS `buffer` / @phantom off the SSR graph.
 */
export function AppPhantomProvider({ children }: { children: ReactNode }) {
  const [sdk, setSdk] = useState<PhantomSdk | null>(null);
  const [status, setStatus] = useState<PhantomStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setSdk(null);
    setError(null);
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  const onProviderError = useCallback((message: string) => {
    setSdk(null);
    setStatus("error");
    const friendly = /reading 'from'|Buffer/i.test(message)
      ? "Wallet runtime failed to load (Buffer). Retry, or use Solana sign-in."
      : message;
    setError(friendly);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setStatus((s) => {
        if (s === "ready") return s;
        setError((e) => e || "Phantom SDK is taking too long to load. Retry or use Solana sign-in.");
        return "error";
      });
    }, 12_000);

    void (async () => {
      try {
        const { ensureBuffer } = await import("@/lib/buffer-polyfill");
        await ensureBuffer();

        // Prefer the real feross/buffer — stub alone breaks Phantom at runtime.
        const Buf = (globalThis as { Buffer?: { from?: unknown; __openpayStub?: unknown } }).Buffer;
        if (typeof Buf?.from !== "function") {
          throw new Error("Buffer.from is not available in this browser");
        }
        if (Buf.__openpayStub) {
          throw new Error("Buffer polyfill did not upgrade past the early stub");
        }

        const mod = await import("@phantom/react-sdk");
        if (cancelled) return;
        setSdk({
          PhantomProvider: mod.PhantomProvider as PhantomSdk["PhantomProvider"],
          darkTheme: mod.darkTheme,
        });
        setStatus("ready");
        setError(null);
      } catch (err) {
        console.error("[phantom] failed to init", err);
        if (cancelled) return;
        setSdk(null);
        setStatus("error");
        const raw = (err as Error)?.message || "Could not load Phantom Connect";
        const friendly = /reading 'from'|Buffer|polyfill|stub/i.test(raw)
          ? "Wallet runtime failed to load (Buffer). Retry, or use Solana sign-in."
          : raw;
        setError(friendly);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [attempt]);

  const ctx: PhantomClientState = {
    ready: status === "ready" && Boolean(sdk),
    status,
    error,
    retry,
  };

  const Provider = sdk?.PhantomProvider;
  // Capture redirect URL once when SDK becomes ready so OAuth state matches callback origin.
  const config = useMemo(
    () => (sdk ? getPhantomProviderConfig() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when sdk instance appears
    [sdk],
  );

  return (
    <PhantomClientContext.Provider value={ctx}>
      {sdk && Provider && config ? (
        <PhantomRenderBoundary fallback={children} onError={onProviderError}>
          <Provider
            config={config}
            theme={sdk.darkTheme}
            appIcon={PHANTOM_APP_ICON}
            appName={PHANTOM_APP_NAME}
          >
            {children}
          </Provider>
        </PhantomRenderBoundary>
      ) : (
        children
      )}
    </PhantomClientContext.Provider>
  );
}
