"use client";

import * as React from "react";
import { useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { WEB3AUTH_CLIENT_ID } from "@/lib/web3auth-env";

type Web3AuthProviderComponent = React.ComponentType<{
  config: unknown;
  children?: ReactNode;
}>;

/**
 * Client-only Web3Auth wrapper.
 * Never static-import `@web3auth/modal/react` from auth routes — that graph can throw
 * during ESM init. Also never render MetaMask hooks until the provider is mounted.
 */
class Web3AuthBoundary extends React.Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean; message: string }
> {
  state = { failed: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { failed: true, message: error?.message || "MetaMask Embedded crashed" };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("[web3auth] provider crashed", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="space-y-2">
          {this.props.fallback}
          <p className="text-center text-[11px] text-destructive">
            {this.state.message || "MetaMask Embedded failed to start"}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AppWeb3AuthProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  /** Shown while SDK loads — do not put Web3Auth hooks here. */
  fallback?: ReactNode;
}) {
  const [Provider, setProvider] = useState<Web3AuthProviderComponent | null>(null);
  const [config, setConfig] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!WEB3AUTH_CLIENT_ID) {
      setError("Missing VITE_WEB3AUTH_CLIENT_ID");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { ensureBuffer } = await import("@/lib/buffer-polyfill");
        await ensureBuffer();
        // Named-export shims must load before Web3Auth / Torus graph.
        await import("@/shims/events");
        await import("@/shims/loglevel");
        await import("@/shims/deepmerge");

        const { getWeb3AuthContextConfig } = await import("@/lib/web3auth-config");
        const cfg = getWeb3AuthContextConfig();
        const mod = await import("@web3auth/modal/react");
        if (cancelled) return;
        if (typeof mod.Web3AuthProvider !== "function") {
          throw new Error("Web3AuthProvider export missing");
        }
        setConfig(cfg);
        setProvider(() => mod.Web3AuthProvider as Web3AuthProviderComponent);
        setError(null);
      } catch (err) {
        console.error("[web3auth] failed to load SDK", err);
        if (!cancelled) {
          setError((err as Error)?.message || "Could not load MetaMask Embedded");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadingUi = fallback ?? (
    <div className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-muted/40 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading MetaMask…
    </div>
  );

  if (error) {
    return (
      <div className="space-y-2">
        {loadingUi}
        <p className="text-center text-[11px] text-destructive">{error}</p>
      </div>
    );
  }

  if (!Provider || !config) {
    return <>{loadingUi}</>;
  }

  return (
    <Web3AuthBoundary fallback={loadingUi}>
      <Provider config={config}>{children}</Provider>
    </Web3AuthBoundary>
  );
}
