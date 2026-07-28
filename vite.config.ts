// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * rpc-websockets (via @solana/web3.js / Phantom) only declares "browser" + "node" exports.
 * Nitro's Cloudflare/workerd build resolves with ["workerd","worker",...] and fails.
 * Point at the browser build so Vite skips the broken exports map.
 */
const rpcWebsocketsBrowser = path.resolve(
  rootDir,
  "node_modules/rpc-websockets/dist/index.browser.mjs",
);

/**
 * Mirror Vercel/Supabase integration names into VITE_* for the browser bundle.
 * IMPORTANT: never assign empty strings — that poisons Lovable's envDefine and
 * ships blank VITE_SUPABASE_URL / PUBLISHABLE_KEY into production (white-screen error).
 */
function mirrorVite(name: string, candidates: Array<string | undefined>) {
  const current = process.env[name]?.trim();
  if (current) return;
  const next = candidates.map((v) => v?.trim()).find((v) => Boolean(v));
  if (next) process.env[name] = next;
}

mirrorVite("VITE_SUPABASE_URL", [
  process.env.SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL,
]);
mirrorVite("VITE_SUPABASE_PUBLISHABLE_KEY", [
  process.env.SUPABASE_PUBLISHABLE_KEY,
  process.env.SUPABASE_ANON_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
]);
mirrorVite("VITE_SUPABASE_PROJECT_ID", [
  process.env.SUPABASE_PROJECT_ID,
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID,
]);

const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

export default defineConfig({
  // Pin Nitro to Vercel when building there (Lovable default is Cloudflare).
  nitro: onVercel ? { preset: "vercel" } : undefined,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      global: "globalThis",
    },
    resolve: {
      alias: {
        "rpc-websockets": rpcWebsocketsBrowser,
        // Trailing slash picks package entry reliably; hard path to index.js often
        // yields Vite `{ default: undefined }` and breaks Phantom Buffer setup.
        buffer: path.resolve(rootDir, "node_modules/buffer/"),
        // Web3Auth SafeEventEmitter needs a real named `EventEmitter` export.
        "events-package": path.resolve(rootDir, "node_modules/events/events.js"),
        events: path.resolve(rootDir, "src/shims/events.ts"),
        process: path.resolve(rootDir, "node_modules/process/browser.js"),
      },
      dedupe: ["react", "react-dom", "buffer", "events"],
    },
    optimizeDeps: {
      // Phantom / Commerce Kit import production `react/jsx-runtime` (CJS).
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "@phantom/react-sdk",
        "@walletconnect/pay",
        "@moonpay/moonpay-react",
        "buffer",
        "buffer/",
        "base64-js",
        "ieee754",
        "events",
        "events-package",
        "process",
      ],
      // Force Web3Auth through our events shim (stale prebundles break SafeEventEmitter).
      exclude: ["@web3auth/modal", "@web3auth/auth"],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    ssr: {
      // Keep CJS `buffer` / MoonPay off the SSR ESM runner.
      external: ["buffer", "base64-js", "ieee754", "@moonpay/moonpay-react"],
      noExternal: ["events", "events-package"],
      resolve: {
        conditions: ["browser", "module", "import", "default"],
      },
    },
  },
});
