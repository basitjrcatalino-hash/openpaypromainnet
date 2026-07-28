"use client";

import {
  createContext,
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

const PhantomClientReadyContext = createContext(false);

export function usePhantomClientReady() {
  return useContext(PhantomClientReadyContext);
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

  useEffect(() => {
    let cancelled = false;
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
      } catch (err) {
        console.error("[phantom] failed to init", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sdk) {
    return (
      <PhantomClientReadyContext.Provider value={false}>{children}</PhantomClientReadyContext.Provider>
    );
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
      <PhantomClientReadyContext.Provider value={true}>{children}</PhantomClientReadyContext.Provider>
    </PhantomProvider>
  );
}
