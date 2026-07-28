"use client";

import * as React from "react";
import { useEffect, useState, type ErrorInfo, type ReactNode } from "react";

import { WEB3AUTH_CLIENT_ID } from "@/lib/web3auth-env";

type Web3AuthProviderComponent = React.ComponentType<{
  config: unknown;
  children?: ReactNode;
}>;

/**
 * Client-only Web3Auth wrapper.
 * Never static-import `@web3auth/modal/react` from auth routes — that graph can throw
 * "Class extends value undefined is not a constructor or null" (events / SafeEventEmitter)
 * during ESM init and blank the whole auth screen.
 */
class Web3AuthBoundary extends React.Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("[web3auth] provider crashed", error);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function AppWeb3AuthProvider({ children }: { children: ReactNode }) {
  const [Provider, setProvider] = useState<Web3AuthProviderComponent | null>(null);
  const [config, setConfig] = useState<unknown>(null);

  useEffect(() => {
    if (!WEB3AUTH_CLIENT_ID) return;
    let cancelled = false;
    void (async () => {
      try {
        const { ensureBuffer } = await import("@/lib/buffer-polyfill");
        await ensureBuffer();

        const { getWeb3AuthContextConfig } = await import("@/lib/web3auth-config");
        const cfg = getWeb3AuthContextConfig();
        const mod = await import("@web3auth/modal/react");
        if (cancelled) return;
        if (typeof mod.Web3AuthProvider !== "function") {
          throw new Error("Web3AuthProvider export missing");
        }
        setConfig(cfg);
        setProvider(() => mod.Web3AuthProvider as Web3AuthProviderComponent);
      } catch (err) {
        console.error("[web3auth] failed to load SDK", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Provider || !config) {
    return <>{children}</>;
  }

  return (
    <Web3AuthBoundary fallback={children}>
      <Provider config={config}>{children}</Provider>
    </Web3AuthBoundary>
  );
}
