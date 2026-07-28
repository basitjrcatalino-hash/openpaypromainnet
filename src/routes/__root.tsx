import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SplashScreen } from "@/components/splash-screen";
import { supabase } from "@/integrations/supabase/client";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  missingSupabaseEnvMessage,
} from "@/integrations/supabase/env";
import { MoonPayProvider } from "@moonpay/moonpay-react";
import { MOONPAY_API_KEY, MOONPAY_DEBUG } from "@/lib/moonpay";
import { AppPhantomProvider } from "@/components/phantom-provider";

async function ensureBrowserSupabaseConfig() {
  if (typeof window === "undefined") return;
  if (getSupabaseUrl() && getSupabasePublishableKey()) return;

  const res = await fetch("/api/public/supabase-config");
  if (!res.ok) {
    throw new Error(`Could not load Supabase config (HTTP ${res.status}).`);
  }
  const cfg = (await res.json()) as { url?: string | null; publishableKey?: string | null };
  if (!cfg.url || !cfg.publishableKey) {
    throw new Error(
      missingSupabaseEnvMessage([
        ...(!cfg.url ? ["SUPABASE_URL"] : []),
        ...(!cfg.publishableKey ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
      ]),
    );
  }
  (window as unknown as { __OPENPAY_PUBLIC__?: { url: string; publishableKey: string } })
    .__OPENPAY_PUBLIC__ = {
    url: cfg.url,
    publishableKey: cfg.publishableKey,
  };
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-hero-glow px-4">
      <div className="glass max-w-md rounded-3xl p-10 text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That route doesn't exist in OpenPay Pro Wallet.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-primary px-6 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          Back to wallet
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const detail = error?.message?.trim() || "";

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass max-w-md rounded-3xl p-8 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't load that part of the wallet.
        </p>
        {detail ? (
          <p className="mt-3 wrap-break-word rounded-xl border border-border/60 bg-card/50 px-3 py-2 text-left text-xs text-muted-foreground">
            {detail}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-border bg-card px-5 py-2 text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async () => {
    // Runs before child routes that touch supabase (auth gate, index redirect).
    await ensureBrowserSupabaseConfig();
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1a1330" },
      { title: "OpenPay Pro Wallet" },
      {
        name: "description",
        content:
          "OpenPay Pro Wallet is a next-generation Web3 wallet built for the OpenPay ecosystem, giving users full control of their digital assets, tokens, NFTs, and stable",
      },
      { property: "og:title", content: "OpenPay Pro Wallet" },
      { name: "twitter:title", content: "OpenPay Pro Wallet" },
      {
        property: "og:description",
        content:
          "OpenPay Pro Wallet is a next-generation Web3 wallet built for the OpenPay ecosystem, giving users full control of their digital assets, tokens, NFTs, and stable",
      },
      {
        name: "twitter:description",
        content:
          "OpenPay Pro Wallet is a next-generation Web3 wallet built for the OpenPay ecosystem, giving users full control of their digital assets, tokens, NFTs, and stable",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d9cde8a5-4047-4067-b26c-a3e35f846b50/id-preview-c50b7170--40ad0ae1-ff1c-4197-a965-091db4920f62.lovable.app-1785229551414.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d9cde8a5-4047-4067-b26c-a3e35f846b50/id-preview-c50b7170--40ad0ae1-ff1c-4197-a965-091db4920f62.lovable.app-1785229551414.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Apply saved dashboard theme before paint so /docs and all routes match. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("openpay-theme");var dark=t==="dark";document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light";}})();`,
          }}
        />
        {/* Early Buffer stub so Solana/Phantom chunks don't crash before the polyfill module runs. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.global=window.global||window;window.process=window.process||{env:{}};`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MoonPayProvider apiKey={MOONPAY_API_KEY} debug={MOONPAY_DEBUG}>
          <AppPhantomProvider>
            <SplashScreen />
            <Outlet />
            <Toaster richColors position="top-right" />
          </AppPhantomProvider>
        </MoonPayProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
