"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentType,
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
        setError((err as Error)?.message || "Could not load Phantom Connect");
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

  if (!sdk) {
    return <PhantomClientContext.Provider value={ctx}>{children}</PhantomClientContext.Provider>;
  }

  const { PhantomProvider, darkTheme } = sdk;
  const config = getPhantomProviderConfig();

  return (
    <PhantomProvider
      config={config}
      theme={darkTheme}
      appIcon={PHANTOM_APP_ICON}
      appName={PHANTOM_APP_NAME}
    >
      <PhantomClientContext.Provider value={ctx}>{children}</PhantomClientContext.Provider>
    </PhantomProvider>
  );
}
