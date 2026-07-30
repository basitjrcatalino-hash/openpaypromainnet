// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

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

const eventsShim = path.resolve(rootDir, "src/shims/events.ts");
const safeEventEmitterShim = path.resolve(rootDir, "src/shims/safe-event-emitter.ts");

/**
 * Force Web3Auth SafeEventEmitter + events through pure-ESM shims.
 * Relative imports like `./safeEventEmitter.js` ignore package-name aliases.
 * Docs: https://docs.metamask.io/embedded-wallets/authentication
 */
function web3authEventsShimPlugin(): Plugin {
  return {
    name: "web3auth-events-shim",
    enforce: "pre",
    resolveId(id, importer) {
      if (id === "events" || id === "node:events") return eventsShim;

      const base = id.split("?")[0] || id;
      const looksLikeSafeEE =
        /safeEventEmitter/i.test(base) || /safe-event-emitter/i.test(base);
      if (!looksLikeSafeEE) return null;

      if (
        !importer ||
        importer.includes("@web3auth") ||
        importer.includes("safe-event-emitter") ||
        id.includes("@web3auth")
      ) {
        return safeEventEmitterShim;
      }
      return null;
    },
  };
}

export default defineConfig({
  // Pin Nitro to Vercel when building there (Lovable default is Cloudflare).
  nitro: onVercel ? { preset: "vercel" } : undefined,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [web3authEventsShimPlugin(), mcpPlugin()],
    define: {
      global: "globalThis",
    },
    resolve: {
      alias: {
        "rpc-websockets": rpcWebsocketsBrowser,
        buffer: path.resolve(rootDir, "node_modules/buffer/"),
        process: path.resolve(rootDir, "node_modules/process/browser.js"),
        events: eventsShim,
        "node:events": eventsShim,
        loglevel: path.resolve(rootDir, "src/shims/loglevel.ts"),
        "loglevel-package": path.resolve(rootDir, "node_modules/loglevel/lib/loglevel.js"),
        deepmerge: path.resolve(rootDir, "src/shims/deepmerge.ts"),
        "json-stable-stringify": path.resolve(rootDir, "src/shims/json-stable-stringify.ts"),
      },
      dedupe: [
        "react",
        "react-dom",
        "buffer",
        "events",
        "loglevel",
        "deepmerge",
        "json-stable-stringify",
      ],
    },
    optimizeDeps: {
      // Exclude Web3Auth so SafeEventEmitter/events shims always apply.
      // Prebundling Web3Auth re-introduces broken CJS `EventEmitter` interop.
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
        "loglevel",
        "loglevel-package",
        "deepmerge",
        "json-stable-stringify",
        "process",
      ],
      exclude: [
        "@web3auth/modal",
        "@web3auth/modal/react",
        "@web3auth/auth",
        "@web3auth/no-modal",
      ],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    ssr: {
      external: ["buffer", "base64-js", "ieee754", "@moonpay/moonpay-react"],
      noExternal: [
        "events",
        "loglevel",
        "loglevel-package",
        "deepmerge",
        "json-stable-stringify",
      ],
      resolve: {
        conditions: ["browser", "module", "import", "default"],
      },
    },
  },
});
