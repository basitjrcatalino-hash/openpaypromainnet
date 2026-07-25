/**
 * Client-safe Supabase URL / publishable key resolution.
 * Do not put service-role / secret keys in this module — it is imported by browser code.
 *
 * Supports Lovable, Vercel ↔ Supabase integration, and local `.env` aliases.
 */

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return undefined;
}

function viteEnv(key: string): string | undefined {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    return env?.[key];
  } catch {
    return undefined;
  }
}

export function getSupabaseUrl(): string | undefined {
  return firstNonEmpty(
    viteEnv("VITE_SUPABASE_URL"),
    viteEnv("NEXT_PUBLIC_SUPABASE_URL"),
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function getSupabasePublishableKey(): string | undefined {
  return firstNonEmpty(
    viteEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
    viteEnv("VITE_SUPABASE_ANON_KEY"),
    viteEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    viteEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function missingSupabaseEnvMessage(missing: string[]): string {
  return (
    `Missing Supabase environment variable(s): ${missing.join(", ")}. ` +
    `Add them in Vercel → Project Settings → Environment Variables ` +
    `(or Lovable Cloud Secrets). Vercel Supabase integration uses ` +
    `SUPABASE_SECRET_KEY for the service role.`
  );
}
