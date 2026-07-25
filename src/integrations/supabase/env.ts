/**
 * Client-safe Supabase URL / publishable key resolution.
 * Do not put service-role / secret keys in this module — it is imported by browser code.
 *
 * Supports Lovable, Vercel ↔ Supabase integration, and local `.env` aliases.
 * Also reads `window.__OPENPAY_PUBLIC__` injected by the SSR shell when
 * build-time VITE_* vars are empty (common on Lovable Cloudflare).
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

function injectedPublic(): { url?: string; publishableKey?: string } {
  if (typeof window === "undefined") return {};
  try {
    const g = (window as unknown as { __OPENPAY_PUBLIC__?: { url?: string; publishableKey?: string } })
      .__OPENPAY_PUBLIC__;
    return g && typeof g === "object" ? g : {};
  } catch {
    return {};
  }
}

function projectId(): string | undefined {
  return firstNonEmpty(
    viteEnv("VITE_SUPABASE_PROJECT_ID"),
    process.env.VITE_SUPABASE_PROJECT_ID,
    process.env.SUPABASE_PROJECT_ID,
  );
}

export function getSupabaseUrl(): string | undefined {
  const injected = injectedPublic();
  const direct = firstNonEmpty(
    injected.url,
    viteEnv("VITE_SUPABASE_URL"),
    viteEnv("NEXT_PUBLIC_SUPABASE_URL"),
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  if (direct) return direct;
  const id = projectId();
  return id ? `https://${id}.supabase.co` : undefined;
}

export function getSupabasePublishableKey(): string | undefined {
  const injected = injectedPublic();
  return firstNonEmpty(
    injected.publishableKey,
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
    `(or Lovable Cloud Secrets). Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY ` +
    `for the browser, and SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY for the server.`
  );
}
