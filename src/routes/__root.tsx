import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SplashScreen } from "@/components/splash-screen";
import { RouteProgress } from "@/components/wallet/RouteProgress";
import { PageTransition } from "@/components/wallet/PageTransition";
import { supabase } from "@/integrations/supabase/client";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  missingSupabaseEnvMessage,
} from "@/integrations/supabase/env";

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
  (
    window as unknown as { __OPENPAY_PUBLIC__?: { url: string; publishableKey: string } }
  ).__OPENPAY_PUBLIC__ = {
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
  const isRenderLoop = /Minified React error #301|Too many re-renders/i.test(detail);

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass max-w-md rounded-3xl p-8 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isRenderLoop
            ? "This page hit a render loop. A full reload usually clears it."
            : "We couldn't load that part of the wallet."}
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
              if (isRenderLoop) {
                window.location.reload();
                return;
              }
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
  beforeLoad: async ({ location }) => {
    if (location.pathname.startsWith("/lovable/")) return;
    // Runs before child routes that touch supabase (auth gate, index redirect).
    await ensureBrowserSupabaseConfig();
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#000000" },
      { name: "google-site-verification", content: "EA61xEdUw8jdmGPL1g8fqZRwuWqPEGZ6-awF82kSBbw" },
      { title: "OpenPay Pro Wallet — Secure Web3 Gateway for OUSD & NFTs" },
      {
        name: "description",
        content:
          "OpenPay Pro Wallet is a Web3 wallet for the OpenPay ecosystem: hold OUSD and Pi, swap tokens, mint NFTs, and pay with full control of your keys.",
      },
      { property: "og:site_name", content: "OpenPay Pro Wallet" },
      { property: "og:title", content: "OpenPay Pro Wallet — Secure Web3 Gateway" },
      { name: "twitter:title", content: "OpenPay Pro Wallet — Secure Web3 Gateway" },
      {
        property: "og:description",
        content:
          "Hold OUSD and Pi, swap tokens, mint NFTs, and pay securely — the self-custody wallet for the OpenPay ecosystem.",
      },
      {
        name: "twitter:description",
        content:
          "Hold OUSD and Pi, swap tokens, mint NFTs, and pay securely — the self-custody wallet for the OpenPay ecosystem.",
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
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "OpenPay Pro",
              url: "https://openpaypro.space",
              logo: "https://openpaypro.space/ousd-logo.svg",
            },
            {
              "@type": "WebSite",
              name: "OpenPay Pro Wallet",
              url: "https://openpaypro.space",
            },
          ],
        }),
      },
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
        {/* Early Buffer + EventEmitter so wallet SDKs never see undefined globals.
            No __openpayStub — this is a usable Buffer until ensureBuffer upgrades it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var g=typeof globalThis!=="undefined"?globalThis:window;g.global=g.global||g;g.process=g.process||{env:{}};function from(v,e){if(typeof v==="string"){if(e==="base64"||e==="base64url"){var s=e==="base64url"?v.replace(/-/g,"+").replace(/_/g,"/"):v;while(s.length%4)s+="=";var b=atob(s),o=new Uint8Array(b.length);for(var i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}if(e==="hex"){var h=v.length%2?"0"+v:v,u=new Uint8Array(h.length/2);for(var j=0;j<u.length;j++)u[j]=parseInt(h.substr(j*2,2),16);return u}return(new TextEncoder).encode(v)}if(v instanceof ArrayBuffer)return new Uint8Array(v);if(ArrayBuffer.isView(v))return new Uint8Array(v.buffer,v.byteOffset,v.byteLength);if(Array.isArray(v))return Uint8Array.from(v);return new Uint8Array(0)}if(!(g.Buffer&&typeof g.Buffer.from==="function"&&typeof g.Buffer.allocUnsafe==="function"&&!g.Buffer.__openpayStub&&!g.Buffer.__openpayEarly)){function B(a,e){if(!(this instanceof B))return from(a,e);var x=from(a,e);this.length=x.length;for(var i=0;i<x.length;i++)this[i]=x[i]}B.from=from;B.isBuffer=function(x){return x instanceof B||!!(x&&x.__isOpenPayBuffer)};B.alloc=function(n,f){var a=new Uint8Array(n||0);if(typeof f==="number")a.fill(f);return a};B.allocUnsafe=B.alloc;B.concat=function(list){var n=0,i=0;for(;i<list.length;i++)n+=list[i].length;var out=new Uint8Array(n),o=0;for(i=0;i<list.length;i++){out.set(list[i],o);o+=list[i].length}return out};B.byteLength=function(s,e){return from(s,e).length};B.__openpayEarly=1;g.Buffer=B;if(typeof window!=="undefined")window.Buffer=B}if(typeof g.EventEmitter!=="function"){function EE(){this._events={};this._eventsCount=0}EE.prototype.on=EE.prototype.addListener=function(t,f){ (this._events[t]=this._events[t]||[]).push(f);return this};EE.prototype.once=function(t,f){var s=this;function w(){s.off(t,w);return f.apply(s,arguments)}this.on(t,w);return this};EE.prototype.off=EE.prototype.removeListener=function(t,f){var a=this._events[t];if(!a)return this;this._events[t]=a.filter(function(x){return x!==f});return this};EE.prototype.emit=function(t){var a=this._events[t]||[],args=[].slice.call(arguments,1);for(var i=0;i<a.length;i++)try{a[i].apply(this,args)}catch(e){setTimeout(function(){throw e},0)}return a.length>0};EE.prototype.removeAllListeners=function(t){if(t)delete this._events[t];else this._events={};return this};EE.EventEmitter=EE;g.EventEmitter=EE}}catch(e){}})();`,
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
  // The authenticated shell runs its own page transition around <Outlet />,
  // so skip the root-level one there to avoid animating the sidebar/tabbar.
  const inAppShell = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId.startsWith("/_authenticated")),
  });

  useEffect(() => {
    void import("@/lib/buffer-polyfill")
      .then((m) => m.ensureBuffer())
      .catch((err) => console.warn("[buffer] early install failed", err));
  }, []);

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
        <SplashScreen />
        <RouteProgress />
        <PageTransition disabled={inAppShell}>
          <Outlet />
        </PageTransition>
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
