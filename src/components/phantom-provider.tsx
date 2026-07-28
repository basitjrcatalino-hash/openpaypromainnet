"use client";

import { createContext, useContext, type ReactNode, useEffect, useMemo, useState } from "react";
import { PhantomProvider, darkTheme } from "@phantom/react-sdk";
import {
  getPhantomProviderConfig,
  PHANTOM_APP_ICON,
  PHANTOM_APP_NAME,
} from "@/lib/phantom";

const PhantomClientReadyContext = createContext(false);

export function usePhantomClientReady() {
  return useContext(PhantomClientReadyContext);
}

/**
 * Client-only Phantom Connect provider (avoids SSR/window issues).
 * redirectUrl is derived from window.location.origin so it matches the
 * environment you're actually running (Lovable / Vercel / local / custom domain).
 */
export function AppPhantomProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const config = useMemo(() => (ready ? getPhantomProviderConfig() : null), [ready]);

  if (!ready || !config) {
    return (
      <PhantomClientReadyContext.Provider value={false}>{children}</PhantomClientReadyContext.Provider>
    );
  }

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
