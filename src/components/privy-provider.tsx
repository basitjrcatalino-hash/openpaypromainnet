"use client";

import { type ReactNode, useEffect, useState } from "react";
import { PRIVY_APP_ID } from "@/lib/privy-auth";

type PrivyProviderComponent = React.ComponentType<{
  appId: string;
  config?: unknown;
  children?: ReactNode;
}>;

/**
 * Lazy-loaded Privy provider — only imports the SDK when VITE_PRIVY_APP_ID is set.
 * Prevents bundle bloat on builds without Privy.
 */
export function AppPrivyProvider({ children }: { children: ReactNode }) {
  const [Provider, setProvider] = useState<PrivyProviderComponent | null>(null);

  useEffect(() => {
    if (!PRIVY_APP_ID) return;
    let cancelled = false;
    void (async () => {
      try {
        const mod = await import("@privy-io/react-auth");
        if (!cancelled) {
          setProvider(() => mod.PrivyProvider as unknown as PrivyProviderComponent);
        }
      } catch (err) {
        console.error("[privy] Failed to load SDK", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!PRIVY_APP_ID || !Provider) {
    return <>{children}</>;
  }

  return (
    <Provider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#6851FF",
        },
        loginMethods: ["email", "google", "apple", "twitter", "discord", "github", "sms"],
        embeddedWallets: {
          createOnLogin: "off",
        },
      }}
    >
      {children}
    </Provider>
  );
}
