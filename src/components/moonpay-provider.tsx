"use client";

import * as React from "react";
import { useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { MOONPAY_API_KEY, MOONPAY_DEBUG } from "@/lib/moonpay";

type MoonPayProviderComponent = React.ComponentType<{
  apiKey: string;
  debug?: boolean;
  children?: ReactNode;
}>;

/**
 * Client-only MoonPay wrapper.
 * Never static-import `@moonpay/moonpay-react` from `__root` — that package can throw
 * "Class extends value undefined is not a constructor or null" during Vite ESM init
 * and blank every route (docs, settings, etc.).
 */
class MoonPayBoundary extends React.Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("[moonpay] provider crashed", error);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function AppMoonPayProvider({ children }: { children: ReactNode }) {
  const [Provider, setProvider] = useState<MoonPayProviderComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mod = await import("@moonpay/moonpay-react");
        if (cancelled) return;
        if (typeof mod.MoonPayProvider !== "function") {
          throw new Error("MoonPayProvider export missing");
        }
        setProvider(() => mod.MoonPayProvider as MoonPayProviderComponent);
      } catch (err) {
        console.error("[moonpay] failed to load SDK", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Provider) {
    return <>{children}</>;
  }

  return (
    <MoonPayBoundary fallback={children}>
      <Provider apiKey={MOONPAY_API_KEY} debug={MOONPAY_DEBUG}>
        {children}
      </Provider>
    </MoonPayBoundary>
  );
}
