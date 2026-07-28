"use client";

import * as React from "react";
import { lazy, Suspense, useState, type ErrorInfo, type ReactNode } from "react";
import { MOONPAY_API_KEY, MOONPAY_DEBUG } from "@/lib/moonpay";

/**
 * Client-only MoonPay wrapper.
 * Never static-import `@moonpay/moonpay-react` from `__root` — its bundle has
 * `class Logger2 extends Logger` which can throw
 * "Class extends value undefined is not a constructor or null" under Vite ESM
 * circular init and blank every route (docs, settings, etc.).
 */
const MoonPayProviderLazy = lazy(async () => {
  try {
    const mod = await import("@moonpay/moonpay-react");
    if (!mod?.MoonPayProvider) {
      throw new Error("MoonPayProvider export missing");
    }
    return { default: mod.MoonPayProvider };
  } catch (err) {
    console.error("[moonpay] failed to load SDK", err);
    function Passthrough({ children }: { children?: ReactNode }) {
      return <>{children}</>;
    }
    return { default: Passthrough };
  }
});

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
  const [enabled] = useState(() => typeof window !== "undefined");

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <MoonPayBoundary fallback={children}>
      <Suspense fallback={<>{children}</>}>
        <MoonPayProviderLazy apiKey={MOONPAY_API_KEY} debug={MOONPAY_DEBUG}>
          {children}
        </MoonPayProviderLazy>
      </Suspense>
    </MoonPayBoundary>
  );
}
