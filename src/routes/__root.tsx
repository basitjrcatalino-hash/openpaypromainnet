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
      { name: "theme-color", content: "#000000" },
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved dashboard theme before paint so /docs and all routes match. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("openpay-theme");var dark=t!=="light";document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}})();`,
          }}
        />
        {/* Early globals + Buffer stub so Phantom/Solana never see undefined Buffer.from.
            Marked __openpayStub so ensureBuffer() always upgrades to the real package. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var g=typeof globalThis!=="undefined"?globalThis:window;g.global=g.global||g;g.process=g.process||{env:{}};if(g.Buffer&&typeof g.Buffer.from==="function"&&!g.Buffer.__openpayStub&&typeof g.Buffer.allocUnsafe==="function")return;function from(v,e){if(typeof v==="string"){if(e==="base64"||e==="base64url"){var s=e==="base64url"?v.replace(/-/g,"+").replace(/_/g,"/"):v;while(s.length%4)s+="=";var b=atob(s),o=new Uint8Array(b.length);for(var i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}if(e==="hex"){var h=v.length%2?"0"+v:v,u=new Uint8Array(h.length/2);for(var j=0;j<u.length;j++)u[j]=parseInt(h.substr(j*2,2),16);return u}return(new TextEncoder).encode(v)}if(v instanceof ArrayBuffer)return new Uint8Array(v);if(ArrayBuffer.isView(v))return new Uint8Array(v.buffer,v.byteOffset,v.byteLength);if(Array.isArray(v))return Uint8Array.from(v);return new Uint8Array(0)}function B(a,e){if(!(this instanceof B))return from(a,e);var x=from(a,e);this.length=x.length;for(var i=0;i<x.length;i++)this[i]=x[i]}B.from=from;B.isBuffer=function(x){return x instanceof B};B.alloc=function(n){return new Uint8Array(n||0)};B.allocUnsafe=B.alloc;B.concat=function(list){var n=0,i=0;for(;i<list.length;i++)n+=list[i].length;var out=new Uint8Array(n),o=0;for(i=0;i<list.length;i++){out.set(list[i],o);o+=list[i].length}return out};B.__openpayStub=1;g.Buffer=B;if(typeof window!=="undefined")window.Buffer=B}catch(e){}})();`,
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
