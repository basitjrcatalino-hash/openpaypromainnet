// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

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
});
