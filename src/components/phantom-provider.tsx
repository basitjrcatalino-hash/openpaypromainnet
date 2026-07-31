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
  PHANTOM_APP_ID,
  PHANTOM_APP_NAME,
  PHANTOM_PROVIDERS,
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
  AddressType: { solana: string; ethereum: string; sui?: string };
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

function friendlyPhantomError(raw: string): string {
  if (/reading 'from'|Buffer|polyfill|stub/i.test(raw)) {
    return "Wallet runtime failed to load (Buffer). Retry, or use Solana sign-in.";
  }
  if (/app.?id|unauthorized|forbidden|403|401/i.test(raw)) {
    return `Phantom rejected App ID ${PHANTOM_APP_ID}. Check Phantom Portal Set Up + Allowed Origins.`;
  }
  if (/failed to fetch|networkerror|cors|load failed/i.test(raw)) {
    return "Phantom blocked this origin. Add this site’s origin and /auth/callback in Phantom Portal.";
  }
  return raw;
}

/**
 * Client-only Phantom Connect provider.
 * Docs: https://docs.phantom.com/sdks/react-sdk
 * App: https://phantom.com/portal/apps/42ba7350-53ef-4b1e-aba6-43f7905b094e/phantom-connect
 *
 * Loads Buffer first, then the SDK — keeps @phantom off the SSR graph.
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
    setError(friendlyPhantomError(message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setStatus((s) => (s === "ready" ? s : "error"));
      setError((e) => e || "Phantom SDK is taking too long to load. Retry or use Solana sign-in.");
    }, 15_000);

    void (async () => {
      try {
        // 1) Buffer must exist for every `import { Buffer } from "buffer"` inside Phantom.
        const { ensureBuffer } = await import("@/lib/buffer-polyfill");
        await ensureBuffer();
        const { installBufferGlobal } = await import("@/shims/buffer");
        installBufferGlobal();

        const Buf = (globalThis as { Buffer?: { from?: unknown } }).Buffer;
        if (typeof Buf?.from !== "function") {
          throw new Error("Buffer.from is not available in this browser");
        }

        // 2) Load Phantom Connect React SDK (client-only)
        // https://docs.phantom.com/sdks/react-sdk/connect
        const mod = await import("@phantom/react-sdk");
        if (cancelled) return;

        const AddressType = (mod as { AddressType?: PhantomSdk["AddressType"] }).AddressType;
        setSdk({
          PhantomProvider: mod.PhantomProvider as PhantomSdk["PhantomProvider"],
          darkTheme: mod.darkTheme,
          AddressType: AddressType ?? {
            solana: "Solana",
            ethereum: "Ethereum",
          },
        });
        setStatus("ready");
        setError(null);
      } catch (err) {
        console.error("[phantom] failed to init", err);
        if (cancelled) return;
        setSdk(null);
        setStatus("error");
        setError(friendlyPhantomError((err as Error)?.message || "Could not load Phantom Connect"));
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
  const config = useMemo(() => {
    if (!sdk) return null;
    const base = getPhantomProviderConfig();
    // Prefer official AddressType enums from the SDK (docs: solana + ethereum).
    const addressTypes = [
      sdk.AddressType.solana,
      sdk.AddressType.ethereum,
      ...(sdk.AddressType.sui ? [sdk.AddressType.sui] : []),
    ].filter(Boolean);
    return {
      ...base,
      providers: [...PHANTOM_PROVIDERS],
      appId: PHANTOM_APP_ID,
      addressTypes: addressTypes.length ? addressTypes : base.addressTypes,
    };
  }, [sdk]);

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
