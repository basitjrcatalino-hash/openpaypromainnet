"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import type { PhantomSDKConfig } from "@phantom/react-sdk";
import "@/lib/buffer-polyfill";
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
    config: PhantomSDKConfig;
    theme?: unknown;
    appIcon?: string;
    appName?: string;
    children?: ReactNode;
  }>;
  darkTheme: unknown;
};

/**
 * Client-only Phantom Connect provider.
 * Dynamically imports the SDK after Buffer is polyfilled so production does not
 * crash with: Cannot read properties of undefined (reading 'from').
 */
export function AppPhantomProvider({ children }: { children: ReactNode }) {
  const [sdk, setSdk] = useState<PhantomSdk | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Ensure Buffer exists before any @solana/web3.js / Phantom module init.
      await import("@/lib/buffer-polyfill");
      const mod = await import("@phantom/react-sdk");
      if (cancelled) return;
      setSdk({
        PhantomProvider: mod.PhantomProvider,
        darkTheme: mod.darkTheme,
      });
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
