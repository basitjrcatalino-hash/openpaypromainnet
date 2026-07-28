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

const bufferPkg = path.resolve(rootDir, "node_modules/buffer/index.js");

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
        // Phantom / Solana expect the npm `buffer` package in the browser.
        buffer: bufferPkg,
      },
      dedupe: ["react", "react-dom", "buffer"],
    },
    optimizeDeps: {
      // Phantom / Commerce Kit import production `react/jsx-runtime` (CJS).
      // Without prebundling, the browser gets raw module.exports and white-screens:
      // "does not provide an export named 'jsx'".
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "@phantom/react-sdk",
        "buffer",
      ],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    ssr: {
      // Prefer browser builds for edge/workerd when packages advertise them.
      resolve: {
        conditions: ["browser", "module", "import", "default"],
      },
    },
  },
});
